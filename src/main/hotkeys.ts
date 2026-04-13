import { globalShortcut } from 'electron'

let registeredShortcuts: Set<string> = new Set()

/**
 * Register multiple keyboard shortcuts for recording control.
 * All previous shortcuts are unregistered before the new set is applied.
 */
export function registerHotkeys(shortcuts: string[], callback: () => void): boolean {
  // Unregister all existing shortcuts
  unregisterHotkeys()

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
 * Register mouse button as a recording shortcut.
 * Placeholder — requires native module (iohook) for actual implementation.
 */
export function registerMouseButton(button: number, _callback: () => void): boolean {
  console.warn(`[Hotkeys] Mouse button ${button} shortcuts require native module support (e.g., iohook)`)
  return false
}

export function unregisterHotkeys(): void {
  for (const shortcut of registeredShortcuts) {
    try {
      globalShortcut.unregister(shortcut)
    } catch (error) {
      console.error('[Hotkeys] Error unregistering shortcut:', shortcut, error)
    }
  }
  registeredShortcuts.clear()
  console.log('[Hotkeys] Unregistered all hotkeys')
}

/**
 * Replace all registered shortcuts with a new set.
 */
export function updateShortcuts(shortcuts: string[], callback: () => void): boolean {
  return registerHotkeys(shortcuts, callback)
}

export function isRegistered(): boolean {
  return registeredShortcuts.size > 0
}

/**
 * Temporarily unregister all hotkeys while the shortcut recorder is open.
 */
export function pauseHotkey(): void {
  for (const shortcut of registeredShortcuts) {
    try {
      globalShortcut.unregister(shortcut)
    } catch (error) {
      console.error('[Hotkeys] Error pausing shortcut:', shortcut, error)
    }
  }
  console.log('[Hotkeys] Paused:', [...registeredShortcuts])
}

/**
 * Re-register all hotkeys after the shortcut recorder closes.
 */
export function resumeHotkey(callback: () => void): void {
  for (const shortcut of registeredShortcuts) {
    try {
      const success = globalShortcut.register(shortcut, callback)
      console.log('[Hotkeys] Resumed:', shortcut, success ? 'ok' : 'FAILED')
    } catch (error) {
      console.error('[Hotkeys] Error resuming shortcut:', shortcut, error)
    }
  }
}
