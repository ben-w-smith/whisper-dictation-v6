/**
 * Integration-style test for the shortcut registration pipeline.
 * Validates the SET_SETTING handler behavior for keyboard and mouse shortcuts,
 * ensuring they're registered independently and don't race.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
const mockRegister = vi.fn()
const mockUnregister = vi.fn()
const mockWebContentsSend = vi.fn()

vi.mock('electron', () => ({
  globalShortcut: {
    register: mockRegister,
    unregister: mockUnregister,
    isRegistered: vi.fn(),
  },
}))

// Track the current mouse listener so tests can fire events at it
let activeMouseListener: ((event: { buttonNumber: number }) => void) | null = null
const mockStartMonitoring = vi.fn()
const mockStopMonitoring = vi.fn()
const mockIsMonitoring = vi.fn().mockReturnValue(true)
const mockRemoveListener = vi.fn()

vi.mock('iohook-macos', () => ({
  default: {
    checkAccessibilityPermissions: vi.fn(() => ({ hasPermissions: true })),
    setEventTypeFilter: vi.fn(),
    enablePerformanceMode: vi.fn(),
    on: vi.fn((_eventName: string, listener: (event: any) => void) => {
      activeMouseListener = listener
    }),
    startMonitoring: mockStartMonitoring,
    stopMonitoring: mockStopMonitoring,
    isMonitoring: mockIsMonitoring,
    removeListener: mockRemoveListener,
  },
}))

// Mock store — tracks settings in memory
let settingsStore: Record<string, any> = {
  keyboardShortcuts: ['Command+Shift+D'],
  mouseButton: null,
}

vi.mock('./store', () => ({
  getSettings: vi.fn(async () => ({ ...settingsStore })),
  setSetting: vi.fn(async (key: string, value: any) => {
    settingsStore[key] = value
  }),
}))

// Import after mocks
const { updateShortcuts, registerMouseButton, unregisterMouseButton } = await import('./hotkeys')

/**
 * Simulates the SET_SETTING handler from ipc.ts for shortcut-related settings.
 * This is the exact logic that runs when the renderer calls updateSetting().
 */
async function simulateSetSetting(key: string, value: any, callback: () => void) {
  // Save setting
  settingsStore[key] = value

  // Re-register shortcuts when keyboard or mouse shortcut settings change
  if (key === 'keyboardShortcuts' || key === 'mouseButton') {
    const updatedSettings = { ...settingsStore }

    // Re-register keyboard shortcuts (always)
    updateShortcuts(updatedSettings.keyboardShortcuts, callback)

    // Re-register or clear mouse button (independently)
    if (updatedSettings.mouseButton != null) {
      registerMouseButton(updatedSettings.mouseButton, callback)
    } else {
      unregisterMouseButton()
    }
  }
}

describe('Shortcut SET_SETTING integration', () => {
  const callback = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockRegister.mockReturnValue(true)
    activeMouseListener = null
    settingsStore = {
      keyboardShortcuts: ['Command+Shift+D'],
      mouseButton: null,
    }
    callback.mockClear()
  })

  it('registers keyboard shortcut via SET_SETTING', async () => {
    await simulateSetSetting('keyboardShortcuts', ['CommandOrControl+Shift+K'], callback)

    expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+Shift+K', callback)
  })

  it('registers mouse button via SET_SETTING', async () => {
    await simulateSetSetting('mouseButton', 5, callback)

    expect(mockStartMonitoring).toHaveBeenCalled()
    expect(activeMouseListener).not.toBeNull()

    // Fire event with matching button
    activeMouseListener!({ buttonNumber: 5 })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not fire callback for wrong button number', async () => {
    await simulateSetSetting('mouseButton', 5, callback)

    activeMouseListener!({ buttonNumber: 3 })
    expect(callback).not.toHaveBeenCalled()

    activeMouseListener!({ buttonNumber: 5 })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('updates mouse button from 4 to 5 without leaving old listener', async () => {
    await simulateSetSetting('mouseButton', 4, callback)
    expect(activeMouseListener).not.toBeNull()

    // Button 4 should trigger
    activeMouseListener!({ buttonNumber: 4 })
    expect(callback).toHaveBeenCalledTimes(1)

    // Now update to button 5
    callback.mockClear()
    await simulateSetSetting('mouseButton', 5, callback)

    // Button 4 should NOT trigger anymore (new listener)
    activeMouseListener!({ buttonNumber: 4 })
    expect(callback).not.toHaveBeenCalled()

    // Button 5 should trigger
    activeMouseListener!({ buttonNumber: 5 })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('clears mouse button when set to null', async () => {
    await simulateSetSetting('mouseButton', 5, callback)
    expect(mockStartMonitoring).toHaveBeenCalled()

    await simulateSetSetting('mouseButton', null, callback)
    expect(mockStopMonitoring).toHaveBeenCalled()
  })

  it('keyboard shortcut re-registration preserves mouse button', async () => {
    // Set up mouse button
    await simulateSetSetting('mouseButton', 5, callback)
    expect(activeMouseListener).not.toBeNull()
    const mouseListenerAfterSetup = activeMouseListener

    // Update keyboard shortcut (should not break mouse)
    await simulateSetSetting('keyboardShortcuts', ['Command+Shift+K'], callback)

    // Mouse should still be active — listener was re-created but monitoring restarted
    expect(mockStartMonitoring).toHaveBeenCalled()
    expect(activeMouseListener).not.toBeNull()

    // Mouse button 5 should still trigger
    activeMouseListener!({ buttonNumber: 5 })
    expect(callback).toHaveBeenCalled()
  })
})
