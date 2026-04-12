import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'path'

/**
 * Launch the app in test mode
 */
export async function launchApp(): Promise<ElectronApplication> {
  return await electron.launch({
    args: [join(__dirname, '../out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  })
}

/**
 * Find the hidden background window.
 * Uses firstWindow() which is Playwright's built-in way to get the
 * main BrowserWindow. Falls back to searching by title.
 */
export async function getBackgroundWindow(app: ElectronApplication): Promise<Page> {
  // First try firstWindow() — this is the most reliable way
  try {
    const firstWin = await app.firstWindow()
    if (firstWin) return firstWin
  } catch {
    // firstWindow() might fail if windows haven't loaded yet
  }

  // Wait a moment for windows to load
  const windows = app.windows()
  for (const win of windows) {
    try {
      const title = await win.title()
      if (title === 'WhisperDictation') return win
    } catch {
      // Window might not be ready yet
    }
  }

  // Last resort: wait for a window event
  const bgWin = await app.waitForEvent('window', { timeout: 5000 })
  return bgWin
}

/**
 * Set mock whisper transcription result
 */
export async function mockTranscription(app: ElectronApplication, text: string): Promise<void> {
  const bgWin = await getBackgroundWindow(app)
  await bgWin.evaluate((mockText) => {
    return window.api.invoke('test:mock-transcription', mockText)
  }, text)
}

/**
 * Complete onboarding without going through the UI
 */
export async function completeOnboarding(app: ElectronApplication): Promise<void> {
  const bgWin = await getBackgroundWindow(app)
  await bgWin.evaluate(() => {
    return window.api.invoke('test:complete-onboarding')
  })
  // Wait for settings to propagate
  await bgWin.waitForTimeout(500)
}

/**
 * Send a hotkey trigger event to the background window
 */
export async function triggerHotkey(app: ElectronApplication): Promise<void> {
  const bgWin = await getBackgroundWindow(app)
  await bgWin.evaluate(() => {
    window.api.send('hotkey:triggered')
  })
}

/**
 * Enable mock audio capture (skip real microphone)
 */
export async function enableMockAudio(app: ElectronApplication): Promise<void> {
  const bgWin = await getBackgroundWindow(app)
  await bgWin.evaluate(() => {
    (window as any).__testMockAudio = true
  })
}

/**
 * Poll the debug bus until the pipeline reaches the given state
 */
export async function waitForState(
  app: ElectronApplication,
  targetState: string,
  timeout = 10000
): Promise<void> {
  const bgWin = await getBackgroundWindow(app)
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const currentState = await bgWin.evaluate(() => {
      const bus = (window as any).__debugBus
      if (!bus) return null
      const entries = bus.query({ source: 'pipeline', event: 'state_change' })
      if (entries.length === 0) return null
      return entries[entries.length - 1].data.state
    })

    if (currentState === targetState) return
    await bgWin.waitForTimeout(200)
  }

  throw new Error(`Timed out waiting for state "${targetState}" after ${timeout}ms`)
}

/**
 * Read clipboard contents via test IPC channel
 */
export async function getClipboardText(app: ElectronApplication): Promise<string> {
  const bgWin = await getBackgroundWindow(app)
  return await bgWin.evaluate(() => {
    return window.api.invoke('test:read-clipboard') as Promise<string>
  })
}

/**
 * Query the debug bus from the background window
 */
export async function queryDebugBus(
  app: ElectronApplication,
  filter?: { source?: string; event?: string }
): Promise<unknown[]> {
  const bgWin = await getBackgroundWindow(app)
  return await bgWin.evaluate((f) => {
    const bus = (window as any).__debugBus
    if (!bus) return []
    return bus.query(f)
  }, filter)
}
