# Mouse Button Shortcuts Implementation Brief

## Context

Whisper Dictation v6 is a macOS menu bar Electron app for voice dictation using local whisper.cpp transcription. Users toggle recording via a global keyboard shortcut (default: `Cmd+Shift+D`). The goal is to also support **mouse button shortcuts** — allowing users to trigger recording by pressing a specific mouse button (e.g., a side/back button) from anywhere in the system.

## Current State

The app already has stub infrastructure for this feature. The following are already built:

### Settings Schema (`src/shared/types.ts`)
- `mouseButton: number | null` field exists on `AppSettings`
- Default is `null` (no mouse button shortcut)

### Settings Defaults (`src/shared/constants.ts`)
- `mouseButton: null` in `DEFAULT_SETTINGS`

### Hotkey Module (`src/main/hotkeys.ts`)
- `registerMouseButton(button: number, callback: () => void)` — **stub only**, logs a warning and returns `false`
- `unregisterHotkeys()` — only handles keyboard shortcuts currently
- `pauseHotkey()` / `resumeHotkey()` — used during shortcut recording, keyboard-only

### Main Process (`src/main/index.ts:100-129`)
- `setupHotkeys()` already tries `registerMouseButton()` first if `mouseButton` is set
- Falls back to keyboard shortcuts if mouse registration fails
- Callback sends `HOTKEY_TRIGGERED` IPC to renderer

### UI — Shortcut Recorder (`src/renderer/src/components/ShortcutRecorder.tsx`)
- Already captures mouse button presses (buttons >= 3) via `onMouseDown`
- Shows display names: "Back Button", "Forward Button", "Side Button 1/2"

### Permissions (`src/main/permissions.ts`)
- `checkAccessibilityPermission()` already implemented using `systemPreferences.isTrustedAccessibilityClient()`
- `checkAllPermissions()` checks both microphone and accessibility

### IPC Channels (`src/shared/ipc.ts`)
- `HOTKEY_TRIGGERED` — main → renderer when shortcut fires
- `PAUSE_HOTKEY` / `RESUME_HOTKEY` — renderer → main during recording
- `REQUEST_ACCESSIBILITY` — for prompting accessibility permission

### Build System
- `electron-vite` v5.0.0 with `electron-builder` v25.1.0
- Already supports native modules: `keytar`, `@nut-tree-fork/nut-js`
- `pnpm.onlyBuiltDependencies` in `package.json` lists `electron`, `keytar`, `esbuild`
- `node-gyp` is in the dependency tree
- `@electron/rebuild` available
- `electron-builder.yml` has `asarUnpack: bin/**/*`

## Technical Constraints

1. **Electron's `globalShortcut` module does NOT support mouse buttons.** It only handles keyboard accelerators. This is confirmed by Electron Issue #13964 (open, no implementation).

2. **macOS Accessibility (TCC) permissions are required** for global mouse event monitoring via CGEventTap or NSEvent global monitors. The only exception is IOHIDManager (device-level), which bypasses TCC.

3. **System Integrity Protection (SIP) does NOT bypass Accessibility requirements.** There is no workaround — the user must grant permission.

4. **The app is macOS-only** (darwin, ARM64 dmg target). No cross-platform concerns.

## Recommended Library: `iohook-macos`

**Package:** `iohook-macos` (by hwanyong on GitHub/npm)

### Why this library:
- Actively maintained, macOS-focused
- Designed specifically for Electron apps
- Full TypeScript support
- Unified API for keyboard, mouse, and scroll events
- Built-in accessibility permission handling
- Event filtering capabilities
- Performance optimization (throttling, polling control)

### Why NOT other options:
| Library | Why Not |
|---------|---------|
| `iohook` (original) | Not maintained for modern macOS/Electron |
| `@tkomde/iohook` | Deprecated for macOS, recommends iohook-macos |
| `mouse-hooks` | Unclear maintenance, limited features |
| `mouse-hook` | 2 commits, not production-ready |
| `nut.js` / `robotjs` | For automation/control, not event detection |
| Custom IOHIDManager addon | High effort, but viable if permissions are a concern |

## Implementation Plan

### Step 1: Install `iohook-macos`

```bash
pnpm add iohook-macos
```

Add to `pnpm.onlyBuiltDependencies` in `package.json`:
```json
"onlyBuiltDependencies": ["electron", "keytar", "esbuild", "iohook-macos"]
```

Verify native module compilation works with:
```bash
pnpm electron-vite dev
```

### Step 2: Implement `registerMouseButton()` in `src/main/hotkeys.ts`

Replace the stub with actual iohook-macos integration:

