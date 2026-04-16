import { Tray, BrowserWindow, Menu, app, clipboard, nativeImage } from 'electron'
import { join } from 'path'
import { IPC } from '@shared/ipc'
import { registerWindow, getWindow } from './windows'

let currentShortcut = 'Alt+Space'
let lastTranscriptionText = ''

export function setLastTranscription(text: string): void {
  lastTranscriptionText = text
}

function getLastTranscription(): string {
  return lastTranscriptionText
}

function getRendererUrl(hash?: string): string | null {
  const baseUrl = process.env['ELECTRON_RENDERER_URL']
  if (baseUrl) {
    return hash ? `${baseUrl}/#${hash}` : baseUrl
  }
  return null
}

export function openHomeWindow(): void {
  const existing = BrowserWindow.getAllWindows().find(
    (win) => win.getTitle() === 'Home'
  )
  if (existing) {
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 680,
    minHeight: 500,
    title: 'Home',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  registerWindow('home', win)

  const url = getRendererUrl('home')
  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'home' })
  }
  win.on('page-title-updated', (e) => {
    e.preventDefault()
    win.setTitle('Home')
  })
}

export function openAboutWindow(): void {
  const existing = BrowserWindow.getAllWindows().find(
    (win) => win.getTitle() === 'About'
  )
  if (existing) {
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    title: 'About',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  registerWindow('about', win)

  const url = getRendererUrl('about')
  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'about' })
  }
  win.on('page-title-updated', (e) => {
    e.preventDefault()
    win.setTitle('About')
  })
}

export function createTrayMenu(tray: Tray, mainWindow: BrowserWindow): void {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Start Recording',
      click: () => {
        mainWindow?.webContents.send(IPC.FORCE_START_RECORDING)
      }
    },
    {
      label: 'Copy Last Transcription',
      click: () => {
        const text = getLastTranscription()
        if (text) {
          clipboard.writeText(text)
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Home...',
      click: () => {
        openHomeWindow()
      }
    },
    {
      label: 'About...',
      click: () => {
        openAboutWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('Whisper Dictation')
}

function getTrayIcon(): Electron.NativeImage {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  icon.setTemplateImage(true)
  return icon
}

export function updateTrayState(tray: Tray, state: string): void {
  tray.setImage(getTrayIcon())

  switch (state) {
    case 'idle':
      tray.setToolTip('Whisper Dictation - Ready')
      break
    case 'recording':
      tray.setToolTip('Whisper Dictation - Recording...')
      break
    case 'transcribing':
      tray.setToolTip('Whisper Dictation - Transcribing...')
      break
    case 'error':
      tray.setToolTip('Whisper Dictation - Error')
      break
    default:
      tray.setToolTip('Whisper Dictation')
  }
}
