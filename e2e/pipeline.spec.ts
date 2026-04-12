import { test, expect } from '@playwright/test'
import {
  launchApp,
  getBackgroundWindow,
  mockTranscription,
  waitForState,
  getClipboardText,
  queryDebugBus,
} from './helpers'

test.describe('Recording Pipeline', () => {
  let electronApp: Awaited<ReturnType<typeof launchApp>>

  test.beforeAll(async () => {
    electronApp = await launchApp()
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  /**
   * Send HOTKEY_TRIGGERED by having the renderer dispatch it directly.
   * The preload bridge exposes window.api which goes through ipcRenderer,
   * but there's no main process handler that echoes it back.
   * Instead, we trigger the state machine event directly in the renderer.
   */
  async function sendHotkey(): Promise<void> {
    const bgWin = await getBackgroundWindow(electronApp)
    await bgWin.evaluate(() => {
      // Dispatch a custom DOM event that triggers the same code path
      // as the IPC hotkey:triggered listener
      const event = new CustomEvent('__test_hotkey')
      window.dispatchEvent(event)
    })
  }

  test('should complete full recording cycle', async () => {
    const expectedText = 'Hello world this is a test transcription'
    const bgWin = await getBackgroundWindow(electronApp)

    // 1. Complete onboarding
    await bgWin.evaluate(() => {
      return window.api.invoke('test:complete-onboarding')
    })
    await bgWin.waitForTimeout(1500)

    // 2. Enable mock audio (skip real microphone)
    await bgWin.evaluate(() => {
      (window as any).__testMockAudio = true
    })

    // 3. Set mock whisper result
    await mockTranscription(electronApp, expectedText)

    // 4. Start recording
    await sendHotkey()
    await waitForState(electronApp, 'recording', 5000)

    // 5. Wait for enough mock audio data (> 500ms MIN_RECORDING_DURATION_MS)
    await new Promise((r) => setTimeout(r, 1500))

    // 6. Stop recording
    await sendHotkey()

    // 7. Wait for completion
    await waitForState(electronApp, 'complete', 10000)

    // 8. Verify clipboard
    const clipboard = await getClipboardText(electronApp)
    expect(clipboard).toBe(expectedText)

    // 9. Verify debug bus captured the flow
    const stateChanges = await queryDebugBus(electronApp, { source: 'pipeline', event: 'state_change' })
    const states = stateChanges.map((e: any) => e.data.state)
    expect(states).toContain('recording')
    expect(states).toContain('complete')
  })

  test('should return to idle when recording is too short', async () => {
    const bgWin = await getBackgroundWindow(electronApp)

    // Enable mock audio for this test too
    await bgWin.evaluate(() => {
      (window as any).__testMockAudio = true
    })

    // Wait for idle state
    await waitForState(electronApp, 'idle', 10000)

    // Start recording
    await sendHotkey()
    await waitForState(electronApp, 'recording', 5000)

    // Stop immediately (< 500ms)
    await sendHotkey()

    // Should go back to idle
    await waitForState(electronApp, 'idle', 5000)
  })
})
