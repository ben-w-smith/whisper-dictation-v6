# Settings UI Redesign — Page Rewrites (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all four settings pages using the new design tokens and consistent component patterns from the design spec.

**Architecture:** Each page gets a complete rewrite. `TranscriptionPage` merges the old `ModelPage` and `AIPage` into one page with two sections. `GeneralPage`, `DictionaryPage`, and `HistoryPage` get token updates, consistent patterns, and cleanup of hardcoded Tailwind colors.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, Electron 41+

**Design spec:** `docs/superpowers/specs/2026-04-14-settings-ui-redesign-design.md`
**Prerequisite:** Plan 1 (foundation) must be completed first — tokens, types, and Home.tsx layout must be in place.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/renderer/src/views/home/GeneralPage.tsx` | Modify | Audio input, output toggles, shortcuts |
| `src/renderer/src/views/home/TranscriptionPage.tsx` | Modify | Replace stub — merge old ModelPage + AIPage |
| `src/renderer/src/views/home/ModelPage.tsx` | Delete | Merged into TranscriptionPage |
| `src/renderer/src/views/home/AIPage.tsx` | Delete | Merged into TranscriptionPage |
| `src/renderer/src/views/home/DictionaryPage.tsx` | Modify | Word replacements |
| `src/renderer/src/views/home/HistoryPage.tsx` | Modify | Transcription history |

---

### Task 1: Rewrite GeneralPage

**Files:**
- Modify: `src/renderer/src/views/home/GeneralPage.tsx`

- [ ] **Step 1: Replace `GeneralPage.tsx`**

Key changes from current implementation:
- Permission alerts use token-based colors (`bg-danger-subtle`/`bg-warning-subtle`) instead of hardcoded `bg-red-50`/`bg-amber-50`
- Output toggles use settings row pattern (no `border-b` between items, just `py-3`)
- "Add Shortcut" uses ghost button style
- Section spacing uses `space-y-8`

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { ToggleSwitch } from '../../components/ToggleSwitch'
import { ShortcutRecorder } from '../../components/ShortcutRecorder'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

interface AudioDevice {
  deviceId: string
  label: string
}

type MicPermission = 'granted' | 'denied' | 'prompt' | 'checking'

export function GeneralPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [microphones, setMicrophones] = useState<AudioDevice[]>([])
  const [micPermission, setMicPermission] = useState<MicPermission>('checking')

  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    loadSettings()
    checkMicPermission()
  }, [])

  const checkMicPermission = useCallback(async () => {
    setMicPermission('checking')
    const result = await window.api.invoke(IPC.CHECK_PERMISSIONS) as { microphone: 'granted' | 'denied' | 'prompt' }
    setMicPermission(result.microphone)
  }, [])

  const requestMicPermission = useCallback(async () => {
    setMicPermission('checking')
    const granted = await window.api.invoke(IPC.REQUEST_MICROPHONE) as boolean
    setMicPermission(granted ? 'granted' : 'denied')
  }, [])

  const refreshMicrophones = useCallback(async (opts?: { hardRefresh?: boolean }) => {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices()
      const hasLabels = devices.some(d => d.kind === 'audioinput' && d.label)

      if (!hasLabels || opts?.hardRefresh) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempStream.getTracks().forEach(t => t.stop())
        devices = await navigator.mediaDevices.enumerateDevices()
      }

      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone (${d.deviceId.slice(0, 8)})`,
        }))
      setMicrophones(audioInputs)
    } catch (error) {
      console.warn('[Settings] Could not enumerate microphones:', error)
      setMicrophones([])
    }
  }, [])

  useEffect(() => {
    refreshMicrophones()
  }, [refreshMicrophones])

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }

  return (
    <div className="space-y-8">
      {/* Audio Input */}
      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Audio Input</h3>

        {micPermission === 'denied' && (
          <div className="flex items-start gap-3 p-3 mb-3 bg-danger-subtle border border-[#e8c4c4] rounded-lg">
            <svg className="w-5 h-5 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium text-danger">Microphone access denied</div>
              <div className="text-xs text-danger/80 mt-0.5">Enable access in System Settings to use dictation.</div>
              <button
                onClick={() => window.api.invoke(IPC.OPEN_SYSTEM_SETTINGS, 'microphone')}
                className="mt-1.5 text-xs font-medium text-danger hover:text-danger/80 underline underline-offset-2"
              >
                Open System Settings &rarr;
              </button>
            </div>
          </div>
        )}
        {micPermission === 'prompt' && (
          <div className="flex items-start gap-3 p-3 mb-3 bg-warning-subtle border border-[#e8d9b8] rounded-lg">
            <svg className="w-5 h-5 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium text-warning">Microphone permission required</div>
              <div className="text-xs text-warning/80 mt-0.5">Grant access so the app can record your voice.</div>
              <button
                onClick={requestMicPermission}
                className="mt-1.5 text-xs font-medium text-warning hover:text-warning/80 underline underline-offset-2"
              >
                Grant Access &rarr;
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-text-primary font-medium">Microphone</div>
              {micPermission === 'granted' && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-accent-subtle text-accent">
                  Access granted
                </span>
              )}
            </div>
            <div className="text-sm text-text-secondary">Select the microphone for recording</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={settings.microphoneDeviceId}
              onChange={(e) => updateSetting('microphoneDeviceId', e.target.value)}
              disabled={micPermission !== 'granted'}
              className="bg-surface border border-border-custom rounded-lg px-3 py-1.5 text-sm text-text-primary max-w-[200px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Select microphone"
            >
              <option value="">System Default</option>
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => refreshMicrophones({ hardRefresh: true })}
              className="text-text-secondary hover:text-text-primary p-1 transition-colors"
              title="Refresh microphone list"
              aria-label="Refresh microphone list"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Output */}
      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Output</h3>
        <div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-text-primary font-medium">Copy to clipboard</div>
              <div className="text-sm text-text-secondary">Copy transcribed text to clipboard</div>
            </div>
            <ToggleSwitch
              checked={settings.copyToClipboard}
              onChange={(checked) => updateSetting('copyToClipboard', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-text-primary font-medium">Auto-paste</div>
              <div className="text-sm text-text-secondary">Automatically paste transcribed text</div>
            </div>
            <ToggleSwitch
              checked={settings.autoPaste}
              onChange={(checked) => updateSetting('autoPaste', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-text-primary font-medium">Play sounds</div>
              <div className="text-sm text-text-secondary">Play sound effects when recording</div>
            </div>
            <ToggleSwitch
              checked={settings.playSounds}
              onChange={(checked) => updateSetting('playSounds', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-text-primary font-medium">Show overlay</div>
              <div className="text-sm text-text-secondary">Show floating recording indicator</div>
            </div>
            <ToggleSwitch
              checked={settings.showOverlay}
              onChange={(checked) => updateSetting('showOverlay', checked)}
            />
          </div>
        </div>
      </section>

      {/* Shortcuts */}
      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Shortcuts</h3>
        <div>
          <div className="text-sm text-text-secondary mb-3">
            Press your shortcut to start recording, press again to stop.
          </div>
          <div className="space-y-2">
            {(settings.keyboardShortcuts ?? []).map((shortcut, index) => (
              <div key={index} className="flex items-center gap-2">
                <ShortcutRecorder
                  value={shortcut}
                  mouseButton={index === 0 ? settings.mouseButton : null}
                  onChange={(keyboard, mouse) => {
                    const updated = [...settings.keyboardShortcuts]
                    if (keyboard) {
                      updated[index] = keyboard
                    } else {
                      updated.splice(index, 1)
                    }
                    updateSetting('keyboardShortcuts', updated.length > 0 ? updated : DEFAULT_SETTINGS.keyboardShortcuts)
                    if (index === 0 && mouse !== undefined) {
                      updateSetting('mouseButton', mouse)
                    }
                  }}
                />
                {(settings.keyboardShortcuts ?? []).length > 1 && (
                  <button
                    onClick={() => {
                      const updated = settings.keyboardShortcuts.filter((_, i) => i !== index)
                      updateSetting('keyboardShortcuts', updated)
                    }}
                    className="p-2 text-text-muted hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors"
                    aria-label="Remove shortcut"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                updateSetting('keyboardShortcuts', [...settings.keyboardShortcuts, ''])
              }}
              className="text-sm text-text-secondary hover:text-text-primary font-medium transition-colors"
            >
              + Add Shortcut
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/home/GeneralPage.tsx
git commit -m "feat: redesign GeneralPage — token-based alerts, settings rows, updated spacing"
```

---

### Task 2: Rewrite TranscriptionPage (merge Model + AI)

**Files:**
- Modify: `src/renderer/src/views/home/TranscriptionPage.tsx` (replace stub)
- Delete: `src/renderer/src/views/home/ModelPage.tsx`
- Delete: `src/renderer/src/views/home/AIPage.tsx`

- [ ] **Step 1: Replace `TranscriptionPage.tsx` with full merged implementation**

This combines the old `ModelPage` (whisper model selection) and `AIPage` (llama.cpp refinement) into one page with two clearly separated sections.

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { ToggleSwitch } from '../../components/ToggleSwitch'
import type { AppSettings, LocalModel, RefinementIntensity, LlamaServerStatus } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'
import { CURATED_GGUF_MODELS } from '@shared/hf'
import type { DownloadedGgufModel, HfModelSearchResult } from '@shared/hf'

const MODEL_INFO: Record<LocalModel, { name: string; size: string; description: string }> = {
  'tiny.en': { name: 'Tiny', size: '39 MB', description: 'Fastest, good for quick commands' },
  'base.en': { name: 'Base', size: '74 MB', description: 'Balanced speed and accuracy' },
  'small.en': { name: 'Small', size: '244 MB', description: 'Better accuracy, still fast' },
  'medium.en': { name: 'Medium', size: '769 MB', description: 'High accuracy for dictation' },
  'large-v3': { name: 'Large V3', size: '1.5 GB', description: 'Best accuracy, slowest' },
}

const INTENSITY_INFO: Record<RefinementIntensity, { name: string; description: string }> = {
  light: { name: 'Light', description: 'Fix only obvious typos and punctuation' },
  medium: { name: 'Medium', description: 'Fix errors and improve sentence structure' },
  heavy: { name: 'Heavy', description: 'Full polish for professional output' },
}

const STATUS_LABELS: Record<LlamaServerStatus, { label: string; color: string }> = {
  stopped: { label: 'Stopped', color: 'text-text-muted' },
  starting: { label: 'Starting...', color: 'text-warning' },
  ready: { label: 'Ready', color: 'text-success' },
  error: { label: 'Error', color: 'text-danger' },
  crashed: { label: 'Crashed — check model file', color: 'text-danger' },
}

export function TranscriptionPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [llamaStatus, setLlamaStatus] = useState<LlamaServerStatus>('stopped')

  // Whisper model state
  const [downloadProgress, setDownloadProgress] = useState<Record<LocalModel, number>>({
    'tiny.en': 0, 'base.en': 0, 'small.en': 0, 'medium.en': 0, 'large-v3': 0,
  })
  const [downloading, setDownloading] = useState<LocalModel | null>(null)
  const [downloadedModels, setDownloadedModels] = useState<Set<LocalModel>>(new Set())

  // HF / GGUF state
  const [hfToken, setHfToken] = useState('')
  const [hfTokenSaved, setHfTokenSaved] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [downloadedGguf, setDownloadedGguf] = useState<DownloadedGgufModel[]>([])
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [ggufDownloadProgress, setGgufDownloadProgress] = useState<Record<string, number>>({})

  // Search state
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<HfModelSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null)
  const [repoFiles, setRepoFiles] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    const loadDownloaded = async () => {
      const list = await window.api.invoke(IPC.GET_DOWNLOADED_MODELS) as LocalModel[]
      setDownloadedModels(new Set(list))
    }
    const loadToken = async () => {
      const token = await window.api.invoke(IPC.HF_GET_TOKEN) as string
      if (token) { setHfToken(token); setHfTokenSaved(true) }
      else { setShowTokenInput(true) }
    }
    const loadDownloadedGguf = async () => {
      const list = await window.api.invoke(IPC.HF_GET_DOWNLOADED_GGUF) as DownloadedGgufModel[]
      setDownloadedGguf(list)
    }

    loadSettings()
    loadDownloaded()
    loadToken()
    loadDownloadedGguf()

    const unsubProgress = window.api.on(IPC.DOWNLOAD_PROGRESS, (progress: { model: LocalModel; percent: number }) => {
      setDownloadProgress((prev) => ({ ...prev, [progress.model]: progress.percent }))
    })
    const unsubComplete = window.api.on(IPC.DOWNLOAD_COMPLETE, (model: LocalModel) => {
      setDownloading(null)
      setDownloadProgress((prev) => ({ ...prev, [model]: 100 }))
      setDownloadedModels((prev) => new Set([...prev, model]))
    })
    const unsubStatus = window.api.on(IPC.LLAMA_SERVER_STATUS, (status: unknown) => {
      setLlamaStatus(status as LlamaServerStatus)
    })
    const unsubGgufProgress = window.api.on(IPC.HF_DOWNLOAD_PROGRESS, (data: unknown) => {
      const p = data as { filename: string; percent: number }
      setGgufDownloadProgress((prev) => ({ ...prev, [p.filename]: p.percent }))
    })
    const unsubGgufComplete = window.api.on(IPC.HF_DOWNLOAD_COMPLETE, (data: unknown) => {
      const d = data as { filename: string }
      setDownloadingFile(null)
      setGgufDownloadProgress((prev) => ({ ...prev, [d.filename]: 100 }))
      window.api.invoke(IPC.HF_GET_DOWNLOADED_GGUF).then((list) => {
        setDownloadedGguf(list as DownloadedGgufModel[])
      })
    })
    const unsubGgufError = window.api.on(IPC.HF_DOWNLOAD_ERROR, (data: unknown) => {
      const e = data as { filename: string; error: string }
      setDownloadingFile(null)
      console.error('GGUF download error:', e.error)
    })

    return () => {
      unsubProgress?.(); unsubComplete?.(); unsubStatus?.()
      unsubGgufProgress?.(); unsubGgufComplete?.(); unsubGgufError?.()
    }
  }, [])

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }, [])

  // Whisper model handlers
  const handleDownloadModel = async (model: LocalModel) => {
    setDownloading(model)
    setDownloadProgress((prev) => ({ ...prev, [model]: 0 }))
    await window.api.invoke(IPC.DOWNLOAD_MODEL, model)
  }

  // GGUF handlers
  const saveToken = async () => {
    await window.api.invoke(IPC.HF_SET_TOKEN, hfToken)
    setHfTokenSaved(true)
    setShowTokenInput(false)
  }

  const handleDownloadCurated = async (model: typeof CURATED_GGUF_MODELS[number]) => {
    setDownloadingFile(model.filename)
    setGgufDownloadProgress((prev) => ({ ...prev, [model.filename]: 0 }))
    try {
      await window.api.invoke(IPC.HF_DOWNLOAD_GGUF, model.repoId, model.filename, model.id)
    } catch (err) {
      setDownloadingFile(null)
      console.error('Download failed:', err)
    }
  }

  const handleDownloadSearch = async (repoId: string, filename: string) => {
    setDownloadingFile(filename)
    setGgufDownloadProgress((prev) => ({ ...prev, [filename]: 0 }))
    try {
      await window.api.invoke(IPC.HF_DOWNLOAD_GGUF, repoId, filename, null)
    } catch (err) {
      setDownloadingFile(null)
      console.error('Download failed:', err)
    }
  }

  const handleSelectGgufModel = async (filename: string) => {
    await updateSetting('refinementModelSource', 'downloaded')
    await updateSetting('refinementModelPath', `gguf://${filename}`)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await window.api.invoke(IPC.HF_SEARCH_MODELS, searchQuery) as HfModelSearchResult[]
      setSearchResults(results)
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  const toggleRepoFiles = async (repoId: string) => {
    if (expandedRepo === repoId) { setExpandedRepo(null); return }
    setExpandedRepo(repoId)
    if (!repoFiles[repoId]) {
      try {
        const files = await window.api.invoke(IPC.HF_GET_MODEL_FILES, repoId) as string[]
        setRepoFiles((prev) => ({ ...prev, [repoId]: files }))
      } catch {
        setRepoFiles((prev) => ({ ...prev, [repoId]: [] }))
      }
    }
  }

  const isFileDownloaded = (filename: string) => downloadedGguf.some((m) => m.filename === filename)
  const isSelectedFile = (filename: string) => settings.refinementModelPath === `gguf://${filename}`
  const source = settings.refinementModelSource

  return (
    <div className="space-y-8">
      {/* ── Whisper Model Section ── */}
      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-1">Transcription Model</h3>
        <p className="text-sm text-text-secondary mb-4">Choose the local whisper.cpp model for speech-to-text</p>
        <div className="space-y-3">
          {(Object.keys(MODEL_INFO) as LocalModel[]).map((model) => {
            const info = MODEL_INFO[model]
            const isSelected = settings.localModel === model
            const isDownloading = downloading === model
            const isDownloaded = downloadedModels.has(model)
            const progress = downloadProgress[model]

            return (
              <button
                key={model}
                onClick={() => isDownloaded && updateSetting('localModel', model)}
                className={`
                  w-full p-4 rounded-xl border text-left transition-all
                  ${isSelected
                    ? 'border-selection bg-selection'
                    : 'border-border-custom bg-surface hover:border-border-hover'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`
                      w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${isSelected ? 'border-accent' : 'border-border-hover'}
                    `}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-accent" />}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">{info.name}</div>
                      <div className="text-sm text-text-secondary">{info.description}</div>
                      <div className="text-xs text-text-muted mt-1">{info.size}</div>
                    </div>
                  </div>
                  {isDownloading ? (
                    <div className="ml-4 w-32">
                      <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                        <span>Downloading</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-border-custom rounded-full overflow-hidden">
                        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  ) : isDownloaded ? (
                    <span className="ml-4 flex items-center gap-1 text-sm text-success">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Downloaded
                    </span>
                  ) : (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDownloadModel(model) }}
                      className="ml-4 px-3 py-1.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle transition-colors"
                    >
                      Download
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── AI Refinement Section ── */}
      <section className="border-t border-border-custom pt-8">
        <div className="flex items-center justify-between p-4 rounded-xl border border-border-custom bg-surface">
          <div>
            <h3 className="font-medium text-text-primary">AI Refinement</h3>
            <p className="text-sm text-text-secondary mt-1">Clean up transcription with a local AI model</p>
          </div>
          <ToggleSwitch
            checked={settings.refinementEnabled}
            onChange={(checked) => updateSetting('refinementEnabled', checked)}
          />
        </div>

        {settings.refinementEnabled && (
          <div className="mt-6 space-y-6">
            {/* Source tabs */}
            <div className="flex border-b border-border-custom">
              <button
                onClick={() => updateSetting('refinementModelSource', 'downloaded')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  source === 'downloaded' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Downloaded
              </button>
              <button
                onClick={() => updateSetting('refinementModelSource', 'manual')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  source === 'manual' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Manual Path
              </button>
            </div>

            {source === 'downloaded' && (
              <>
                {/* HF Token */}
                <div className="p-4 rounded-xl border border-border-custom bg-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[15px] font-semibold text-text-primary">Hugging Face Token</h4>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Required for downloading models. Some models need a token to accept their license first.
                  </p>
                  {hfTokenSaved && !showTokenInput ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-success font-medium">Token saved</span>
                      <button onClick={() => setShowTokenInput(true)} className="text-sm text-accent hover:text-accent-hover">Edit</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={hfToken}
                        onChange={(e) => setHfToken(e.target.value)}
                        placeholder="hf_..."
                        className="flex-1 px-3 py-2 border border-border-custom rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-surface font-mono text-sm"
                        spellCheck={false}
                      />
                      <button
                        onClick={saveToken}
                        disabled={!hfToken.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {/* Curated models */}
                <div>
                  <h4 className="text-[15px] font-semibold text-text-primary mb-4">Recommended Models</h4>
                  <div className="space-y-3">
                    {CURATED_GGUF_MODELS.map((model) => {
                      const dl = isFileDownloaded(model.filename)
                      const selected = isSelectedFile(model.filename)
                      const downloading = downloadingFile === model.filename
                      const progress = ggufDownloadProgress[model.filename] ?? 0

                      return (
                        <div
                          key={model.id}
                          className={`p-4 rounded-xl border transition-all ${
                            selected ? 'border-selection bg-selection' : 'border-border-custom bg-surface'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`
                                w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                ${selected ? 'border-accent' : 'border-border-hover'}
                              `}>
                                {selected && <div className="w-2 h-2 rounded-full bg-accent" />}
                              </div>
                              <div>
                                <div className="font-medium text-text-primary">{model.name}</div>
                                <div className="text-sm text-text-secondary">{model.description}</div>
                                <div className="text-xs text-text-muted mt-1">{model.size}</div>
                              </div>
                            </div>
                            {downloading ? (
                              <div className="ml-4 w-32">
                                <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                                  <span>Downloading</span>
                                  <span>{progress}%</span>
                                </div>
                                <div className="h-2 bg-border-custom rounded-full overflow-hidden">
                                  <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            ) : dl ? (
                              <span className="ml-4 flex items-center gap-1 text-sm text-success">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Downloaded
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDownloadCurated(model)}
                                className="ml-4 px-3 py-1.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle transition-colors"
                              >
                                Download
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Search */}
                <div>
                  <button
                    onClick={() => setSearchExpanded(!searchExpanded)}
                    className="flex items-center gap-2 text-[15px] font-semibold text-text-primary w-full"
                  >
                    <svg className={`w-4 h-4 transition-transform ${searchExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Search Hugging Face
                  </button>
                  {searchExpanded && (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          placeholder="Search GGUF models..."
                          className="flex-1 px-3 py-2 border border-border-custom rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-sm"
                          spellCheck={false}
                        />
                        <button
                          onClick={handleSearch}
                          disabled={searching || !searchQuery.trim()}
                          className="px-4 py-2 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle disabled:opacity-50 transition-colors"
                        >
                          {searching ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                      {searchResults.length > 0 && (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {searchResults.map((result) => (
                            <div key={result.id} className="p-3 rounded-lg border border-border-custom bg-surface">
                              <button onClick={() => toggleRepoFiles(result.id)} className="w-full text-left">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-mono text-text-primary">{result.id}</span>
                                  <span className="text-xs text-text-muted">{(result.downloads / 1000).toFixed(1)}k downloads</span>
                                </div>
                              </button>
                              {expandedRepo === result.id && (
                                <div className="mt-2 space-y-1">
                                  {repoFiles[result.id] === undefined ? (
                                    <span className="text-xs text-text-muted">Loading files...</span>
                                  ) : repoFiles[result.id].length === 0 ? (
                                    <span className="text-xs text-text-muted">No GGUF files found</span>
                                  ) : (
                                    repoFiles[result.id].map((file) => {
                                      const fileDl = isFileDownloaded(file)
                                      return (
                                        <div key={file} className="flex items-center justify-between py-1">
                                          <span className="text-xs font-mono text-text-secondary truncate mr-2">{file}</span>
                                          {fileDl ? (
                                            <span className="text-xs text-success flex-shrink-0">Downloaded</span>
                                          ) : (
                                            <button
                                              onClick={() => handleDownloadSearch(result.id, file)}
                                              disabled={downloadingFile === file}
                                              className="text-xs text-accent hover:text-accent-hover flex-shrink-0 disabled:opacity-50"
                                            >
                                              {downloadingFile === file ? `${ggufDownloadProgress[file] ?? 0}%` : 'Download'}
                                            </button>
                                          )}
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {source === 'manual' && (
              <div>
                <h4 className="text-[15px] font-semibold text-text-primary mb-2">Model File (GGUF)</h4>
                <p className="text-xs text-text-secondary mb-3">Paste the absolute path to a GGUF file on your machine.</p>
                <input
                  type="text"
                  value={settings.refinementModelPath}
                  onChange={(e) => updateSetting('refinementModelPath', e.target.value)}
                  placeholder="/path/to/model.gguf"
                  className="w-full px-3 py-2 border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-accent bg-surface font-mono text-sm"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Server status */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">llama-server status</span>
              <span className={`text-sm font-medium ${STATUS_LABELS[llamaStatus].color}`}>
                {STATUS_LABELS[llamaStatus].label}
              </span>
            </div>

            {/* Intensity */}
            <div>
              <h4 className="text-[15px] font-semibold text-text-primary mb-4">Intensity</h4>
              <div className="space-y-3">
                {(Object.keys(INTENSITY_INFO) as RefinementIntensity[]).map((intensity) => {
                  const info = INTENSITY_INFO[intensity]
                  const isSelected = settings.refinementIntensity === intensity
                  return (
                    <button
                      key={intensity}
                      onClick={() => updateSetting('refinementIntensity', intensity)}
                      className={`
                        w-full p-4 rounded-xl border text-left transition-all
                        ${isSelected ? 'border-selection bg-selection' : 'border-border-custom bg-surface hover:border-border-hover'}
                      `}
                    >
                      <div className="font-medium text-text-primary">{info.name}</div>
                      <div className="text-sm text-text-secondary mt-1">{info.description}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!settings.refinementEnabled && (
          <div className="mt-6 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-canvas mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm font-medium">Enable refinement and download a model</p>
            <p className="text-text-muted text-xs mt-1.5">to activate local AI cleanup</p>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Delete old ModelPage and AIPage**

```bash
rm src/renderer/src/views/home/ModelPage.tsx src/renderer/src/views/home/AIPage.tsx
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Build succeeds. The merged page compiles and Home.tsx references it correctly.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/views/home/TranscriptionPage.tsx src/renderer/src/views/home/ModelPage.tsx src/renderer/src/views/home/AIPage.tsx
git commit -m "feat: merge Model+AI into TranscriptionPage with new design tokens"
```

---

### Task 3: Rewrite DictionaryPage

**Files:**
- Modify: `src/renderer/src/views/home/DictionaryPage.tsx`

- [ ] **Step 1: Replace `DictionaryPage.tsx`**

Key changes: delete buttons use ghost style with hover-only visibility, standardized empty state, updated token references.

```tsx
import React, { useState, useEffect } from 'react'
import type { AppSettings, DictionaryEntry } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

export function DictionaryPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')

  useEffect(() => {
    const load = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    load()
    const unsub = window.api.on(IPC.SETTINGS_UPDATED, () => load())
    return () => { unsub() }
  }, [])

  const dictionary = settings.dictionary || []

  const addEntry = async () => {
    if (!newFrom.trim() || !newTo.trim()) return
    const entry: DictionaryEntry = {
      id: crypto.randomUUID(),
      from: newFrom.trim(),
      to: newTo.trim(),
    }
    const updated = [...dictionary, entry]
    setSettings(prev => ({ ...prev, dictionary: updated }))
    await window.api.invoke(IPC.SET_SETTING, 'dictionary', updated)
    setNewFrom('')
    setNewTo('')
  }

  const removeEntry = async (id: string) => {
    const updated = dictionary.filter(e => e.id !== id)
    setSettings(prev => ({ ...prev, dictionary: updated }))
    await window.api.invoke(IPC.SET_SETTING, 'dictionary', updated)
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-1">Custom Dictionary</h3>
        <p className="text-sm text-text-secondary mb-4">
          Add word replacements that are automatically applied to transcriptions. Useful for names, technical terms, or common misrecognitions.
        </p>

        <div className="flex items-end gap-2 mb-6">
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">When you say</label>
            <input
              type="text"
              value={newFrom}
              onChange={(e) => setNewFrom(e.target.value)}
              placeholder="e.g., tablty"
              className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              onKeyDown={(e) => { if (e.key === 'Enter') addEntry() }}
              aria-label="Word to replace"
            />
          </div>
          <svg className="w-4 h-4 text-text-muted mb-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">Replace with</label>
            <input
              type="text"
              value={newTo}
              onChange={(e) => setNewTo(e.target.value)}
              placeholder="e.g., tabletly"
              className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              onKeyDown={(e) => { if (e.key === 'Enter') addEntry() }}
              aria-label="Replacement word"
            />
          </div>
          <button
            onClick={addEntry}
            disabled={!newFrom.trim() || !newTo.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {dictionary.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-canvas mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm font-medium">No dictionary entries yet</p>
            <p className="text-text-muted text-xs mt-1.5">Add words above to auto-fix common misrecognitions</p>
          </div>
        ) : (
          <div className="divide-y divide-border-custom">
            {dictionary.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-3 group">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-primary">{entry.from}</span>
                  <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className="text-sm text-accent font-medium">{entry.to}</span>
                </div>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/home/DictionaryPage.tsx
git commit -m "feat: redesign DictionaryPage — ghost delete buttons, standardized empty state"
```

---

### Task 4: Rewrite HistoryPage

**Files:**
- Modify: `src/renderer/src/views/home/HistoryPage.tsx`

- [ ] **Step 1: Replace `HistoryPage.tsx`**

Key changes: Clear All uses ghost style with danger hover, confirmation uses danger-subtle alert, action buttons use ghost with hover-reveal, badges use token styles, copied state uses accent tokens, raw highlight uses warning-subtle.

```tsx
import React, { useState, useEffect, useMemo } from 'react'
import type { TranscriptionEntry } from '@shared/types'
import { IPC } from '@shared/ipc'

export function HistoryPage(): React.ReactElement {
  const [history, setHistory] = useState<TranscriptionEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showingRaw, setShowingRaw] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const loadHistory = async () => {
      const loaded = await window.api.invoke(IPC.GET_HISTORY) as TranscriptionEntry[]
      setHistory(loaded.sort((a, b) => b.timestamp - a.timestamp))
    }
    loadHistory()
    const unsubscribe = window.api.on(IPC.HISTORY_UPDATED, () => { loadHistory() })
    return () => { unsubscribe() }
  }, [])

  const handleClearAll = async () => {
    await window.api.invoke('history:clear')
    setHistory([])
    setShowClearConfirm(false)
  }

  const formatTimestamp = (timestamp: number): string => {
    const now = new Date()
    const date = new Date(timestamp)
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    const isToday = now.toDateString() === date.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = yesterday.toDateString() === date.toDateString()
    if (isToday) return `today at ${timeStr}`
    if (isYesterday) return `yesterday at ${timeStr}`
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`
  }

  const getProviderBadge = (provider: string): { label: string; className: string } => {
    const badges: Record<string, { label: string; className: string }> = {
      local: { label: 'Local', className: 'bg-canvas text-text-muted' },
      openai: { label: 'OpenAI', className: 'bg-canvas text-text-muted' },
      google: { label: 'Google', className: 'bg-canvas text-text-muted' },
    }
    return badges[provider] ?? badges.local
  }

  const formatMetadata = (entry: TranscriptionEntry): string | null => {
    const parts: string[] = []
    if (entry.transcriptionModel) parts.push(entry.transcriptionModel)
    if (entry.transcriptionDurationMs != null) parts.push(`${(entry.transcriptionDurationMs / 1000).toFixed(1)}s`)
    if (entry.refinementModel) {
      const label = entry.refinementDurationMs != null
        ? `${entry.refinementModel} (${(entry.refinementDurationMs / 1000).toFixed(1)}s)`
        : entry.refinementModel
      parts.push(`Refined by ${label}`)
    }
    return parts.length > 0 ? parts.join(' \u00b7 ') : null
  }

  const filteredHistory = history.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = useMemo(() => {
    if (history.length === 0) return null
    const totalWords = history.reduce((sum, e) => sum + e.wordCount, 0)
    const sessions = history.length
    const validWpmEntries = history.filter((e) => e.audioDurationMs >= 1000)
    const avgWpm = validWpmEntries.length > 0
      ? validWpmEntries.reduce((sum, e) => sum + e.wordCount / (e.audioDurationMs / 60000), 0) / validWpmEntries.length
      : 0
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = history.filter((e) => e.timestamp >= todayStart.getTime()).length
    return { totalWords, sessions, avgWpm: Math.round(avgWpm * 10) / 10, todayCount }
  }, [history])

  const copyToClipboard = (text: string, entryId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(entryId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Search + Clear */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcriptions..."
            aria-label="Search transcriptions"
            className="w-full pl-11 pr-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-sm"
          />
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            aria-label="Clear all history"
            className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="flex items-start gap-3 p-4 bg-danger-subtle border border-[#e8c4c4] rounded-lg">
          <svg className="w-5 h-5 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-text-primary mb-3">Are you sure you want to clear all history? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-canvas rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="text-sm text-text-muted">{stats.totalWords.toLocaleString()} words across {stats.sessions} sessions</div>
      )}

      {/* Entries */}
      {filteredHistory.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-canvas mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-text-secondary text-sm font-medium">
            {searchQuery ? 'No transcriptions match your search' : 'No transcriptions yet'}
          </p>
          <p className="text-text-muted text-xs mt-1.5">
            {searchQuery ? 'Try a different search term' : 'Start dictating to see your history here'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-custom">
          {filteredHistory.map((entry) => {
            const providerBadge = getProviderBadge(entry.transcriptionProvider)
            const isShowingRaw = showingRaw.has(entry.id)
            const hasRefinement = entry.rawText && entry.rawText !== entry.text
            const displayText = isShowingRaw ? entry.rawText : entry.text

            return (
              <div
                key={entry.id}
                className={`py-4 group transition-colors ${isShowingRaw ? 'bg-warning-subtle/30 -mx-2 px-2 rounded-lg' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary leading-relaxed whitespace-pre-wrap text-[13px]">{displayText}</p>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${providerBadge.className}`}>
                        {providerBadge.label}
                      </span>
                      {hasRefinement && !isShowingRaw && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-accent-subtle text-accent">Refined</span>
                      )}
                      {isShowingRaw && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-warning-subtle text-warning">Original</span>
                      )}
                      <span className="text-[11px] text-text-muted">{formatTimestamp(entry.timestamp)}</span>
                      <span className="text-[11px] text-text-muted">{entry.wordCount} words</span>
                    </div>
                    {formatMetadata(entry) && (
                      <div className="text-[11px] text-text-muted mt-0.5">{formatMetadata(entry)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasRefinement && (
                      <button
                        onClick={() => {
                          setShowingRaw((prev) => {
                            const next = new Set(prev)
                            if (next.has(entry.id)) next.delete(entry.id)
                            else next.add(entry.id)
                            return next
                          })
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          isShowingRaw
                            ? 'text-warning bg-warning-subtle'
                            : 'text-text-muted hover:text-warning hover:bg-warning-subtle opacity-0 group-hover:opacity-100 focus:opacity-100'
                        }`}
                        title={isShowingRaw ? 'Show refined text' : 'Show original transcription'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {isShowingRaw ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          )}
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => copyToClipboard(displayText, entry.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        copiedId === entry.id
                          ? 'text-accent bg-accent-subtle'
                          : 'text-text-muted hover:text-accent hover:bg-accent-subtle opacity-0 group-hover:opacity-100 focus:opacity-100'
                      }`}
                      title={copiedId === entry.id ? 'Copied!' : 'Copy to clipboard'}
                    >
                      {copiedId === entry.id ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/home/HistoryPage.tsx
git commit -m "feat: redesign HistoryPage — token-based alerts, ghost actions, standardized badges"
```

---

## Self-Review

**Spec coverage:**
- Section 3 (Component patterns): Settings rows (Task 1), selectable cards (Task 2), alert banners (Tasks 1, 4), buttons (all tasks), input fields (all tasks), progress bars (Task 2), empty states (Tasks 3, 4), badges (Task 4)
- Section 4 (Page-by-page): General (Task 1), Transcription merged (Task 2), Dictionary (Task 3), History (Task 4)
- Section 5 (Files): All files listed are handled

**Placeholder scan:** No TBDs, TODOs, or "implement later". All code is complete.

**Type consistency:** `HomePage` type `'general' | 'transcription' | 'dictionary' | 'history'` matches usage across all pages. `AppSettings`, `LocalModel`, `RefinementIntensity`, `LlamaServerStatus` types used consistently with their definitions in `types.ts`.
