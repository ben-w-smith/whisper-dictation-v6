import { ipcMain, shell, BrowserWindow, screen, Tray, app, systemPreferences } from 'electron'
import { join } from 'path'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { createWriteStream, renameSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import https from 'node:https'
import { IPC } from '@shared/ipc'
import { transcribeAudio, isModelDownloaded, getDownloadedModels, setMockTranscriptionResult } from './whisper'
import { refineText } from './refine'
import { writeToClipboard, autoPaste } from './clipboard'
import { getSettings, setSetting, getHistory, saveHistoryEntry, clearHistory } from './store'
import { createError } from '@shared/errors'
import { checkAllPermissions, requestMicrophonePermission } from './permissions'
import { openHomeWindow, openAboutWindow } from './tray'
import { setLastTranscription, updateTrayState } from './tray'
import { updateShortcut, pauseHotkey, resumeHotkey } from './hotkeys'
import type { AppSettings, TranscriptionEntry } from '@shared/types'
import type { LocalModel } from '@shared/types'

type WindowMode = 'onboarding' | 'overlay' | 'hidden'

let trayRef: Tray | null = null

/**
 * Set the tray reference so IPC handlers can update tray state
 */
export function setTrayRef(tray: Tray): void {
  trayRef = tray
}

/**
 * Register all IPC handlers for the main process
 * Call this once during app initialization
 */
export function registerIpcHandlers(): void {

  // Relay overlay state updates from background window to overlay window
  ipcMain.on('overlay:state-update', (_event, data: unknown) => {
    const overlayWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Overlay')
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send('overlay:state-update', data)
    }
  })

  // Update tray icon/tooltip based on pipeline state
  ipcMain.on(IPC.UPDATE_TRAY_STATE, (_event, state: string) => {
    if (trayRef) {
      updateTrayState(trayRef, state)
    }
  })

  // Relay overlay dismiss (complete/error click) from overlay window to background window
  ipcMain.on(IPC.OVERLAY_DISMISS, (_event, data: { action: 'COMPLETE_ACKNOWLEDGED' | 'ERROR_DISMISSED' }) => {
    const bgWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Dictation')
    if (bgWin && !bgWin.isDestroyed()) {
      bgWin.webContents.send(IPC.OVERLAY_DISMISS, data)
    }
  })

  // Relay overlay:ready from overlay window to background window so it can push current state
  ipcMain.on(IPC.OVERLAY_READY, () => {
    const bgWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Dictation')
    if (bgWin && !bgWin.isDestroyed()) {
      bgWin.webContents.send(IPC.OVERLAY_READY)
    }
  })

  // Window mode management — renderer tells main how to display the main window
  ipcMain.handle(IPC.SET_WINDOW_MODE, (_event, mode: WindowMode): void => {
    const wins = BrowserWindow.getAllWindows()
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

    // Find the main background window (title = APP_NAME)
    const mainWin = wins.find(w => w.getTitle() === 'Whisper Dictation')

    switch (mode) {
      case 'onboarding': {
        // Open a dedicated onboarding window (separate from the hidden background window)
        const existing = wins.find(w => w.getTitle() === 'Onboarding')
        if (existing) {
          existing.focus()
          return
        }

        const onboardingWin = new BrowserWindow({
          width: 520,
          height: 640,
          show: true,
          resizable: false,
          title: 'Onboarding',
          center: true,
          webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
          },
        })

        const rendererUrl = process.env['ELECTRON_RENDERER_URL']
        if (rendererUrl) {
          onboardingWin.loadURL(`${rendererUrl}/#onboarding`)
        } else {
          onboardingWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'onboarding' })
        }
        onboardingWin.on('page-title-updated', (e) => {
          e.preventDefault()
          onboardingWin.setTitle('Onboarding')
        })
        break
      }

      case 'overlay': {
        // Show or create the overlay window
        let overlayWin = wins.find(w => w.getTitle() === 'Whisper Overlay')
        if (!overlayWin) {
          overlayWin = new BrowserWindow({
            width: 440,
            height: 100,
            show: true,
            frame: false,
            transparent: true,
            resizable: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            focusable: false,
            x: Math.round((screenWidth - 440) / 2),
            y: 24,
            title: 'Whisper Overlay',
            webPreferences: {
              preload: join(__dirname, '../preload/index.js'),
              contextIsolation: true,
              nodeIntegration: false,
            },
          })

          const rendererUrl = process.env['ELECTRON_RENDERER_URL']
          if (rendererUrl) {
            overlayWin.loadURL(`${rendererUrl}/#overlay`)
          } else {
            overlayWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
          }
          // Prevent the HTML <title> from overwriting the window title,
          // which would break IPC relay lookups that find this window by title.
          overlayWin.on('page-title-updated', (e) => {
            e.preventDefault()
          })
        } else {
          overlayWin.show()
        }
        break
      }

      case 'hidden': {
        // Hide overlay window if it exists
        const overlayWin = wins.find(w => w.getTitle() === 'Whisper Overlay')
        overlayWin?.hide()
        break
      }
    }
  })

  // Get current settings
  ipcMain.handle(IPC.GET_SETTINGS, async (): Promise<AppSettings> => {
    return await getSettings()
  })

  // Update a single setting
  ipcMain.handle(IPC.SET_SETTING, async (_event, key: keyof AppSettings, value: unknown): Promise<void> => {
    await setSetting(key, value as AppSettings[typeof key])

    // Re-register global hotkey when shortcut changes
    if (key === 'keyboardShortcut') {
      const mainWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Dictation')
      if (mainWin) {
        updateShortcut(value as string, () => {
          mainWin.webContents.send(IPC.HOTKEY_TRIGGERED)
        })
      }
    }

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

    // Notify all windows of settings update
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC.SETTINGS_UPDATED, { key, value })
    })
  })

  // Start transcription — receives base64-encoded WAV from renderer
  ipcMain.handle(IPC.START_WHISPER, async (_event, base64Wav: string, model: LocalModel): Promise<string> => {
    // Get current settings for provider and API key
    const settings = await getSettings()

    // Decode base64 to buffer and write to temp file
    const wavBuffer = Buffer.from(base64Wav, 'base64')
    const tempDir = join(tmpdir(), 'whisper-dictation')
    await mkdir(tempDir, { recursive: true })
    const audioPath = join(tempDir, `${randomUUID()}.wav`)
    let tempFile: string | null = audioPath

    try {
      await writeFile(audioPath, wavBuffer)

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

      // Apply AI refinement if enabled
      let finalText = result.text
      let refinementSkipped = false
      if (settings.refinementEnabled && settings.refinementModelPath) {
        try {
          finalText = await refineText(result.text, settings)
        } catch (error) {
          console.warn('[IPC] Refinement failed, using original:', error)
          refinementSkipped = true
        }
      }

      // Send success result — include rawText (pre-refinement) separately from text (final)
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.WHISPER_RESULT, { ...result, text: finalText, rawText: result.text })
        }
      })

      // Notify renderer if AI refinement was skipped
      if (refinementSkipped) {
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC.REFINEMENT_SKIPPED, {
              reason: 'Refinement failed or API key not configured, using original transcription',
            })
          }
        })
      }

      // Store for "Copy Last Transcription" tray menu item
      setLastTranscription(finalText)

      return finalText
    } catch (error) {
      const appError = error instanceof Error && 'code' in error
        ? error as { code: string; message: string; suggestion: string }
        : createError('TRANSCRIPTION_FAILED', {
            message: error instanceof Error ? error.message : 'Unknown error',
          })

      // Send error to renderer
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.WHISPER_ERROR, appError)
        }
      })

      throw appError
    } finally {
      // Clean up temp file
      if (tempFile) {
        unlink(tempFile).catch(() => {})
      }
    }
  })

  // Write text to clipboard
  ipcMain.handle(IPC.WRITE_CLIPBOARD, async (_event, text: string): Promise<void> => {
    await writeToClipboard(text)
  })

  // Auto-paste (Cmd+V simulation)
  ipcMain.handle(IPC.AUTO_PASTE, async (): Promise<void> => {
    await autoPaste()
  })

  // Refine text using AI
  ipcMain.handle(IPC.REFINE_TEXT, async (_event, text: string): Promise<string> => {
    const settings = await getSettings()
    return await refineText(text, settings)
  })

  // Save transcription entry to history
  ipcMain.handle(IPC.SAVE_HISTORY, (_event, entry: TranscriptionEntry): void => {
    saveHistoryEntry(entry)
    // Notify all windows that history has been updated
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.HISTORY_UPDATED, entry)
      }
    })
  })

  // Get transcription history
  ipcMain.handle(IPC.GET_HISTORY, (): TranscriptionEntry[] => {
    return getHistory()
  })

  // Clear history
  ipcMain.handle('history:clear', (): void => {
    clearHistory()
  })

  // Request microphone permission via native macOS TCC dialog.
  // Must be called through systemPreferences.askForMediaAccess — getUserMedia alone
  // is not sufficient on macOS 15 and returns silence until TCC grants access.
  ipcMain.handle(IPC.REQUEST_MICROPHONE, async (): Promise<boolean> => {
    return requestMicrophonePermission()
  })

  // Request accessibility permission — opens macOS system prompt
  ipcMain.on(IPC.REQUEST_ACCESSIBILITY, () => {
    systemPreferences.isTrustedAccessibilityClient(true)
  })

  // Check permissions using the permissions module
  ipcMain.handle(IPC.CHECK_PERMISSIONS, async (): Promise<{
    microphone: 'granted' | 'denied' | 'prompt'
    accessibility: 'granted' | 'denied' | 'prompt'
  }> => {
    return checkAllPermissions()
  })

  // Get list of already-downloaded model names
  ipcMain.handle(IPC.GET_DOWNLOADED_MODELS, (): string[] => {
    return getDownloadedModels()
  })

  // Download a whisper model — writes to .tmp, renames atomically on success
  ipcMain.handle(IPC.DOWNLOAD_MODEL, async (_event, model: LocalModel): Promise<void> => {
    // Check if already downloaded
    if (isModelDownloaded(model)) {
      return
    }

    const userDataPath = app.getPath('userData')
    const modelDir = join(userDataPath, 'models')
    const modelPath = join(modelDir, `${model}.bin`)
    const tempPath = `${modelPath}.tmp`

    // Ensure models directory exists
    await mkdir(modelDir, { recursive: true })

    // Hugging Face model URLs
    const baseUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'
    const url = `${baseUrl}/ggml-${model}.bin`

    return new Promise((resolve, reject) => {
      const notifyProgress = (loaded: number, total: number) => {
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC.DOWNLOAD_PROGRESS, {
              model,
              loaded,
              total,
              percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
            })
          }
        })
      }

      const MAX_REDIRECTS = 5

      const followRedirects = (redirectUrl: string, remaining: number): void => {
        if (remaining <= 0) {
          reject(new Error('Too many redirects'))
          return
        }

        https.get(redirectUrl, (response) => {
          const statusCode = response.statusCode

          // Follow redirects (301, 302, 307, 308)
          if (statusCode && statusCode >= 300 && statusCode < 400) {
            const location = response.headers['location']
            if (!location) {
              reject(new Error(`Redirect (${statusCode}) with no Location header`))
              return
            }
            response.resume() // drain the response
            followRedirects(location, remaining - 1)
            return
          }

          if (statusCode !== 200) {
            reject(new Error(`Failed to download model: ${statusCode}`))
            return
          }

          const total = parseInt(response.headers['content-length'] || '0', 10)
          let loaded = 0

          const fileStream = createWriteStream(tempPath)

          response.on('data', (chunk: Buffer) => {
            loaded += chunk.length
            notifyProgress(loaded, total)
          })

          response.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close()

            // Rename atomically — remove any existing corrupt file first
            try { unlinkSync(modelPath) } catch {}
            renameSync(tempPath, modelPath)

            // Notify completion
            BrowserWindow.getAllWindows().forEach((win) => {
              if (!win.isDestroyed()) {
                win.webContents.send(IPC.DOWNLOAD_COMPLETE, model)
              }
            })

            resolve()
          })

          fileStream.on('error', (error: Error) => {
            // Clean up temp file on error
            try { unlinkSync(tempPath) } catch {}
            reject(error)
          })
        }).on('error', (error: Error) => {
          // Clean up temp file on network error
          try { unlinkSync(tempPath) } catch {}
          reject(error)
        })
      }

      followRedirects(url, MAX_REDIRECTS)
    })
  })

  // Open home window
  ipcMain.handle(IPC.OPEN_SETTINGS, async (): Promise<void> => {
    openHomeWindow()
  })

  // Open about window
  ipcMain.handle(IPC.OPEN_ABOUT, async (): Promise<void> => {
    openAboutWindow()
  })

  // Get app version
  ipcMain.handle('app:version', (): string => {
    return app.getVersion()
  })

  // Pause global hotkey while the shortcut recorder is active — prevents the
  // existing hotkey from triggering recording while the user presses it to assign.
  ipcMain.on(IPC.PAUSE_HOTKEY, () => {
    pauseHotkey()
  })

  // Resume global hotkey after the shortcut recorder closes
  ipcMain.on(IPC.RESUME_HOTKEY, () => {
    const mainWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Dictation')
    if (mainWin) {
      resumeHotkey(() => {
        mainWin.webContents.send(IPC.HOTKEY_TRIGGERED)
      })
    }
  })

  // Quit application
  ipcMain.handle(IPC.QUIT_APP, (): void => {
    app.quit()
  })

  // Open external links in default browser
  ipcMain.handle('open-external', async (_event, url: string): Promise<void> => {
    await shell.openExternal(url)
  })

  // Open relevant macOS System Settings pane — deep-links to the right panel
  // so the user doesn't have to hunt for it themselves.
  ipcMain.handle(IPC.OPEN_SYSTEM_SETTINGS, async (_event, pane: 'microphone' | 'accessibility'): Promise<void> => {
    const urls: Record<string, string> = {
      microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    }
    await shell.openExternal(urls[pane] ?? urls.microphone)
  })

  // Debug: relay debug bus query from any renderer to background window
  ipcMain.handle(IPC.DEBUG_QUERY, async (_event, filter?: { source?: string; event?: string; since?: number }): Promise<unknown[]> => {
    const bgWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Dictation')
    if (!bgWin || bgWin.isDestroyed()) return []
    return await bgWin.webContents.executeJavaScript(
      `window.__debugBus ? window.__debugBus.query(${JSON.stringify(filter ?? {})}) : []`
    )
  })

  // Test-only channels — only registered in test environment
  if (process.env.NODE_ENV === 'test') {
    // Mock whisper transcription result
    ipcMain.handle(IPC.TEST_MOCK_TRANSCRIPTION, async (_event, text: string): Promise<void> => {
      setMockTranscriptionResult(text)
    })

    // Read clipboard contents (for assertions)
    ipcMain.handle(IPC.TEST_READ_CLIPBOARD, async (): Promise<string> => {
      const { clipboard } = await import('electron')
      return clipboard.readText()
    })

    // Complete onboarding without going through the UI
    ipcMain.handle(IPC.TEST_COMPLETE_ONBOARDING, async (): Promise<void> => {
      await setSetting('onboardingComplete' as keyof AppSettings, true as unknown as AppSettings[keyof AppSettings])
      // Notify all windows
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.SETTINGS_UPDATED, { key: 'onboardingComplete', value: true })
        }
      })
    })
  }
}