```
Current stub (lines 43-46):
  export function registerMouseButton(button: number, _callback: () => void): boolean {
    console.warn(`[Hotkeys] Mouse button ${button} shortcuts require native module support`)
    return false
  }
```

The replacement should:
1. Import iohook-macos
2. On `registerMouseButton(button, callback)`:
   - Start monitoring if not already started
   - Listen for `mousedown` events where `event.button` matches the configured button
   - Call the callback when matched
3. Track registered mouse button in a module-level variable (similar to `registeredShortcuts`)
4. On `unregisterHotkeys()`: also stop mouse monitoring
5. On `pauseHotkey()`: temporarily stop mouse monitoring
6. On `resumeHotkey()`: restart mouse monitoring with stored callback

### Key API Details for iohook-macos

Mouse event structure (from docs):
- `event.button`: button number (1=left, 2=right, 3=middle, 4/5=side buttons)
- `event.type`: 'mousedown', 'mouseup', 'mouseclick', 'mousemove', 'mousedrag', 'mousewheel'
- `event.x`, `event.y`: screen coordinates

Core methods:
- `startMonitoring()` / `stopMonitoring()` / `isMonitoring()`
- Event listener pattern for mouse events
- `setEventFilter()` to only listen for mouse events (not keyboard/scroll)

### Step 3: Update `unregisterHotkeys()`

Add mouse cleanup alongside existing keyboard cleanup:

```typescript
export function unregisterHotkeys(): void {
  // Existing keyboard cleanup
  for (const shortcut of registeredShortcuts) { ... }
  registeredShortcuts.clear()

  // NEW: mouse cleanup
  if (registeredMouseButton !== null) {
    stopMouseMonitoring()
    registeredMouseButton = null
  }
}
```

### Step 4: Update `pauseHotkey()` and `resumeHotkey()`

Both need to also pause/resume mouse monitoring:

- `pauseHotkey()`: stop iohook-macos monitoring temporarily
- `resumeHotkey(callback)`: restart with the same callback

### Step 5: Update `isRegistered()`

```typescript
export function isRegistered(): boolean {
  return registeredShortcuts.size > 0 || registeredMouseButton !== null
}
```

### Step 6: Accessibility Permission Flow

The app already checks accessibility in `permissions.ts` using `systemPreferences.isTrustedAccessibilityClient()`. The implementation should:

1. Before starting mouse monitoring, check if accessibility is granted
2. If not granted, send `REQUEST_ACCESSIBILITY` IPC to prompt the user
3. Only proceed with iohook-macos `startMonitoring()` after permission is confirmed
4. If permission is denied, `registerMouseButton()` should return `false` (triggering the existing keyboard fallback)

### Step 7: Verify `setupHotkeys()` flow still works

The existing flow in `src/main/index.ts:100-129` should work as-is:

```
1. Read settings (keyboardShortcuts + mouseButton)
2. If mouseButton set, try registerMouseButton()
3. If mouse fails, fall back to keyboard
4. If no mouseButton, just register keyboard
```

The only change needed is that `registerMouseButton()` now returns `true` on success instead of always returning `false`.

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `iohook-macos` dependency and to `onlyBuiltDependencies` |
| `src/main/hotkeys.ts` | Replace stub with iohook-macos implementation |
| `src/main/index.ts` | Potentially minor adjustments to `setupHotkeys()` error handling |

That's it. The settings schema, UI, IPC channels, permissions, and fallback logic are all already in place.

## Testing Checklist

- [ ] `pnpm install` completes without native build errors
- [ ] App launches without crashes related to iohook-macos
- [ ] Setting a mouse button in the UI persists to settings
- [ ] Pressing the configured mouse button triggers recording (globally, outside app)
- [ ] Keyboard shortcuts still work when no mouse button is configured
- [ ] Keyboard shortcuts still work as fallback if mouse registration fails
- [ ] Pause/resume works correctly (no double-triggering during shortcut recording)
- [ ] Accessibility permission prompt appears when needed
- [ ] App gracefully handles accessibility permission being denied
- [ ] Unregistering mouse button (setting to null) stops monitoring
- [ ] App quits cleanly without zombie iohook processes

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| iohook-macos fails to compile on user's machine | Existing fallback to keyboard shortcuts handles this gracefully |
| Accessibility permission denied by user | `registerMouseButton()` returns `false`, falls back to keyboard |
| iohook-macos conflicts with other input monitoring apps (BetterTouchTool, etc.) | Unlikely but documented as known limitation |
| iohook-macos becomes unmaintained | Alternative: custom IOHIDManager addon (no permissions needed, higher effort) |
| Native module breaks on Electron version upgrade | Pin Electron version; test upgrades carefully |
