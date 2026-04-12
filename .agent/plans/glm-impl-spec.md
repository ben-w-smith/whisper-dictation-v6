# Implementation Spec: Local-Only Refactor + llama-server Integration

**Project:** whisper-dictation-v6 (`/Users/bensmith/development/whisper-dictation-v6`)
**Stack:** Electron 41, React 19, TypeScript, XState v5, Tailwind v4
**Goal:** Remove all cloud API dependencies. Add local llama-server for AI text refinement.

Read every file listed under "FILES: Read first" before touching anything.
Preserve all logic not explicitly marked for removal.
Do not add comments, docstrings, or type annotations to unchanged code.
Do not reformat or lint code you didn't change.

---

## TASK 1 — Update shared types

**FILES: Read first**
- `src/shared/types.ts`
- `src/shared/constants.ts`

**FILES: Write**
- `src/shared/types.ts`
- `src/shared/constants.ts`
- `src/shared/errors.ts`

### types.ts changes

REMOVE these type exports:
```
export type TranscriptionProvider = 'local' | 'openai' | 'google'
export type RefinementProvider = 'openai' | 'anthropic' | 'google'
```

ADD this type export:
```typescript
export type LlamaServerStatus = 'stopped' | 'starting' | 'ready' | 'error' | 'crashed'
```

In `AppSettings` interface, REMOVE these fields:
- `transcriptionProvider: TranscriptionProvider`
- `openaiApiKey: string`
- `googleApiKey: string`
- `anthropicApiKey: string`
- `refinementProvider: RefinementProvider`
- `refinementModel: string`

In `AppSettings` interface, ADD this field (in the AI Refinement section):
- `refinementModelPath: string`   // absolute path to GGUF file on disk

In `ErrorCode` type, REMOVE:
- `'API_KEY_MISSING'`
- `'API_REQUEST_FAILED'`

Keep `REFINEMENT_FAILED` — it's still used when llama-server call fails.

Keep all other types exactly as-is.

### constants.ts changes

In `DEFAULT_SETTINGS`, REMOVE:
- `transcriptionProvider: 'local'`
- `openaiApiKey: ''`
- `googleApiKey: ''`
- `anthropicApiKey: ''`
- `refinementProvider: 'openai'`
- `refinementModel: 'gpt-4o-mini'`

In `DEFAULT_SETTINGS`, ADD:
- `refinementModelPath: ''`

ADD these new constants after the existing `WHISPER_BIN_PATH` and `MODEL_DIR` lines:
```typescript
export const LLAMA_BIN_PATH = 'bin/llama-server'
export const LLAMA_SERVER_PORT = 8081
export const LLAMA_CTX_SIZE = 4096
```

Keep `REFINEMENT_PROMPTS` exactly as-is.
Keep everything else exactly as-is.

### errors.ts changes

In `ERROR_DEFINITIONS`, REMOVE the entries for:
- `API_KEY_MISSING`
- `API_REQUEST_FAILED`

Update the `REFINEMENT_FAILED` suggestion to:
```
'llama-server is not running or the refinement model is not loaded. Raw transcription used instead.'
```

Keep everything else exactly as-is.

---

## TASK 2 — Add LLAMA_SERVER_STATUS to IPC channel map

**FILES: Read first**
- `src/shared/ipc.ts`

**FILES: Write**
- `src/shared/ipc.ts`

In the `IPC` object, add this entry in the "Main -> Renderer" section:
```typescript
LLAMA_SERVER_STATUS: 'llama:status',
```

No other changes.

---

## TASK 3 — Strip cloud providers from whisper.ts

**FILES: Read first**
- `src/main/whisper.ts`
- `src/shared/types.ts` (after Task 1)

**FILES: Write**
- `src/main/whisper.ts`

REMOVE the import of `https` (no longer needed).
REMOVE the `readFileSync` import (only used by cloud functions).

In `TranscribeOptions`, REMOVE:
- `provider?: TranscriptionProvider`
- `apiKey?: string`

