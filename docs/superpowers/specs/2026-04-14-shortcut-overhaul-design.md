# Shortcut System Overhaul

## Problem

The shortcut system has two categories of bugs:

1. **Mouse buttons are indistinguishable.** iohook-macos maps all "extra" buttons (middle, back, forward, side) to the same `otherMouseDown` event (CGEventType 25). Pressing any extra button triggers recording — unusable for mice with back/forward buttons.

2. **Shortcut registration is flaky.** Keyboard and mouse shortcuts are treated as mutually exclusive in the registration logic. Changing a shortcut doesn't always take effect; old shortcuts persist; UI doesn't reflect actual state.

## Solution

### Part 1: Switch to forked iohook-macos

Replace `"iohook-macos": "^1.2.1"` with the fork at `github:ben-smith-atg/iohook-macos-fork`. The fork exposes `buttonNumber` in event data via `CGEventGetIntegerValueField(event, kCGMouseEventButtonNumber)`, returning 0-based values matching DOM MouseEvent.button (0=left, 1=right, 2=middle, 3=back, 4=forward, etc.).

### Part 2: Filter by buttonNumber in hotkeys.ts

Change `registerMouseButton()` to listen on `otherMouseDown` for all buttons and filter by `event.buttonNumber`:

```typescript
// Before: maps to event name, all extra buttons trigger
const eventName = buttonToEventName(button) // 'otherMouseDown'
iohook.on(eventName, () => { callback() })

// After: filter on specific button number
iohook.on('otherMouseDown', (event: EventData) => {
  if (event.buttonNumber === button) {
    callback()
  }
})
```

Remove `buttonToEventName()` — no longer needed. Left and right clicks still use `leftMouseDown`/`rightMouseDown` separately (no filtering needed for those).

### Part 3: Fix registration logic — keyboard and mouse coexist

**Current bug**: `SET_SETTING` handler and `setupHotkeys()` both do `if (mouseButton) { mouse } else { keyboard }` — they're mutually exclusive. If you have a mouse button set and change a keyboard shortcut, the keyboard shortcut never registers.

**Fix**: Register keyboard and mouse independently. Both can be active at the same time.

In `setupHotkeys()` (src/main/index.ts):
```
1. Register keyboard shortcuts (always, unless array is empty)
2. Register mouse button (if set, independently)
```

In `SET_SETTING` handler (src/main/ipc.ts):
```
if key is 'keyboardShortcuts':
  re-register keyboard shortcuts only (preserve mouse if set)
if key is 'mouseButton':
  re-register mouse button only (preserve keyboard shortcuts)
```

Also fix `registerHotkeys()` in hotkeys.ts — currently it only unregisters keyboard shortcuts on re-registration, which is correct. But `registerMouseButton()` should also only stop mouse monitoring, not touch keyboard. Verify this is already the case (it is — `stopMouseMonitoring()` only touches iohook state).

### Part 4: Pause/resume must handle both independently

`pauseHotkey()` and `resumeHotkey()` already handle both keyboard and mouse. Verify they still work correctly with the new independent registration model — they do, no changes needed.

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Swap `iohook-macos` dependency to fork |
| `src/main/hotkeys.ts` | Filter on `buttonNumber`, remove `buttonToEventName()`, update `registerMouseButton()` |
| `src/main/index.ts` | Fix `setupHotkeys()` to register keyboard and mouse independently |
| `src/main/ipc.ts` | Fix `SET_SETTING` handler to re-register keyboard and mouse independently |

## Testing

Add Playwright e2e tests that validate:

1. **Default keyboard shortcut registers on startup** — verify settings have `keyboardShortcuts` with default value, trigger `HOTKEY_TRIGGERED` IPC, assert pipeline enters `recording` state
2. **Changing keyboard shortcut takes effect** — use `SET_SETTING` to change `keyboardShortcuts`, verify old shortcut no longer triggers, new shortcut triggers
3. **Setting a mouse button registers it** — use `SET_SETTING` to set `mouseButton: 3`, verify mouse monitoring starts
4. **Clearing mouse button falls back to keyboard** — set `mouseButton: null`, verify keyboard shortcuts still work
5. **Keyboard and mouse coexist** — set both `keyboardShortcuts` and `mouseButton`, verify both trigger recording
6. **UI reflects current shortcuts** — read shortcut values from settings UI, verify they match what was set

These tests use the existing e2e infrastructure (`e2e/helpers.ts` — `launchApp()`, `getBackgroundWindow()`, `waitForState()`, `queryDebugBus()`).

Mouse button tests can't simulate physical mouse buttons from Playwright. Instead, test the registration and callback wiring:
- Call `SET_SETTING` with `mouseButton: 3`
- Verify iohook monitoring started (check via a test IPC channel that exposes `isRegistered()`)
- Send `HOTKEY_TRIGGERED` IPC directly to simulate what the callback would do
- Assert pipeline state changes correctly

The buttonNumber filtering logic is tested in a unit test against `hotkeys.ts` — mock iohook events with different `buttonNumber` values and verify only the configured button triggers the callback.
