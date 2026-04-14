# Shortcut System Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mouse button distinction and shortcut registration bugs so shortcuts reliably work and update when changed.

**Architecture:** Keep Electron's `globalShortcut` for keyboard, use forked `iohook-macos` for mouse with `buttonNumber` filtering. Register keyboard and mouse independently (not mutually exclusive). Add vitest unit tests for hotkeys.ts and Playwright e2e tests for the full flow.

**Tech Stack:** Electron globalShortcut, iohook-macos-fork (CGEventTap), vitest, Playwright

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Swap `iohook-macos` dep to fork |
| `src/main/hotkeys.ts` | Modify | Filter on `buttonNumber`, remove `buttonToEventName()` |
| `src/main/index.ts` | Modify | Fix `setupHotkeys()` — keyboard and mouse register independently |
| `src/main/ipc.ts` | Modify | Fix `SET_SETTING` handler — keyboard and mouse re-register independently |
| `src/main/hotkeys.test.ts` | Create | Unit tests for button filtering and registration logic |
| `e2e/shortcuts.spec.ts` | Create | E2E tests for shortcut registration and state machine flow |

---

### Task 1: Swap iohook-macos dependency to fork

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json dependency**

Change line 27 in `package.json` from:
```json
"iohook-macos": "^1.2.1",
```
to:
```json
"iohook-macos": "github:ben-smith-atg/iohook-macos-fork",
```

- [ ] **Step 2: Install the forked dependency**

Run: `pnpm install`
Expected: Installs successfully, native module compiles for arm64.

- [ ] **Step 3: Verify the app launches**

