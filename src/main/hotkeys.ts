import { globalShortcut } from 'electron'
import { IPC } from '@shared/ipc'

let registeredShortcut: string | null = null
let pausedCallback: (() => void) | null = null

/**
 * Register keyboard shortcut for recording control.
 * Note: For push-to-talk mode, this behaves as a toggle in MVP because
 * Electron's globalShortcut doesn't support key-up detection. To implement
 * true push-to-talk, a native module like iohook would be needed to detect
 * key-down and key-up events separately.
 */
export function registerHotkeys(shortcut: string, callback: () => void): boolean {
  try {
    // Unregister existing shortcut first
    if (registeredShortcut) {
      globalShortcut.unregister(registeredShortcut)
    }

    // Validate accelerator format
    if (!shortcut || typeof shortcut !== 'string') {
      console.error('[Hotkeys] Invalid shortcut format:', shortcut)
      return false
    }

    // Register new shortcut
    const success = globalShortcut.register(shortcut, callback)

    if (success) {
      registeredShortcut = shortcut
      console.log('[Hotkeys] Registered:', shortcut)
      return true
    } else {
      console.error('[Hotkeys] Failed to register:', shortcut)
      return false
    }
  } catch (error) {
    console.error('[Hotkeys] Error registering shortcut:', error)
    return false
  }
}

/**
 * Register mouse button as a recording shortcut.
 * Note: This is a placeholder for future implementation. Electron's globalShortcut
 * doesn't support mouse buttons. A native module like iohook or node-mac-peripherals
 * would be needed to capture mouse button events globally.
 *
 * For MVP: This function logs the limitation and returns false.
 */
export function registerMouseButton(button: number, callback: () => void): boolean {
  console.warn(`[Hotkeys] Mouse button ${button} shortcuts require additional native module support (e.g., iohook)`)
  console.warn('[Hotkeys] Mouse button shortcuts are not supported in MVP. Using keyboard shortcut instead.')
  return false
}

export function unregisterHotkeys(): void {
  try {
    if (registeredShortcut) {
      globalShortcut.unregister(registeredShortcut)
      registeredShortcut = null
      console.log('[Hotkeys] Unregistered all hotkeys')
    }
  } catch (error) {
    console.error('[Hotkeys] Error unregistering shortcut:', error)
  }
}

export function updateShortcut(newShortcut: string, callback: () => void): boolean {
  return registerHotkeys(newShortcut, callback)
}

export function isRegistered(): boolean {
  return registeredShortcut !== null
}

/**
 * Temporarily unregister the hotkey while the shortcut recorder is open.
 * Prevents the global shortcut from firing (and triggering recording) while
 * the user presses their hotkey to assign it to the recorder.
 */
export function pauseHotkey(): void {
  if (registeredShortcut) {
    pausedCallback = null // callback will be restored via resumeHotkey
    globalShortcut.unregister(registeredShortcut)
    console.log('[Hotkeys] Paused:', registeredShortcut)
  }
}

/**
 * Re-register the hotkey after the shortcut recorder closes.
 */
export function resumeHotkey(callback: () => void): void {
  if (registeredShortcut) {
    const success = globalShortcut.register(registeredShortcut, callback)
    console.log('[Hotkeys] Resumed:', registeredShortcut, success ? 'ok' : 'FAILED')
  }
}
