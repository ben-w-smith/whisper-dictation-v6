import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron globalShortcut
const mockRegister = vi.fn()
const mockUnregister = vi.fn()
vi.mock('electron', () => ({
  globalShortcut: {
    register: mockRegister,
    unregister: mockUnregister,
    isRegistered: vi.fn(),
  },
}))

// Mock iohook-macos — capture the listener so we can simulate events
let capturedMouseListener: ((event: { buttonNumber: number }) => void) | null = null
const mockStartMonitoring = vi.fn()
const mockStopMonitoring = vi.fn()
const mockIsMonitoring = vi.fn()
const mockRemoveListener = vi.fn()

vi.mock('iohook-macos', () => ({
  default: {
    checkAccessibilityPermissions: vi.fn(() => ({ hasPermissions: true })),
    setEventTypeFilter: vi.fn(),
    enablePerformanceMode: vi.fn(),
    on: vi.fn((_eventName: string, listener: (event: any) => void) => {
      capturedMouseListener = listener
    }),
    startMonitoring: mockStartMonitoring,
    stopMonitoring: mockStopMonitoring,
    isMonitoring: mockIsMonitoring,
    removeListener: mockRemoveListener,
  },
}))

// Import after mocks are set up
const { registerHotkeys, registerMouseButton, unregisterMouseButton, unregisterHotkeys, isRegistered } = await import('./hotkeys')

describe('hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegister.mockReturnValue(true)
    mockIsMonitoring.mockReturnValue(true)
    capturedMouseListener = null
  })

  describe('registerHotkeys', () => {
    it('registers keyboard shortcuts via Electron globalShortcut', () => {
      const callback = vi.fn()
      const result = registerHotkeys(['Command+Shift+D'], callback)

      expect(result).toBe(true)
      expect(mockRegister).toHaveBeenCalledWith('Command+Shift+D', callback)
    })

    it('registers multiple shortcuts', () => {
      const callback = vi.fn()
      registerHotkeys(['Command+Shift+D', 'Command+Shift+W'], callback)

      expect(mockRegister).toHaveBeenCalledTimes(2)
    })

    it('unregisters old shortcuts before registering new ones', () => {
      const callback = vi.fn()
      registerHotkeys(['Command+Shift+D'], callback)
      registerHotkeys(['Command+Shift+W'], callback)

      expect(mockUnregister).toHaveBeenCalledWith('Command+Shift+D')
      expect(mockRegister).toHaveBeenCalledWith('Command+Shift+W', callback)
    })
  })

  describe('registerMouseButton', () => {
    it('registers a mouse button and starts monitoring', () => {
      const callback = vi.fn()
      const result = registerMouseButton(3, callback)

      expect(result).toBe(true)
      expect(mockStartMonitoring).toHaveBeenCalled()
      expect(isRegistered()).toBe(true)
    })

    it('only triggers callback when buttonNumber matches', () => {
      const callback = vi.fn()
      registerMouseButton(3, callback)

      // Button 3 (back) — should trigger
      capturedMouseListener!({ buttonNumber: 3 })
      expect(callback).toHaveBeenCalledTimes(1)

      // Button 4 (forward) — should NOT trigger
      capturedMouseListener!({ buttonNumber: 4 })
      expect(callback).toHaveBeenCalledTimes(1)

      // Button 2 (middle) — should NOT trigger
      capturedMouseListener!({ buttonNumber: 2 })
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('triggers callback for button 4 (forward) when configured', () => {
      const callback = vi.fn()
      registerMouseButton(4, callback)

      capturedMouseListener!({ buttonNumber: 4 })
      expect(callback).toHaveBeenCalledTimes(1)

      capturedMouseListener!({ buttonNumber: 3 })
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('cleans up previous mouse registration when registering a new button', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      registerMouseButton(3, callback1)
      registerMouseButton(4, callback2)

      // First listener should be removed
      expect(mockRemoveListener).toHaveBeenCalled()

      // New listener should only respond to button 4
      capturedMouseListener!({ buttonNumber: 3 })
      expect(callback2).not.toHaveBeenCalled()

      capturedMouseListener!({ buttonNumber: 4 })
      expect(callback2).toHaveBeenCalledTimes(1)
    })
  })

  describe('unregisterMouseButton', () => {
    it('stops mouse monitoring without affecting keyboard shortcuts', () => {
      const callback = vi.fn()
      registerHotkeys(['Command+Shift+D'], callback)
      registerMouseButton(3, callback)

      expect(isRegistered()).toBe(true)

      unregisterMouseButton()

      // Keyboard should still be registered
      expect(isRegistered()).toBe(true)
      expect(mockStopMonitoring).toHaveBeenCalled()
    })
  })

  describe('unregisterHotkeys', () => {
    it('clears both keyboard and mouse', () => {
      const callback = vi.fn()
      registerHotkeys(['Command+Shift+D'], callback)
      registerMouseButton(3, callback)

      expect(isRegistered()).toBe(true)

      unregisterHotkeys()

      expect(isRegistered()).toBe(false)
      expect(mockStopMonitoring).toHaveBeenCalled()
    })
  })
})
