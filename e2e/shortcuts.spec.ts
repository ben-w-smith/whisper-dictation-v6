import { test, expect } from '@playwright/test'
import { launchApp, getBackgroundWindow, completeOnboarding, waitForState, mockTranscription } from './helpers'

let electronApp: Awaited<ReturnType<typeof launchApp>>
let mainWindow: Awaited<ReturnType<typeof getBackgroundWindow>>

/**
 * Dispatch a __test_hotkey DOM event in the background window, which triggers
 * the same state machine HOTKEY_PRESSED event as the real IPC hotkey:triggered
 * listener.  Uses the DOM event rather than window.api.send('hotkey:triggered')
 * because the latter goes renderer→main, but the state machine listens for
 * main→renderer IPC events.
 */
async function sendHotkey(): Promise<void> {
  await mainWindow.evaluate(() => {
    window.dispatchEvent(new CustomEvent('__test_hotkey'))
  })
}

test.beforeAll(async () => {
  electronApp = await launchApp()
  mainWindow = await getBackgroundWindow(electronApp)
  await completeOnboarding(electronApp)
})

test.afterAll(async () => {
  await electronApp.close()
})

test.describe('Shortcut Registration', () => {
  test('default keyboard shortcut is registered on startup', async () => {
    const settings = await mainWindow.evaluate(() => {
      return window.api.invoke('settings:get')
    }) as Record<string, unknown>

    expect(settings.keyboardShortcuts).toBeDefined()
    expect(Array.isArray(settings.keyboardShortcuts)).toBe(true)
    expect((settings.keyboardShortcuts as string[]).length).toBeGreaterThan(0)
  })

  test('hotkey trigger starts recording', async () => {
    // Enable mock audio so the pipeline doesn't need a real microphone
    await mainWindow.evaluate(() => {
      (window as any).__testMockAudio = true
    })
    // Set a mock transcription so the pipeline can complete
    await mockTranscription(electronApp, 'test transcription')

    await sendHotkey()
    await waitForState(electronApp, 'recording', 5000)

    // Wait for at least 500ms of mock audio data (MIN_RECORDING_DURATION_MS)
    await new Promise((r) => setTimeout(r, 800))

    // Stop recording
    await sendHotkey()

    // Wait for the pipeline to finish (complete or idle)
    await waitForState(electronApp, 'complete', 10000)
  })

  test('changing keyboard shortcut via settings persists', async () => {
    // Change shortcut
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'keyboardShortcuts', ['Command+Shift+W'])
    })

    // Read back
    const settings = await mainWindow.evaluate(() => {
      return window.api.invoke('settings:get')
    }) as Record<string, unknown>

    expect(settings.keyboardShortcuts).toEqual(['Command+Shift+W'])
  })

  test('changing keyboard shortcut does not clear mouse button', async () => {
    // Set mouse button first
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'mouseButton', 3)
    })

    // Change keyboard shortcut
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'keyboardShortcuts', ['Command+Shift+D'])
    })

    // Mouse button should still be set
    const settings = await mainWindow.evaluate(() => {
      return window.api.invoke('settings:get')
    }) as Record<string, unknown>

    expect(settings.mouseButton).toBe(3)
    expect(settings.keyboardShortcuts).toEqual(['Command+Shift+D'])
  })

  test('clearing mouse button does not clear keyboard shortcuts', async () => {
    // Set both
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'keyboardShortcuts', ['Command+Shift+D'])
    })
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'mouseButton', 3)
    })

    // Clear mouse button
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'mouseButton', null)
    })

    // Keyboard shortcuts should still be set
    const settings = await mainWindow.evaluate(() => {
      return window.api.invoke('settings:get')
    }) as Record<string, unknown>

    expect(settings.keyboardShortcuts).toEqual(['Command+Shift+D'])
    expect(settings.mouseButton).toBeNull()
  })

  test('both keyboard and mouse can be set simultaneously', async () => {
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'keyboardShortcuts', ['Command+Shift+D'])
    })
    await mainWindow.evaluate(() => {
      return window.api.invoke('settings:set', 'mouseButton', 4)
    })

    const settings = await mainWindow.evaluate(() => {
      return window.api.invoke('settings:get')
    }) as Record<string, unknown>

    expect(settings.keyboardShortcuts).toEqual(['Command+Shift+D'])
    expect(settings.mouseButton).toBe(4)
  })
})