In `transcribeAudio`, REMOVE:
- The destructuring of `provider` and `apiKey` from options
- The entire `if (provider === 'openai' && apiKey)` block
- The entire `if (provider === 'google' && apiKey)` block
- The `onProgress?.('Transcribing with OpenAI...')` and `onProgress?.('Transcribing with Google...')` lines

REMOVE entirely:
- The `transcribeWithOpenAI` function (lines ~258-340)
- The `transcribeWithGoogle` function (lines ~345-410)

Keep all other logic exactly as-is including the mock, timeout, spawn, and all error handling.

---

## TASK 4 — Create llama-server process manager

**FILES: Read first**
- `src/main/whisper.ts` (for reference on binary path pattern)
- `src/shared/constants.ts` (after Task 1, for LLAMA_BIN_PATH, LLAMA_SERVER_PORT, LLAMA_CTX_SIZE)
- `src/shared/ipc.ts` (after Task 2, for IPC.LLAMA_SERVER_STATUS)

**FILES: Create**
- `src/main/llama.ts`

Write this file exactly:

```typescript
import { spawn, ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, dialog, powerMonitor, BrowserWindow } from 'electron'
import { LLAMA_BIN_PATH, LLAMA_SERVER_PORT, LLAMA_CTX_SIZE } from '@shared/constants'
import { IPC } from '@shared/ipc'
import type { LlamaServerStatus } from '@shared/types'

const MAX_CONSECUTIVE_FAILURES = 2
const STARTUP_TIMEOUT_MS = 45000
const RESTART_DELAY_MS = 2000

let llamaProcess: ChildProcess | null = null
let currentStatus: LlamaServerStatus = 'stopped'
let currentModelPath: string | null = null
let consecutiveFailures = 0

function getBinPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', LLAMA_BIN_PATH)
    : join(process.cwd(), LLAMA_BIN_PATH)
}

function broadcast(status: LlamaServerStatus): void {
  currentStatus = status
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.LLAMA_SERVER_STATUS, status)
    }
  })
}

export function getLlamaStatus(): LlamaServerStatus {
  return currentStatus
}

export async function startLlamaServer(modelPath: string): Promise<void> {
  if (!modelPath) return
  if (!existsSync(modelPath)) {
    console.warn('[Llama] Model file not found:', modelPath)
    broadcast('error')
    return
  }

  const binPath = getBinPath()
  if (!existsSync(binPath)) {
    console.error('[Llama] Binary not found:', binPath)
    broadcast('error')
    return
  }

  // Already running with the same model — nothing to do
  if (llamaProcess && currentModelPath === modelPath && currentStatus === 'ready') {
    return
  }

  // Different model or crashed — stop first
  if (llamaProcess) {
    await stopLlamaServer()
  }

  currentModelPath = modelPath
  broadcast('starting')
  console.log('[Llama] Starting server, model:', modelPath)

  return new Promise<void>((resolve, reject) => {
    let settled = false

    const settle = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(startupTimer)
      if (err) reject(err)
      else resolve()
    }

    const startupTimer = setTimeout(() => {
      llamaProcess?.kill('SIGKILL')
      llamaProcess = null
      broadcast('error')
      settle(new Error('llama-server startup timed out'))
    }, STARTUP_TIMEOUT_MS)

    llamaProcess = spawn(getBinPath(), [
      '--model', modelPath,
      '--port', String(LLAMA_SERVER_PORT),
      '--ctx-size', String(LLAMA_CTX_SIZE),
      '--n-gpu-layers', '999',
      '--host', '127.0.0.1',
      '--no-webui',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    llamaProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      // llama-server prints this line when ready
      if (!settled && (text.includes('listening') || text.includes('HTTP server listening'))) {
        consecutiveFailures = 0
        broadcast('ready')
        console.log('[Llama] Server ready on port', LLAMA_SERVER_PORT)
        settle()
      }
    })

    llamaProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      // Also check stderr — some builds log there
      if (!settled && (text.includes('listening') || text.includes('HTTP server listening'))) {
        consecutiveFailures = 0
        broadcast('ready')
        console.log('[Llama] Server ready (stderr) on port', LLAMA_SERVER_PORT)
        settle()
      }
    })

    llamaProcess.on('error', (err) => {
      llamaProcess = null
      broadcast('error')
      settle(err)
    })

    llamaProcess.on('close', (code) => {
      const wasReady = currentStatus === 'ready'
      llamaProcess = null

      if (!settled) {
        // Failed during startup
        consecutiveFailures++
        broadcast('error')
        settle(new Error(`llama-server exited with code ${code} during startup`))
        return
      }

      if (!wasReady) return

      // Unexpected exit after successful start
      consecutiveFailures++
      console.warn(`[Llama] Unexpected exit (failures: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`)

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        broadcast('crashed')
        dialog.showErrorBox(
          'AI Refinement Unavailable',
          `The llama-server process crashed ${consecutiveFailures} times in a row and will not be restarted automatically.\n\nCheck that your GGUF model file is valid and not corrupted. You can re-enable refinement by changing the model path in Settings → AI.`
        )
      } else {
        broadcast('stopped')
        setTimeout(() => {
          if (currentModelPath) {
            startLlamaServer(currentModelPath).catch(console.error)
          }
        }, RESTART_DELAY_MS)
      }
    })
  })
}

export async function stopLlamaServer(): Promise<void> {
  if (!llamaProcess) {
    currentStatus = 'stopped'
    return
  }

  return new Promise<void>((resolve) => {
    const proc = llamaProcess!
    const forceKillTimer = setTimeout(() => {
      proc.kill('SIGKILL')
      llamaProcess = null
      broadcast('stopped')
      resolve()
    }, 5000)

    proc.on('close', () => {
      clearTimeout(forceKillTimer)
      llamaProcess = null
      broadcast('stopped')
      resolve()
    })

    proc.kill('SIGTERM')
  })
}

/**
 * Call once after app.whenReady(). Handles suspend/resume so llama-server
 * is cleanly killed before sleep and restarted after wake.
 */
export function registerPowerMonitor(): void {
  powerMonitor.on('suspend', () => {
    console.log('[Llama] System suspending — stopping server')
    if (llamaProcess) {
      llamaProcess.kill('SIGTERM')
      llamaProcess = null
      currentStatus = 'stopped'
    }
  })

  powerMonitor.on('resume', () => {
    console.log('[Llama] System resumed — restarting server')
    consecutiveFailures = 0 // reset on resume — not the server's fault
    if (currentModelPath) {
      setTimeout(() => {
        startLlamaServer(currentModelPath!).catch(console.error)
      }, 1500)
    }
  })
}
```

---

## TASK 5 — Rewrite refine.ts for llama-server

**FILES: Read first**
- `src/main/llama.ts` (after Task 4)
- `src/shared/constants.ts` (after Task 1)
- `src/shared/types.ts` (after Task 1)

**FILES: Write**
- `src/main/refine.ts`

Replace the entire file with:

```typescript
import http from 'node:http'
import { REFINEMENT_PROMPTS, LLAMA_SERVER_PORT } from '@shared/constants'
import type { AppSettings } from '@shared/types'
import { getLlamaStatus } from './llama'

/**
 * Refine transcribed text using the local llama-server.
 * Returns the original text unchanged if refinement is disabled,
 * the model path is not set, or the server is not ready.
 */
export async function refineText(
  text: string,
  settings: AppSettings
): Promise<string> {
  if (!settings.refinementEnabled) return text
  if (!settings.refinementModelPath) return text

  const status = getLlamaStatus()
  if (status !== 'ready') {
    console.warn('[Refine] llama-server not ready (status:', status, ') — using raw transcription')
    return text
  }

  const prompt = REFINEMENT_PROMPTS[settings.refinementIntensity] ?? REFINEMENT_PROMPTS.medium

  const requestBody = JSON.stringify({
    model: 'local',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  })

  return new Promise<string>((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: LLAMA_SERVER_PORT,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout: 30000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data)
              resolve(result.choices[0]?.message?.content?.trim() || text)
            } catch {
              resolve(text) // parse failure — use original
            }
          } else {
            reject(new Error(`llama-server responded ${res.statusCode}: ${data}`))
          }
        })
      }
    )

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('llama-server request timed out'))
    })

    req.write(requestBody)
    req.end()
  })
}
```

---

## TASK 6 — Update ipc.ts (main process)

**FILES: Read first**
- `src/main/ipc.ts`
- `src/shared/types.ts` (after Task 1)

**FILES: Write**
- `src/main/ipc.ts`

### Change 1: Remove unused imports

Remove `LocalModel` from the type import on line ~19 if it's no longer needed. Actually keep it — it's used by DOWNLOAD_MODEL handler.

### Change 2: Simplify START_WHISPER handler

Find this block inside `ipcMain.handle(IPC.START_WHISPER, ...)`:
```typescript
// Determine API key based on provider
let apiKey: string | undefined
if (settings.transcriptionProvider === 'openai') {
  apiKey = settings.openaiApiKey || undefined
} else if (settings.transcriptionProvider === 'google') {
  apiKey = settings.googleApiKey || undefined
}

const result = await transcribeAudio({
  audioPath,
  model,
  options: {
    provider: settings.transcriptionProvider,
    apiKey,
    onProgress: ...
  },
})
```

Replace with:
```typescript
const result = await transcribeAudio({
  audioPath,
  model,
  options: {
    onProgress: (message: string) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.DOWNLOAD_PROGRESS, { message })
        }
      })
    },
  },
})
```

### Change 3: Simplify refinement check

Find this block:
```typescript
if (settings.refinementEnabled) {
  // Check for API key before attempting refinement
  const hasApiKey = settings.refinementProvider === 'openai' ? !!settings.openaiApiKey
    : settings.refinementProvider === 'anthropic' ? !!settings.anthropicApiKey
    : settings.refinementProvider === 'google' ? !!settings.googleApiKey
    : false

  if (!hasApiKey) {
    refinementSkipped = true
  } else {
    try {
      finalText = await refineText(result.text, settings)
    } catch (error) {
      console.warn('Refinement failed, using original transcription:', error)
      refinementSkipped = true
    }
  }
}
```

Replace with:
```typescript
if (settings.refinementEnabled && settings.refinementModelPath) {
  try {
    finalText = await refineText(result.text, settings)
  } catch (error) {
    console.warn('[IPC] Refinement failed, using original:', error)
    refinementSkipped = true
  }
}
```

### Change 4: Add llama-server restart on model path change

Find the block inside `ipcMain.handle(IPC.SET_SETTING, ...)` that handles `keyboardShortcut`:
```typescript
if (key === 'keyboardShortcut') {
  ...
}
```

Add immediately after that block:
```typescript
// Restart llama-server when the model path or refinement toggle changes
if (key === 'refinementModelPath' || key === 'refinementEnabled') {
  const { startLlamaServer, stopLlamaServer } = await import('./llama')
  const updatedSettings = await getSettings()
  if (updatedSettings.refinementEnabled && updatedSettings.refinementModelPath) {
    startLlamaServer(updatedSettings.refinementModelPath).catch(console.error)
  } else {
    stopLlamaServer().catch(console.error)
  }
}
```

Keep everything else in ipc.ts exactly as-is.

---

## TASK 7 — Update index.ts (app entry point)

**FILES: Read first**
- `src/main/index.ts`
- `src/main/llama.ts` (after Task 4)

**FILES: Write**
- `src/main/index.ts`

### Change 1: Add imports at the top

Add to the imports section (after existing main process service imports):
```typescript
import { startLlamaServer, stopLlamaServer, registerPowerMonitor } from './llama'
```

### Change 2: Start llama-server after app is ready

Find the section in `app.whenReady()` that calls `requestMicrophonePermission()`. After that call, add:
```typescript
// Start llama-server if refinement is configured
const settings = await getSettings()
if (settings.refinementEnabled && settings.refinementModelPath) {
  startLlamaServer(settings.refinementModelPath).catch((err) => {
    console.error('[App] Failed to start llama-server:', err)
  })
}

// Handle sleep/wake for llama-server
registerPowerMonitor()
```

### Change 3: Kill llama-server on quit

Find `app.on('window-all-closed', ...)` or wherever the app quit logic is. Add:
```typescript
app.on('before-quit', () => {
  stopLlamaServer().catch(console.error)
})
```

Keep everything else exactly as-is.

---

## TASK 8 — Update electron-builder.yml

**FILES: Read first**
- `electron-builder.yml`

**FILES: Write**
- `electron-builder.yml`

The current `asarUnpack` is:
```yaml
asarUnpack:
  - bin/**/*
```

This already covers both `bin/whisper-cpp` and `bin/llama-server`. No change needed IF the llama-server binary is placed at `bin/llama-server`.

Verify the current content and confirm `bin/**/*` is present in asarUnpack. If it is, no change needed for this task. If the asarUnpack section is missing or only has specific files, update it to `- bin/**/*`.

---

## TASK 9 — Update App.tsx

**FILES: Read first**
- `src/renderer/src/App.tsx`

**FILES: Write**
- `src/renderer/src/App.tsx`

### Change 1: Remove transcriptionProvider from history entry

Find this block in `DictationApp` (inside the `state.matches('complete')` branch):
```typescript
const entry = {
  id: crypto.randomUUID(),
  text,
  rawText: state.context.rawTranscriptionText,
  audioDurationMs: state.context.audioDurationMs,
  transcriptionProvider: settings.transcriptionProvider,
  timestamp: Date.now(),
  wordCount: text.split(/\s+/).filter(Boolean).length,
}
```

Replace `transcriptionProvider: settings.transcriptionProvider` with `transcriptionProvider: 'local'`.

### Change 2: Remove transcriptionProvider from useEffect dependency array

Find the dependency array of the audio capture useEffect (the one with `state.value` in it). It currently includes `settings.transcriptionProvider`. Remove that from the array.

No other changes to App.tsx.

---

## TASK 10 — Rewrite AIPage.tsx for local model

**FILES: Read first**
- `src/renderer/src/views/settings/AIPage.tsx`
- `src/shared/types.ts` (after Task 1)
- `src/shared/ipc.ts` (after Task 2)

**FILES: Write**
- `src/renderer/src/views/settings/AIPage.tsx`

Replace the entire file with:

```typescript
import React, { useState, useEffect, useCallback } from 'react'
import { ToggleSwitch } from '../../components/ToggleSwitch'
import type { AppSettings, RefinementIntensity, LlamaServerStatus } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

const INTENSITY_INFO: Record<RefinementIntensity, { name: string; description: string }> = {
  light: { name: 'Light', description: 'Fix only obvious typos and punctuation' },
  medium: { name: 'Medium', description: 'Fix errors and improve sentence structure' },
  heavy: { name: 'Heavy', description: 'Full polish for professional output' },
}

const STATUS_LABELS: Record<LlamaServerStatus, { label: string; color: string }> = {
  stopped: { label: 'Stopped', color: 'text-stone-400' },
  starting: { label: 'Starting...', color: 'text-amber-500' },
  ready: { label: 'Ready', color: 'text-green-600' },
  error: { label: 'Error', color: 'text-red-500' },
  crashed: { label: 'Crashed — check model file', color: 'text-red-600' },
}

export function AIPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [llamaStatus, setLlamaStatus] = useState<LlamaServerStatus>('stopped')

  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    loadSettings()

    const unsubStatus = window.api.on(IPC.LLAMA_SERVER_STATUS, (status: unknown) => {
      setLlamaStatus(status as LlamaServerStatus)
    })

    return () => { unsubStatus() }
  }, [])

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }, [])

  const statusInfo = STATUS_LABELS[llamaStatus]

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <section className="flex items-center justify-between p-4 rounded-xl border border-border-custom bg-surface">
        <div>
          <h3 className="font-medium text-text-primary">AI Refinement</h3>
          <p className="text-sm text-text-secondary mt-1">
            Clean up transcription with a local Gemma model
          </p>
        </div>
        <ToggleSwitch
          checked={settings.refinementEnabled}
          onChange={(checked) => updateSetting('refinementEnabled', checked)}
        />
      </section>

      {settings.refinementEnabled && (
        <>
          {/* Model path */}
          <section>
            <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-2">
              Model File (GGUF)
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Paste the absolute path to a GGUF file. Recommended: Gemma 4 E2B Q4_K_M from{' '}
              <span className="font-mono text-text-primary">unsloth/gemma-4-E2B-it-GGUF</span> on Hugging Face.
            </p>
            <input
              type="text"
              value={settings.refinementModelPath}
              onChange={(e) => updateSetting('refinementModelPath', e.target.value)}
              placeholder="/path/to/gemma-4-E2B-Q4_K_M.gguf"
              className="w-full px-4 py-3 border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-accent bg-surface font-mono text-sm"
              spellCheck={false}
            />
          </section>

          {/* Server status */}
          <section className="flex items-center justify-between py-2">
            <span className="text-sm text-text-secondary">llama-server status</span>
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </section>

          {/* Intensity */}
          <section>
            <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-4">
              Intensity
            </h3>
            <div className="space-y-3">
              {(Object.keys(INTENSITY_INFO) as RefinementIntensity[]).map((intensity) => {
                const info = INTENSITY_INFO[intensity]
                const isSelected = settings.refinementIntensity === intensity
                return (
                  <button
                    key={intensity}
                    onClick={() => updateSetting('refinementIntensity', intensity)}
                    className={`
                      w-full p-4 rounded-xl border-2 text-left transition-all
                      ${isSelected ? 'border-accent bg-accent-subtle' : 'border-border-custom bg-surface hover:border-stone-300'}
                    `}
                  >
                    <div className="font-medium text-text-primary">{info.name}</div>
                    <div className="text-sm text-text-secondary mt-1">{info.description}</div>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}

      {!settings.refinementEnabled && (
        <div className="p-8 rounded-xl border border-border-custom bg-surface text-center">
          <p className="text-text-secondary text-sm">
            Enable refinement and point to a GGUF model file to activate local AI cleanup.
          </p>
        </div>
      )}
    </div>
  )
}
```

---

## TASK 11 — Update ModelPage.tsx (remove cloud providers section)

**FILES: Read first**
- `src/renderer/src/views/settings/ModelPage.tsx`

**FILES: Write**
- `src/renderer/src/views/settings/ModelPage.tsx`

REMOVE:
- The `showOpenAIKey` and `showGoogleKey` state variables
- The entire `<section>` block with heading "Cloud Providers" and all its contents (the two provider cards for OpenAI Whisper and Google Cloud Speech-to-Text)

KEEP:
- Everything else — the local model selector with download buttons, progress bars, and all existing logic

Also REMOVE from `useEffect` and state:
- `showOpenAIKey` state
- `showGoogleKey` state

These are only referenced in the cloud providers section being removed.

---

## TASK 12 — TypeScript compile check

After all tasks are complete, run:
```bash
cd /Users/bensmith/development/whisper-dictation-v6 && pnpm lint
```

Fix any TypeScript errors. Do NOT change logic — only fix type errors introduced by the above changes. Common expected errors:
- References to removed settings fields (`openaiApiKey`, `googleApiKey`, etc.) in files not covered above
- `TranscriptionProvider` type referenced somewhere — replace usage with literal `'local'`

---

## NOTES FOR IMPLEMENTER

- `bin/llama-server` binary does NOT exist yet. That's fine — tasks 1-12 are code changes only. The binary will be added separately via `scripts/setup-whisper.sh` or manual download.
- The `IPC.LLAMA_SERVER_STATUS` channel is send-only (main → renderer). No `ipcMain.handle` needed.
- `http` (not `https`) for llama-server calls — it's localhost.
- Do NOT pass `--log-disable` — the bundled binary (v8180) does not support this flag and will crash.
- The confirmed ready-signal string for v8180 is `"server is listening on"` (appears on stdout). The detection of `"listening"` in the spec covers this correctly.
- The ready detection in llama.ts watches for `"listening"` in stdout/stderr. This covers llama.cpp server versions that print `"llama server listening"` or `"HTTP server listening at"`.
- Do not add `import type` for `LlamaServerStatus` in llama.ts — import it as a regular type since it's used as a value in the broadcast function signature.
