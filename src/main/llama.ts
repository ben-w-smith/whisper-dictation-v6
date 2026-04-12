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
      if (!settled && (text.includes('listening') || text.includes('HTTP server listening'))) {
        consecutiveFailures = 0
        broadcast('ready')
        console.log('[Llama] Server ready on port', LLAMA_SERVER_PORT)
        settle()
      }
    })

    llamaProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
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
        consecutiveFailures++
        broadcast('error')
        settle(new Error(`llama-server exited with code ${code} during startup`))
        return
      }

      if (!wasReady) return

      consecutiveFailures++
      console.warn(`[Llama] Unexpected exit (failures: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`)

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        broadcast('crashed')
        dialog.showErrorBox(
          'AI Refinement Unavailable',
          `The llama-server process crashed ${consecutiveFailures} times in a row and will not be restarted automatically.\n\nCheck that your GGUF model file is valid and not corrupted. You can re-enable refinement by changing the model path in Settings \u2192 AI.`
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
    consecutiveFailures = 0
    if (currentModelPath) {
      setTimeout(() => {
        startLlamaServer(currentModelPath!).catch(console.error)
      }, 1500)
    }
  })
}
