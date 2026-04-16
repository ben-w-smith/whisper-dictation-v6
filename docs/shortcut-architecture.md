# Shortcut System Architecture

The shortcut system is the most fragile part of the codebase. It spans 3 processes (renderer, main, native iohook), 4 windows (background, overlay, home, onboarding), and has two independent registration systems that must coexist.

## Overview

Two shortcut types, both triggering the same callback:

| Type | API | Scope | Buttons Supported |
|------|-----|-------|-------------------|
| Keyboard | Electron `globalShortcut` (Carbon RegisterEventHotKey) | System-wide | All standard keys + modifiers |
| Mouse button | `iohook-macos` native addon (CGEventTap) | System-wide | Buttons 3+ (back, forward, gaming mouse) |

Both call `mainWin.webContents.send(IPC.HOTKEY_TRIGGERED)`, which the XState pipeline in the background window picks up.

## Keyboard Shortcut Flow

```
User presses keyboard shortcut
  → Electron globalShortcut fires callback
  → Background window receives HOTKEY_TRIGGERED
  → XState pipeline starts recording
```

Registration: `globalShortcut.register(accelerator, callback)` in `hotkeys.ts`.

## Mouse Button Capture Flow (Full Pipeline)

This is the complex path — 10 steps across 3 processes and 2 windows:

```
1. User clicks ShortcutRecorder button → startRecording()
2. startRecording sends PAUSE_HOTKEY + CAPTURE_MOUSE_BUTTON via IPC
3. PAUSE_HOTKEY: unregisters keyboard shortcuts, stops iohook monitoring
4. CAPTURE_MOUSE_BUTTON: starts iohook with one-shot capture listener
5. User presses mouse button → iohook fires otherMouseDown with buttonNumber
6. Capture listener fires → removes itself, stops iohook
7. Main process sends MOUSE_BUTTON_CAPTURED back to event.sender (NOT background window!)
8. ShortcutRecorder receives button number → onChange(null, buttonNumber)
9. GeneralPage/Onboarding handler calls updateSetting('mouseButton', buttonNumber)
10. SET_SETTING handler saves setting, re-registers both keyboard and mouse
```

## DOM vs macOS Button Number Mapping

DOM and macOS use different button numbering for the first 3 buttons:

| Button | DOM (MouseEvent.button) | macOS (CGMouseButton) |
|--------|------------------------|----------------------|
| Left | 0 | 0 |
| Middle | 1 | 2 |
| Right | 2 | 1 |
| Back | 3 | 3 |
| Forward | 4 | 4 |
| Side 5+ | N/A (DOM can't see these) | 5+ |

The mapping is handled by `domButtonToMacOS()` in `hotkeys.ts`. Buttons 3+ match between DOM and macOS, so they pass through unchanged.

**Why DOM can't see buttons 5+:** Chromium only fires DOM mouse events for buttons 0-4. Gaming mouse buttons (5, 6, 7, etc.) require iohook's CGEventTap to detect.

## Key Files

| File | Responsibility |
|------|---------------|
| `src/main/hotkeys.ts` | Keyboard and mouse registration, capture, pause/resume |
| `src/main/ipc.ts` | SET_SETTING handler, CAPTURE_MOUSE_BUTTON relay |
| `src/main/index.ts` | setupHotkeys() for initial registration, EPIPE guard |
| `src/renderer/src/components/ShortcutRecorder.tsx` | UI for recording shortcuts |
| `src/renderer/src/views/home/GeneralPage.tsx` | onChange handler → updateSetting calls |
| `src/renderer/src/components/Onboarding.tsx` | Simpler onChange handler (local state only) |
| `src/main/shortcut-integration.test.ts` | Integration tests for SET_SETTING → registration flow |
| `src/main/hotkeys.test.ts` | Unit tests for hotkey registration |

## Window Architecture (Why Routing Matters)

The app has 4 windows, each registered by role in `src/main/windows.ts` for IPC routing:

| Window | Role | Contains |
|--------|------|----------|
| Background | `background` | XState pipeline, audio capture, hotkey listener |
| Settings | `home` | ShortcutRecorder, settings UI |
| Overlay | `overlay` | Waveform display |
| Onboarding | `onboarding` | Setup wizard with ShortcutRecorder |
| About | `about` | Version info |

Use `getWindow(role)`, `sendTo(role, channel, ...args)`, or `broadcast(channel, ...args)` from `src/main/windows.ts`. Do not look up windows by title.

**Critical:** `CAPTURE_MOUSE_BUTTON` must use `event.sender.send()` to route the response back to whichever window initiated the capture (Home or Onboarding). It must NOT send to the background window — ShortcutRecorder isn't there.

## Rules for Future Changes

1. **Never send MOUSE_BUTTON_CAPTURED to a specific window** — always use `event.sender`
2. **Keyboard and mouse registration must be independent** — never if/else, always register both
3. **SET_SETTING for either shortcut type re-registers BOTH** — because they share the callback
4. **Never call RESUME_HOTKEY from the capture flow** — SET_SETTING handler handles re-registration
5. **Don't put console.log in iohook listeners** — EPIPE crashes when terminal pipe breaks. The app has process.stdout/stderr error handlers in index.ts as a safety net
6. **Use `typeof mouse === 'number'` to distinguish mouse captures** — `null !== undefined` is true, so `!== undefined` doesn't work
7. **Test after every change** — this system has cascading failure modes

## Bug History

Nine bugs were hit during the shortcut overhaul (2026-04-14). Documented here to prevent recurrence:

1. **Mouse not registered on setting change** — SET_SETTING only handled keyboard shortcuts
2. **Buttons 5+ invisible** — DOM only fires events for buttons 0-4; replaced with iohook capture
3. **DOM/macOS button mismatch** — DOM 1=middle vs macOS 1=right; added domButtonToMacOS() mapping
4. **RESUME_HOTKEY races SET_SETTING** — Re-registers old button before new one saves; removed stopRecording() from capture handler
5. **Two SET_SETTING calls race** — KeyboardShortcuts handler re-registers old mouse; fixed by sending only mouseButton update on mouse capture
6. **Wrong window for capture response** — Sent to background window instead of Home window; fixed with event.sender
7. **`null !== undefined` type check** — Keyboard captures routed to mouse branch; fixed with `typeof mouse === 'number'`
8. **Clear button did nothing** — `onChange(null, null)` hit no branch; added explicit null/null handler
9. **EPIPE crash from console.log** — Terminal pipe break in iohook listener crashed app; added EPIPE guards and removed debug logging
