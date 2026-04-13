import { globalShortcut } from 'electron'
import iohook from 'iohook-macos'
import type { EventData } from 'iohook-macos'

let registeredShortcuts: Set<string> = new Set()

// Mouse button state
let registeredMouseButton: number | null = null
let mouseEventName: string | null = null
let mouseCallback: (() => void) | null = null
let mouseListener: ((event: EventData) => void) | null = null
let isMousePaused = false

/**
 * Map DOM MouseEvent.button number to iohook-macos event name.
 *
 * iohook-macos cannot distinguish between specific "other" buttons
 * (middle, back, forward, side) — they all fire as 'otherMouseDown' (CGEventType 25).
 * Configuring any extra button will trigger on ALL extra button presses.
 */
function buttonToEventName(button: number): string {
  switch (button) {
    case 0: return 'leftMouseDown'
    case 2: return 'rightMouseDown'
    default: return 'otherMouseDown'
  }
}

/**
 * Register multiple keyboard shortcuts for recording control.
 * Existing keyboard shortcuts are replaced; mouse registration is preserved.
 */
export function registerHotkeys(shortcuts: string[], callback: () => void): boolean {
  // Unregister existing keyboard shortcuts only (preserve mouse)
  for (const shortcut of registeredShortcuts) {
    try {
      globalShortcut.unregister(shortcut)
    } catch (error) {
      console.error('[Hotkeys] Error unregistering shortcut:', shortcut, error)
    }
  }
  registeredShortcuts.clear()

  let allSucceeded = true
  for (const shortcut of shortcuts) {
    if (!shortcut || typeof shortcut !== 'string') {
      console.error('[Hotkeys] Invalid shortcut format:', shortcut)
      allSucceeded = false
      continue
    }

    try {
      const success = globalShortcut.register(shortcut, callback)
      if (success) {
        registeredShortcuts.add(shortcut)
        console.log('[Hotkeys] Registered:', shortcut)
      } else {
        console.error('[Hotkeys] Failed to register:', shortcut)
        allSucceeded = false
      }
    } catch (error) {
      console.error('[Hotkeys] Error registering shortcut:', shortcut, error)
      allSucceeded = false
    }
  }

  return allSucceeded
}

/**
 * Register a mouse button as a recording shortcut using iohook-macos.
 * Requires macOS Accessibility (TCC) permissions for global mouse monitoring.
 */
export function registerMouseButton(button: number, callback: () => void): boolean {
  // Check accessibility permissions (required for global mouse monitoring)
  const perms = iohook.checkAccessibilityPermissions()
  if (!perms.hasPermissions) {
    console.warn('[Hotkeys] Accessibility permission required for mouse button shortcuts')
    return false
  }

  // Clean up any existing mouse registration
  stopMouseMonitoring()

  const eventName = buttonToEventName(button)

  // Store for pause/resume
  mouseCallback = callback
  mouseListener = () => {
    callback()
  }

  // Only queue mouse events (skip keyboard/scroll for performance)
  iohook.setEventTypeFilter(false, true, false)
  iohook.enablePerformanceMode()

  // Register listener and start monitoring
  iohook.on(eventName, mouseListener)
  iohook.startMonitoring()

  registeredMouseButton = button
  mouseEventName = eventName
  isMousePaused = false

  console.log(`[Hotkeys] Registered mouse button ${button} (event: ${eventName})`)
  return true
}

/** Stop mouse monitoring and clean up state. */
function stopMouseMonitoring(): void {
  if (registeredMouseButton === null) return

  try {
    if (iohook.isMonitoring()) {
      iohook.stopMonitoring()
    }
    if (mouseEventName && mouseListener) {
      iohook.removeListener(mouseEventName, mouseListener)
    }
  } catch (error) {
    console.error('[Hotkeys] Error stopping mouse monitoring:', error)
  }

  registeredMouseButton = null
  mouseEventName = null
  mouseCallback = null
  mouseListener = null
  isMousePaused = false
}

export function unregisterHotkeys(): void {
  // Keyboard cleanup
  for (const shortcut of registeredShortcuts) {
    try {
      globalShortcut.unregister(shortcut)
    } catch (error) {
      console.error('[Hotkeys] Error unregistering shortcut:', shortcut, error)
    }
  }
  registeredShortcuts.clear()

  // Mouse cleanup
  stopMouseMonitoring()

  console.log('[Hotkeys] Unregistered all hotkeys')
}

/**
 * Replace all registered shortcuts with a new set.
 */
export function updateShortcuts(shortcuts: string[], callback: () => void): boolean {
  return registerHotkeys(shortcuts, callback)
}

export function isRegistered(): boolean {
  return registeredShortcuts.size > 0 || registeredMouseButton !== null
}

/**
 * Temporarily unregister all hotkeys while the shortcut recorder is open.
 */
export function pauseHotkey(): void {
  // Keyboard
  for (const shortcut of registeredShortcuts) {
    try {
      globalShortcut.unregister(shortcut)
    } catch (error) {
      console.error('[Hotkeys] Error pausing shortcut:', shortcut, error)
    }
  }
  console.log('[Hotkeys] Paused keyboard:', [...registeredShortcuts])

  // Mouse — stop monitoring but preserve registration state for resume
  if (registeredMouseButton !== null) {
    try {
      if (iohook.isMonitoring()) {
        iohook.stopMonitoring()
      }
      isMousePaused = true
      console.log('[Hotkeys] Paused mouse button:', registeredMouseButton)
    } catch (error) {
      console.error('[Hotkeys] Error pausing mouse monitoring:', error)
    }
  }
}

/**
 * Re-register all hotkeys after the shortcut recorder closes.
 */
export function resumeHotkey(callback: () => void): void {
  // Keyboard
  for (const shortcut of registeredShortcuts) {
    try {
      const success = globalShortcut.register(shortcut, callback)
      console.log('[Hotkeys] Resumed:', shortcut, success ? 'ok' : 'FAILED')
    } catch (error) {
      console.error('[Hotkeys] Error resuming shortcut:', shortcut, error)
    }
  }

  // Mouse — replace listener with updated callback and restart monitoring
  if (isMousePaused && registeredMouseButton !== null && mouseEventName) {
    try {
      if (mouseListener) {
        iohook.removeListener(mouseEventName, mouseListener)
      }
      mouseCallback = callback
      mouseListener = () => {
        callback()
      }
      iohook.on(mouseEventName, mouseListener)
      iohook.startMonitoring()
      isMousePaused = false
      console.log('[Hotkeys] Resumed mouse button:', registeredMouseButton)
    } catch (error) {
      console.error('[Hotkeys] Error resuming mouse monitoring:', error)
    }
  }
}
