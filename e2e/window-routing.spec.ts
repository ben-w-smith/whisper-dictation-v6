import { test, expect, type Page } from '@playwright/test'
import {
  launchApp,
  getBackgroundWindow,
  completeOnboarding,
  waitForState,
  mockTranscription,
  getWindowByUrl,
  waitForWindowByUrl,
  openHomeWindow,
} from './helpers'

let electronApp: Awaited<ReturnType<typeof launchApp>>
let bgWin: Page

test.beforeAll(async () => {
  electronApp = await launchApp()
  bgWin = await getBackgroundWindow(electronApp)
  await completeOnboarding(electronApp)
})

test.afterAll(async () => {
  await electronApp.close()
})

/**
 * Dispatch a __test_hotkey DOM event in the background window, which triggers
 * the same state machine HOTKEY_PRESSED event as the real IPC hotkey:triggered
 * listener.
 */
async function sendHotkey(): Promise<void> {
  await bgWin.evaluate(() => {
    window.dispatchEvent(new CustomEvent('__test_hotkey'))
  })
}

// ── Scenario 1: Background window registered after launch ──────────────

test('background window responds to IPC after launch', async () => {
  const settings = await bgWin.evaluate(() => {
    return window.api.invoke('settings:get')
  }) as Record<string, unknown>

  expect(settings).toBeDefined()
  expect(typeof settings.onboardingComplete).toBe('boolean')
})

// ── Scenario 2: Home window receives broadcast ─────────────────────────

test('home window receives SETTINGS_UPDATED broadcast', async () => {
  const homeWin = await openHomeWindow(electronApp)
  expect(homeWin).toBeTruthy()

  // Set up listener in home window
  await homeWin.evaluate(() => {
    ;(window as any).__testSettingsUpdates = [] as Array<Record<string, unknown>>
    window.api.on('settings:updated', (update: unknown) => {
      ;(window as any).__testSettingsUpdates.push(update)
    })
  })

  // Trigger a setting change from background window → broadcast() sends to all
  await bgWin.evaluate(() => {
    return window.api.invoke('settings:set', 'autoPaste', false)
  })
  await bgWin.waitForTimeout(500)

  // Verify home window received the broadcast
  const updates = await homeWin.evaluate(() => {
    return (window as any).__testSettingsUpdates as Array<Record<string, unknown>>
  })
  expect(updates.length).toBeGreaterThanOrEqual(1)
  const lastUpdate = updates[updates.length - 1]
  expect(lastUpdate.key).toBe('autoPaste')
})

// ── Scenario 3: Close Home → setting change doesn't error ──────────────

test('changing settings after closing home does not error', async () => {
  const homeWin = await getWindowByUrl(electronApp, 'home')
  expect(homeWin).toBeTruthy()
  await homeWin!.close()

  // Wait for window to be unregistered
  await bgWin.waitForTimeout(500)

  // Verify home window is gone
  const gone = await getWindowByUrl(electronApp, 'home')
  expect(gone).toBeNull()

  // Change a setting — broadcast() should skip the unregistered home gracefully
  await bgWin.evaluate(() => {
    return window.api.invoke('settings:set', 'autoPaste', true)
  })
  // No assertion needed — if this hangs or throws, the test fails
})

// ── Scenario 4: Overlay window appears during recording ────────────────

test('overlay window is registered during recording', async () => {
  // Enable mock audio and transcription
  await bgWin.evaluate(() => {
    ;(window as any).__testMockAudio = true
  })
  await mockTranscription(electronApp, 'window routing test')

  // Start recording
  await sendHotkey()
  await waitForState(electronApp, 'recording', 5000)

  // Check that overlay window exists
  const overlayWin = await waitForWindowByUrl(electronApp, 'overlay', 5000)
  expect(overlayWin).toBeTruthy()

  // Wait for enough mock audio data (> 500ms MIN_RECORDING_DURATION_MS)
  await new Promise((r) => setTimeout(r, 1500))

  // Stop recording
  await sendHotkey()
  await waitForState(electronApp, 'complete', 10000)
})

// ── Scenario 5: Overlay still exists after recording (hidden, not closed)

test('overlay window persists after recording completes', async () => {
  // After scenario 4 completes, the overlay should be hidden but not destroyed
  const overlayWin = await getWindowByUrl(electronApp, 'overlay')
  expect(overlayWin).toBeTruthy()
})

// ── Scenario 6: Capture routes to home, not background ─────────────────
//
// This is the regression case the whole plan was designed to prevent.
// The flow: Home sends CAPTURE_MOUSE_BUTTON → main stores callback →
// test triggers it via test:trigger-mouse-capture → response arrives at Home.

test('mouse capture response routes to home window, not background', async () => {
  const homeWin = await openHomeWindow(electronApp)
  expect(homeWin).toBeTruthy()

  // Set up a listener in the home window for the capture response
  await homeWin.evaluate(() => {
    ;(window as any).__capturedButton = null as number | null
    window.api.on('hotkey:mouse-captured', (button: number) => {
      ;(window as any).__capturedButton = button
    })
  })

  // Also set up a listener in background to verify it does NOT receive it
  await bgWin.evaluate(() => {
    ;(window as any).__bgCapturedButton = null as number | null
    window.api.on('hotkey:mouse-captured', (button: number) => {
      ;(window as any).__bgCapturedButton = button
    })
  })

  // From the home window, send CAPTURE_MOUSE_BUTTON
  await homeWin.evaluate(() => {
    window.api.send('hotkey:capture-mouse')
  })
  await homeWin.waitForTimeout(300)

  // Trigger the capture callback via test-only IPC (simulates iohook event)
  await bgWin.evaluate(() => {
    return window.api.invoke('test:trigger-mouse-capture', 5)
  })
  await homeWin.waitForTimeout(300)

  // Verify home window received the capture response
  const homeButton = await homeWin.evaluate(() => {
    return (window as any).__capturedButton as number | null
  })
  expect(homeButton).toBe(5)

  // Verify background did NOT receive it (event.sender.send only goes to sender)
  const bgButton = await bgWin.evaluate(() => {
    return (window as any).__bgCapturedButton as number | null
  })
  expect(bgButton).toBeNull()
})
