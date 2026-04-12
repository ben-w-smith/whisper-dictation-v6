import { app, BrowserWindow, Tray, screen, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IPC } from '@shared/ipc'
import { APP_NAME, DEFAULT_SETTINGS } from '@shared/constants'

// Main process services
import { createTrayMenu, updateTrayState } from './tray'
import { registerHotkeys, registerMouseButton, unregisterHotkeys, updateShortcut } from './hotkeys'
import { registerIpcHandlers, setTrayRef } from './ipc'
import { getSettings } from './store'
import { requestMicrophonePermission } from './permissions'
import { startLlamaServer, stopLlamaServer, registerPowerMonitor } from './llama'

// Allow AudioContext to start without user gesture — required because recording
// is triggered by a global hotkey (via IPC), not a direct click in the renderer.
// Without this, Chromium suspends the AudioContext and resume() fails silently
// in windows that have never received user interaction (like our hidden background window).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createTray(): Tray {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Whisper Dictation')

  if (mainWindow) {
    createTrayMenu(tray, mainWindow)
  }

  return tray
}

function getRendererUrl(hash?: string): string | null {
  const baseUrl = process.env['ELECTRON_RENDERER_URL']
  if (baseUrl) {
    return hash ? `${baseUrl}/#${hash}` : baseUrl
  }
  return null
}

function createWindow(): void {
  // Hidden background window — hosts the state machine and IPC
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  // Prevent Chromium from throttling timers and audio processing in the
  // hidden background window. Without this, the ScriptProcessorNode that
  // captures microphone audio can be paused or rate-limited when the window
  // is not visible.
  mainWindow.webContents.setBackgroundThrottling(false)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the renderer
  const url = getRendererUrl()
  if (url) {
    mainWindow.loadURL(url)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Auto-open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // Update tray menu once window is created
  if (tray) {
    createTrayMenu(tray, mainWindow)
  }
}

async function setupHotkeys(): Promise<void> {
  if (!mainWindow) return

  const settings = await getSettings()
  const shortcut = settings.keyboardShortcut || DEFAULT_SETTINGS.keyboardShortcut
  const mouseButton = settings.mouseButton

  const callback = () => {
    mainWindow?.webContents.send(IPC.HOTKEY_TRIGGERED)
  }

  // Try to register mouse button first if set, otherwise use keyboard
  if (mouseButton !== null) {
    // Note: Mouse button support requires native module (iohook)
    // For MVP, this will log a warning and we'll fall back to keyboard
    const mouseSuccess = registerMouseButton(mouseButton, callback)
    if (!mouseSuccess) {
      // Fall back to keyboard shortcut
      const keyboardSuccess = registerHotkeys(shortcut, callback)
      if (!keyboardSuccess) {
        console.error('[Main] Failed to register keyboard shortcut:', shortcut)
      }
    }
  } else {
    const success = registerHotkeys(shortcut, callback)
    if (!success) {
      console.error('[Main] Failed to register default hotkey:', shortcut)
    }
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.whisper-dictation')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  const t = createTray()
  setTrayRef(t)
  registerIpcHandlers()
  setupHotkeys()

  // Trigger the native macOS microphone TCC dialog on first run.
  // getUserMedia alone is not sufficient on macOS 15 — it returns silence
  // until systemPreferences.askForMediaAccess() has been called.
  requestMicrophonePermission().then((granted) => {
    console.log('[Main] Microphone permission:', granted ? 'granted' : 'denied')
  })

  // Start llama-server if refinement is configured
  getSettings().then((settings) => {
    if (settings.refinementEnabled && settings.refinementModelPath) {
      startLlamaServer(settings.refinementModelPath).catch((err) => {
        console.error('[App] Failed to start llama-server:', err)
      })
    }
  })

  // Handle sleep/wake for llama-server
  registerPowerMonitor()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Keep running as tray app on macOS
})

app.on('before-quit', () => {
  unregisterHotkeys()
  stopLlamaServer().catch(console.error)
})

// Export tray state updater for use by pipeline
export { updateTrayState }