Run: `pnpm dev`
Expected: App launches without errors in console related to iohook-macos. The app should function identically to before (keyboard shortcuts work, mouse button shortcuts still fire on all extra buttons — we'll fix that next).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: switch to forked iohook-macos with buttonNumber support"
```

---

### Task 2: Add buttonNumber filtering in hotkeys.ts

**Files:**
- Modify: `src/main/hotkeys.ts`

- [ ] **Step 1: Remove `buttonToEventName()` and update comments**

Delete the `buttonToEventName` function (lines 14-27). Remove the `mouseEventName` state variable (line 9) — we no longer need it since we always listen on `otherMouseDown` and filter by button number.

Update the module-level state to:
```typescript
let registeredShortcuts: Set<string> = new Set()

// Mouse button state
let registeredMouseButton: number | null = null
let mouseCallback: (() => void) | null = null
let mouseListener: ((event: EventData) => void) | null = null
let isMousePaused = false
```

- [ ] **Step 2: Update `registerMouseButton()` to filter on buttonNumber**

Replace the body of `registerMouseButton` (lines 74-107) with:

```typescript
export function registerMouseButton(button: number, callback: () => void): boolean {
  // Check accessibility permissions (required for global mouse monitoring)
  const perms = iohook.checkAccessibilityPermissions()
  if (!perms.hasPermissions) {
    console.warn('[Hotkeys] Accessibility permission required for mouse button shortcuts')
    return false
  }

  // Clean up any existing mouse registration
  stopMouseMonitoring()

  // Store for pause/resume
  mouseCallback = callback
  mouseListener = (event: EventData) => {
    // Only trigger on the specific configured button
    if (event.buttonNumber === button) {
      callback()
    }
  }

  // Only queue mouse events (skip keyboard/scroll for performance)
  iohook.setEventTypeFilter(false, true, false)
  iohook.enablePerformanceMode()

  // Always listen on otherMouseDown — the listener filters by buttonNumber
  const eventName = button <= 1
    ? (button === 0 ? 'leftMouseDown' : 'rightMouseDown')
    : 'otherMouseDown'

  iohook.on(eventName, mouseListener)
  iohook.startMonitoring()

  registeredMouseButton = button
  isMousePaused = false

  console.log(`[Hotkeys] Registered mouse button ${button}`)
  return true
}
```

Key change: the listener now checks `event.buttonNumber === button` before calling the callback. For buttons >= 2, it listens on `otherMouseDown` and filters.

- [ ] **Step 3: Update `stopMouseMonitoring()` — remove `mouseEventName` references**

Replace `stopMouseMonitoring()` (lines 110-129) with:

```typescript
function stopMouseMonitoring(): void {
  if (registeredMouseButton === null) return

  try {
    if (iohook.isMonitoring()) {
      iohook.stopMonitoring()
    }
    if (mouseListener) {
      // Remove from all possible event names
      iohook.removeListener('otherMouseDown', mouseListener)
      iohook.removeListener('leftMouseDown', mouseListener)
      iohook.removeListener('rightMouseDown', mouseListener)
    }
  } catch (error) {
    console.error('[Hotkeys] Error stopping mouse monitoring:', error)
  }

  registeredMouseButton = null
  mouseCallback = null
  mouseListener = null
  isMousePaused = false
}
```

- [ ] **Step 4: Update `resumeHotkey()` — remove `mouseEventName` references**

Replace the mouse section in `resumeHotkey()` (lines 201-218) with:

```typescript
  // Mouse — replace listener with updated callback and restart monitoring
  if (isMousePaused && registeredMouseButton !== null) {
    try {
      if (mouseListener) {
        iohook.removeListener('otherMouseDown', mouseListener)
        iohook.removeListener('leftMouseDown', mouseListener)
        iohook.removeListener('rightMouseDown', mouseListener)
      }
      mouseCallback = callback
      mouseListener = (event: EventData) => {
        if (event.buttonNumber === registeredMouseButton) {
          callback()
        }
      }
      const eventName = registeredMouseButton <= 1
        ? (registeredMouseButton === 0 ? 'leftMouseDown' : 'rightMouseDown')
        : 'otherMouseDown'
      iohook.on(eventName, mouseListener)
      iohook.startMonitoring()
      isMousePaused = false
      console.log('[Hotkeys] Resumed mouse button:', registeredMouseButton)
    } catch (error) {
      console.error('[Hotkeys] Error resuming mouse monitoring:', error)
    }
  }
```

- [ ] **Step 5: Verify the app compiles**

Run: `pnpm build`
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/hotkeys.ts
git commit -m "feat: filter mouse events by buttonNumber from forked iohook-macos"
```

---

### Task 3: Fix registration logic — keyboard and mouse coexist

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Fix `setupHotkeys()` in `src/main/index.ts`**

Replace the body of `setupHotkeys()` (lines 100-129) with:

```typescript
async function setupHotkeys(): Promise<void> {
  if (!mainWindow) return

  const settings = await getSettings()
  const shortcuts = settings.keyboardShortcuts?.length
    ? settings.keyboardShortcuts
    : DEFAULT_SETTINGS.keyboardShortcuts
  const mouseButton = settings.mouseButton

  const callback = () => {
    mainWindow?.webContents.send(IPC.HOTKEY_TRIGGERED)
  }

  // Register keyboard shortcuts (always)
  const keyboardSuccess = registerHotkeys(shortcuts, callback)
  if (!keyboardSuccess) {
    console.error('[Main] Failed to register keyboard shortcuts:', shortcuts)
  }

  // Register mouse button (independently, if set)
  if (mouseButton !== null) {
    const mouseSuccess = registerMouseButton(mouseButton, callback)
    if (!mouseSuccess) {
      console.warn('[Main] Mouse button registration failed — keyboard shortcuts still active')
    }
  }
}
```

Key change: no more if/else. Keyboard always registers. Mouse registers additionally if configured.

- [ ] **Step 2: Add `unregisterMouseButton()` to `src/main/hotkeys.ts`**

`stopMouseMonitoring()` is private and not exported. We need a public function to clear only mouse registration without touching keyboard shortcuts. Add this exported function after `registerMouseButton()`:

```typescript
/** Unregister mouse button monitoring only. Keyboard shortcuts are preserved. */
export function unregisterMouseButton(): void {
  stopMouseMonitoring()
  console.log('[Hotkeys] Unregistered mouse button')
}
```

- [ ] **Step 3: Update the import in `src/main/ipc.ts`**

Find the import line from `./hotkeys` and add `unregisterMouseButton`:

```typescript
import { registerHotkeys, registerMouseButton, updateShortcuts, pauseHotkey, resumeHotkey, unregisterHotkeys, unregisterMouseButton } from './hotkeys'
```

- [ ] **Step 4: Fix `SET_SETTING` handler in `src/main/ipc.ts`**

Replace lines 204-218 with:

```typescript
    // Re-register shortcuts when keyboard or mouse shortcut settings change
    if (key === 'keyboardShortcuts' || key === 'mouseButton') {
      const mainWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Whisper Dictation')
      if (mainWin) {
        const updatedSettings = await getSettings()
        const callback = () => {
          mainWin.webContents.send(IPC.HOTKEY_TRIGGERED)
        }

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
```

- [ ] **Step 5: Verify the app compiles**

Run: `pnpm build`
Expected: No TypeScript errors.

- [ ] **Step 6: Manual test — change shortcuts at runtime**

Run: `pnpm dev`
1. Open settings, change keyboard shortcut from `Cmd+Shift+D` to `Cmd+Shift+W`
2. Press `Cmd+Shift+W` — should start recording
3. Press `Cmd+Shift+W` again — should stop recording
4. Set a mouse button (e.g., Back Button)
5. Press the mouse back button — should trigger recording
6. Press the forward button — should NOT trigger recording
7. Change keyboard shortcut back to `Cmd+Shift+D`
8. Press `Cmd+Shift+D` — should work. Mouse back button should still work too.

- [ ] **Step 7: Commit**

```bash
git add src/main/hotkeys.ts src/main/index.ts src/main/ipc.ts
git commit -m "fix: keyboard and mouse shortcuts register independently, not mutually exclusive"
```

---

### Task 4: Add vitest unit tests for hotkeys button filtering

**Files:**
- Create: `src/main/hotkeys.test.ts`

Since `hotkeys.ts` imports native modules (`electron`, `iohook-macos`), we need to mock them. The key thing to test is the button number filtering logic in the mouse listener callback.

- [ ] **Step 1: Write the test file**

Create `src/main/hotkeys.test.ts`:

```typescript
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

// Mock iohook-macos
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
    on: vi.fn((eventName: string, listener: (event: any) => void) => {
      capturedMouseListener = listener
    }),
    startMonitoring: mockStartMonitoring,
    stopMonitoring: mockStopMonitoring,
    isMonitoring: mockIsMonitoring,
    removeListener: mockRemoveListener,
  },
}))

// Import after mocks
const { registerHotkeys, registerMouseButton, unregisterMouseButton, unregisterHotkeys, isRegistered } = await import('./hotkeys')

describe('hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegister.mockReturnValue(true)
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

      // Simulate iohook event with button 3 (back) — should trigger
      capturedMouseListener!({ buttonNumber: 3 })
      expect(callback).toHaveBeenCalledTimes(1)

      // Simulate iohook event with button 4 (forward) — should NOT trigger
      capturedMouseListener!({ buttonNumber: 4 })
      expect(callback).toHaveBeenCalledTimes(1)

      // Simulate iohook event with button 2 (middle) — should NOT trigger
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

      // The first listener should be removed
      expect(mockRemoveListener).toHaveBeenCalled()

      // The new listener should only respond to button 4
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

      // Keyboard should still be registered (isRegistered checks both)
      // After unregistering mouse, keyboard shortcuts are still in the Set
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
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test -- src/main/hotkeys.test.ts`
Expected: All tests pass. If any fail, read the error, fix the test or implementation, and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/main/hotkeys.test.ts
git commit -m "test: add unit tests for hotkey button filtering and registration"
```

---

### Task 5: Add Playwright e2e tests for shortcut flow

**Files:**
- Create: `e2e/shortcuts.spec.ts`

- [ ] **Step 1: Write the e2e test file**

Create `e2e/shortcuts.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { launchApp, getBackgroundWindow, completeOnboarding, triggerHotkey, waitForState } from './helpers'

let electronApp: Awaited<ReturnType<typeof launchApp>>
let mainWindow: Awaited<ReturnType<typeof getBackgroundWindow>>

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
    await triggerHotkey(electronApp)
    await waitForState(electronApp, 'recording', 5000)

    // Stop recording
    await triggerHotkey(electronApp)
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
```

- [ ] **Step 2: Build the app for e2e testing**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Run the e2e tests**

Run: `pnpm test:e2e -- e2e/shortcuts.spec.ts`
Expected: All tests pass. These test the settings persistence and the independent registration logic. They do NOT test actual hardware input (Playwright can't simulate physical mouse buttons).

- [ ] **Step 4: Commit**

```bash
git add e2e/shortcuts.spec.ts
git commit -m "test: add e2e tests for shortcut registration independence"
```

---

### Task 6: Final verification and cleanup

- [ ] **Step 1: Run all tests**

Run: `pnpm test && pnpm build && pnpm test:e2e`
Expected: Unit tests pass, build succeeds, e2e tests pass.

- [ ] **Step 2: Manual smoke test with `pnpm dev`**

1. Launch app with `pnpm dev`
2. Open Settings > General
3. Set keyboard shortcut to `Cmd+Shift+D` — verify it shows in the UI
4. Press `Cmd+Shift+D` — verify recording starts
5. Set mouse button to Back Button (3)
6. Press mouse back button — verify recording toggles
7. Press mouse forward button — verify recording does NOT toggle
8. Change keyboard shortcut to `Cmd+Shift+W`
9. Press `Cmd+Shift+W` — verify it works
10. Press mouse back button — verify it still works (independent)
11. Clear mouse button in settings
12. Press mouse back button — verify nothing happens
13. Press `Cmd+Shift+W` — verify keyboard still works

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final cleanup from shortcut overhaul testing"
```
