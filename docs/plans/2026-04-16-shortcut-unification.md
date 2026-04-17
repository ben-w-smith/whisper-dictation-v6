# Shortcut System Unification

**Date:** 2026-04-16
**Status:** Draft
**Owner:** Ben
**Related:** [shortcut-architecture.md](../shortcut-architecture.md), [mouse-shortcuts-implementation-brief.md](../mouse-shortcuts-implementation-brief.md), [ROADMAP.md](../ROADMAP.md) (Specific Mouse Button Support)

## Problem

Two independent registration systems must coexist in the current hotkey stack:

1. **Electron `globalShortcut`** — Carbon `RegisterEventHotKey`. Handles keyboard. No key-up, no left/right modifier disambiguation, no specific mouse buttons.
2. **`iohook-macos` fork** — CGEventTap. Handles mouse buttons 3+ only.

Both funnel into the same `HOTKEY_TRIGGERED` IPC, but they have separate lifecycles and must be kept in sync across a pause/resume handshake with the settings window. [`shortcut-architecture.md`](../shortcut-architecture.md) documents **nine distinct bugs** hit during the last overhaul. The system has cascading failure modes because:

- Module-level mutable state in `src/main/hotkeys.ts` (`registeredShortcuts`, `registeredMouseButton`, `mouseCallback`, `mouseListener`, `isMousePaused`)
- Title-based IPC routing for the capture response (see plan `2026-04-16-window-id-addressing.md`)
- DOM vs macOS button number mismatch for buttons 0–2
- `PAUSE_HOTKEY` / `RESUME_HOTKEY` racing `SET_SETTING` re-registration
- Push-to-talk mode exists in settings but shares toggle behavior at runtime (`src/renderer/src/App.tsx` L280–283 acknowledges this)
- EPIPE crashes from `console.log` inside iohook listeners

AI coding assistants struggle here because reasoning is non-local: any change has to hold 3 processes, 4 windows, and the race space in its head.

## Goal

One event source (CGEventTap-based) for both keyboard and mouse, owned by a single state machine in the main process, with real push-to-talk support.

## Non-Goals

- Cross-platform (Windows/Linux) hotkey support — macOS-only, same as today
- Arbitrary chord recording (e.g. "Cmd+K, then Cmd+S") — single shortcut tokens only
- Voice-triggered recording (wake word) — separate roadmap item
- Replacing `keytar` or any other native addon

## Approach Summary

Extend the `iohook-macos` fork to emit keyboard events (key-down + key-up with modifier flags), then replace `Electron.globalShortcut` usage entirely. Wrap the whole subsystem in an XState machine in the main process, with pure matcher functions that turn settings into fire/no-fire decisions. Delete the pause/resume handshake — the machine's `capturing` state handles it internally.

---

## Phase 0 — Research & Spike (1–2 days)

**Goal:** de-risk the fork work before committing to it.

### Tasks

- Build a standalone Node script (`spike/shortcut-spike.ts`) that:
  - Binds `Option+Space` via the current `iohook-macos` fork (mouse-only API)
  - Attempts to add keyboard monitoring — verify whether the underlying CGEventTap is already capturing `kCGEventKeyDown` / `kCGEventKeyUp` events or if we need to add event mask bits
  - Logs timestamp on press and release; verify key-up fires reliably
  - Measures press-to-callback latency (target: <5ms p95)
- Confirm accessibility permission behavior:
  - CGEventTap requires accessibility permission unconditionally
  - Document the first-run UX change (we currently register `globalShortcut` without it)
- Decide: extend the existing fork vs. write a purpose-built addon?
  - Default: extend the fork (`github:ben-w-smith/iohook-macos-fork`) since it's already in production and handles the TCC permission flow

### Go/No-Go

Proceed to Phase 1 only if:
- Key-up events fire within 50ms of physical release
- Latency is comparable to current `globalShortcut` (informally <10ms)
- No show-stopping macOS version compatibility surprises (Sequoia 15.x is the baseline)

---

## Phase 1 — Extend the `iohook-macos` Fork

**Goal:** native layer can emit key and mouse events with enough metadata to match shortcuts.

### Native addon changes

Files live in `ben-w-smith/iohook-macos-fork` (separate repo). Changes include:

- Add keyboard event masks to the CGEventTap setup (`kCGEventKeyDown`, `kCGEventKeyUp`, `kCGEventFlagsChanged`)
- Expose new event payload fields:
  - `keyCode: number` — virtual key code from `kCGKeyboardEventKeycode`
  - `flags: number` — raw `CGEventFlags`
  - `isRepeat: boolean` — from `kCGKeyboardEventAutorepeat` so we can ignore auto-repeat
- Emit events as `keyDown`, `keyUp` (match the existing `otherMouseDown` naming)
- Add a native-level shortcut filter: pass an allowlist of `{ keyCode, modifiers }` tuples and only emit JS events on matches. This is critical for privacy + perf — we don't want every keystroke crossing the JS bridge.
- Bump fork version, publish to GitHub tag

### TypeScript types

In `node_modules/iohook-macos/index.d.ts` (via the fork):

```ts
interface KeyEventData {
  type: 'keyDown' | 'keyUp'
  keyCode: number
  flags: number
  isRepeat: boolean
  timestamp: number
}

interface MouseEventData {
  type: 'leftMouseDown' | 'rightMouseDown' | 'otherMouseDown' | /* ... */
  buttonNumber?: number
  x: number
  y: number
  timestamp: number
}

export function setShortcutFilter(shortcuts: Array<{ keyCode: number; modifiers: number }>): void
```

### Acceptance

- Spike script binds `Option+Space`, receives both keyDown and keyUp, flags indicate Option pressed, auto-repeat filtered out
- Setting an empty shortcut filter delivers zero keyboard events (privacy default)

---

## Phase 2 — Hotkey State Machine

**Goal:** all hotkey state lives in one XState machine with pure transitions.

### New file

`src/main/hotkey-machine.ts`

```ts
type HotkeyContext = {
  shortcuts: ParsedShortcut[]          // from settings
  recordingMode: 'toggle' | 'push-to-talk'
  activePressedKey: ParsedShortcut | null  // for PTT key-up detection
  captureRequestedBy: number | null    // BrowserWindow id of active recorder
}

type HotkeyState =
  | { value: 'stopped' }                // iohook not monitoring
  | { value: 'armed' }                  // listening for configured shortcuts
  | { value: 'ptt_holding' }            // user is holding a PTT key, waiting for release
  | { value: 'capturing' }              // a recorder window asked to bind a new shortcut

type HotkeyEvent =
  | { type: 'SETTINGS_LOADED'; shortcuts: ParsedShortcut[]; mode: RecordingMode }
  | { type: 'KEY_DOWN'; keyCode: number; flags: number; isRepeat: boolean }
  | { type: 'KEY_UP'; keyCode: number; flags: number }
  | { type: 'MOUSE_DOWN'; buttonNumber: number }
  | { type: 'START_CAPTURE'; fromWindowId: number }
  | { type: 'STOP_CAPTURE' }
  | { type: 'WINDOW_CLOSED'; windowId: number }
```

### Transitions (summary)

| From | Event | Guard | To | Effect |
|------|-------|-------|----|--------|
| `stopped` | `SETTINGS_LOADED` | shortcuts.length > 0 | `armed` | `startMonitoring()`, `setShortcutFilter()` |
| `armed` | `KEY_DOWN` | matches shortcut, mode=toggle | `armed` | fire `HOTKEY_TRIGGERED` |
| `armed` | `KEY_DOWN` | matches shortcut, mode=ptt | `ptt_holding` | fire `HOTKEY_TRIGGERED` (start) |
| `ptt_holding` | `KEY_UP` | matches held key | `armed` | fire `HOTKEY_TRIGGERED` (stop) |
| `armed` | `MOUSE_DOWN` | matches mouseButton setting | `armed` | fire `HOTKEY_TRIGGERED` |
| `armed` | `START_CAPTURE` | — | `capturing` | pass through raw events; don't match shortcuts |
| `capturing` | `KEY_DOWN` or `MOUSE_DOWN` | not Escape | `armed` | send `CAPTURE_RESULT` to requesting window |
| `capturing` | `WINDOW_CLOSED` | id matches captureRequestedBy | `armed` | cancel capture |

### Zero module-level mutable state

All existing globals in `src/main/hotkeys.ts` (`registeredShortcuts`, `registeredMouseButton`, `mouseCallback`, `mouseListener`, `isMousePaused`) move into the machine's context.

### Tests

`src/main/hotkey-machine.test.ts`:
- Snapshot tests for each transition
- PTT: key-down triggers start, key-up triggers stop, holding <100ms still triggers (no debounce surprise)
- Auto-repeat events with `isRepeat: true` are ignored
- Capture: START → first non-Escape event → result delivered → back to armed
- Capture: START → window closes → armed (no leaked state)
- Two windows requesting capture: second replaces first, first gets cancel event

---

## Phase 3 — Shortcut Matcher

**Goal:** pure function maps event → shortcut or null.

### New file

`src/main/shortcut-matcher.ts`

```ts
export interface ParsedShortcut {
  modifiers: number        // bitmask: CMD|SHIFT|OPT|CTRL
  keyCode: number          // macOS virtual key code
  source: string           // original accelerator string for debugging
}

export function parseAccelerator(s: string): ParsedShortcut | Error
export function matchEvent(event: KeyEvent, shortcuts: ParsedShortcut[]): ParsedShortcut | null
export function acceleratorFromEvent(event: KeyEvent): string
export function shortcutFilterForNative(shortcuts: ParsedShortcut[]): Array<{ keyCode: number; modifiers: number }>
```

### Why pure

Matching is the hottest code path (fires on every keystroke that clears the native filter). Pure functions → trivially unit-testable, no surprises, easy for AI to modify.

### Tests

- `parseAccelerator('Command+Shift+D')` → correct bitmask + keyCode
- `parseAccelerator('Option+Space')` → correct
- `parseAccelerator('Invalid+Key')` → Error
- `matchEvent` returns the right shortcut when flags match, null when they don't
- `matchEvent` is insensitive to NumLock / CapsLock flag bits (mask them out)

---

## Phase 4 — Wire Push-to-Talk End-to-End

**Goal:** PTT mode actually differs from toggle at runtime.

### Settings

- Add `recordingMode` back to `AppSettings` (was in spec, dropped from implementation)
- Default: `'toggle'` for backward compat

### Pipeline state machine (`pipelineMachine.ts`)

- Add `HOTKEY_START` and `HOTKEY_STOP` events alongside existing `HOTKEY_PRESSED`
- `idle -- HOTKEY_START --> recording`
- `recording -- HOTKEY_STOP --> transcribing` (unless too short, then → idle)
- Keep `HOTKEY_PRESSED` for toggle mode backward compat

### Machine integration

The hotkey machine emits `HOTKEY_START` / `HOTKEY_STOP` in PTT mode and `HOTKEY_PRESSED` in toggle mode. The pipeline doesn't need to know about mode.

### Edge cases to handle

- User holds PTT key <100ms — still trigger, let pipeline `recordingTooShort` guard discard. No debouncing in hotkey layer.
- User holds PTT key, app loses accessibility permission mid-hold — emit `HOTKEY_STOP` defensively on next heartbeat
- User holds key + triggers another shortcut combo (e.g. Cmd+Tab) — `KEY_UP` for PTT key should still fire when user releases; don't confuse with other keys

### UI

- Surface `recordingMode` in `GeneralPage.tsx` as a segmented control (Toggle / Push to talk)
- Update shortcut helper text dynamically ("Press and hold to record" vs "Press once to start, again to stop")

---

## Phase 5 — Collapse the Two-System Divide

**Goal:** delete `Electron.globalShortcut` usage; hotkey machine is the single authority.

### Deletions

- `Electron.globalShortcut` import and all calls in `src/main/hotkeys.ts`
- `pauseHotkey()` / `resumeHotkey()` functions
- `IPC.PAUSE_HOTKEY` / `IPC.RESUME_HOTKEY` channels (both directions)
- `domButtonToMacOS()` in the capture path — keyboard events now arrive from iohook with native `keyCode`, mouse events already used native `buttonNumber`

### ShortcutRecorder.tsx changes

Before:
```ts
startRecording() {
  window.api.send(IPC.PAUSE_HOTKEY)
  window.api.send(IPC.CAPTURE_MOUSE_BUTTON)
}
```

After:
```ts
startRecording() {
  window.api.send(IPC.START_CAPTURE)  // one call, handles both kb + mouse
}
```

The main process automatically enters `capturing` state, pauses shortcut matching, and sends back `CAPTURE_RESULT` via `event.sender` (see Phase 2). No explicit resume — transition to `armed` is automatic on first capture event or `WINDOW_CLOSED`.

### New IPC surface

| Channel | Direction | Payload | Replaces |
|---------|-----------|---------|----------|
| `shortcut:start-capture` | R → M | `void` | `PAUSE_HOTKEY` + `CAPTURE_MOUSE_BUTTON` |
| `shortcut:stop-capture` | R → M | `void` | `RESUME_HOTKEY` (optional, auto-cancels on window close) |
| `shortcut:captured` | M → R | `{ accelerator?: string; mouseButton?: number }` | `MOUSE_BUTTON_CAPTURED` + DOM keydown |
| `shortcut:triggered` | M → R | `{ event: 'start' \| 'stop' \| 'toggle' }` | `HOTKEY_TRIGGERED` (extended) |

---

## Phase 6 — Migration & Cleanup

- Rename `src/main/hotkeys.ts` → `src/main/hotkey-legacy.ts` as a throwaway reference; delete after one release
- Update `src/main/index.ts` `setupHotkeys()` to instantiate and start the machine instead
- Update `src/main/ipc.ts` `SET_SETTING` handler for `keyboardShortcuts` / `mouseButton` / `recordingMode` to send events into the machine instead of calling imperative functions
- Update tests: `hotkeys.test.ts` → `hotkey-machine.test.ts` + `shortcut-matcher.test.ts`
- Update `docs/shortcut-architecture.md` to describe the new architecture (keep bug history section for posterity)
- Migration note in `ROADMAP.md`

---

## Testing Strategy

### Unit (Vitest)

- `shortcut-matcher.test.ts` — parsing, matching, edge cases
- `hotkey-machine.test.ts` — state transitions via `createActor` + manual events
- Run in milliseconds; no Electron or iohook

### Integration (Playwright E2E)

- `e2e/shortcuts.spec.ts`:
  - Simulate key press via macOS System Events (osascript fallback if `page.keyboard` can't escape Electron)
  - Verify pipeline reaches `recording` state
  - Hold key 2s, release → verify transcribing starts on release (PTT)
  - Tap key → verify toggle behavior
  - Open settings → start capture → press key → verify captured shortcut matches

### Manual smoke

- First-run accessibility permission flow on a clean machine
- Rebind shortcut while settings window is open (race path that previously bit us)
- Sleep / wake cycle — iohook must resume cleanly
- External USB keyboard hot-swap

### Regression

- All 9 bug scenarios from `shortcut-architecture.md` get a dedicated test case (pass = bug is structurally impossible)

---

## Rollback

- Gate the new system behind an env var `WHISPER_HOTKEY_V2=0` for one release
- If critical bug hits, flip env var to fall back to legacy system
- After one release with no issues, delete legacy code in a cleanup PR

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CGEventTap requires accessibility permission that `globalShortcut` didn't | High (certain) | Make accessibility part of the onboarding flow with a clear explainer; fall back to disabled-shortcuts state with guidance if denied |
| `iohook-macos` fork maintenance burden grows | Medium | Keep native changes minimal; document build steps in the fork README |
| Native keyboard filter has a security/privacy optics issue (tapping all keys) | Medium | Enforce the native-level allowlist; never forward unmatched events to JS; add a prominent note in privacy docs |
| AudioWorklet + hotkey work collide on `App.tsx` | Low | Sequence: finish hotkey plan first, then audio plan |
| PTT UX bad for long-press RSI users | Low | Ship toggle as default; PTT opt-in |
| macOS Tahoe 26.x or future OS breaks CGEventTap | Unknown | Monitor Apple Dev forums; CGEventTap has been stable for 10+ years |

---

## Acceptance Criteria

- [ ] Zero usages of `Electron.globalShortcut` in `src/main/`
- [ ] Zero module-level mutable state in the hotkey subsystem (all state in machine context)
- [ ] Zero usages of `IPC.PAUSE_HOTKEY` / `IPC.RESUME_HOTKEY`
- [ ] Push-to-talk mode functional: key-down starts recording, key-up stops it
- [ ] Toggle mode functional and default
- [ ] All 9 bugs in `shortcut-architecture.md` have regression tests that pass
- [ ] `hotkey-machine.test.ts` covers all documented transitions
- [ ] `docs/shortcut-architecture.md` updated to reflect new design
- [ ] Onboarding flow explicitly requests accessibility permission with rationale
- [ ] Keyboard event filtering happens in the native layer (not JS)

---

## Open Questions

1. **Should we support arbitrary mouse button numbers in the UI?** ROADMAP has this as a separate item. After Phase 5 the infrastructure supports it; only the UI gating needs loosening.
2. **Left-vs-right modifier disambiguation?** CGEventFlags distinguishes `NX_DEVICELCMDKEYMASK` vs `NX_DEVICERCMDKEYMASK`. Worth exposing? Probably not for MVP.
3. **Do we want a "global mute" shortcut?** Unrelated but trivial to add once the machine exists.
4. **Can the `capturing` state be triggered without involving the settings renderer at all?** e.g. a tray menu item "Set shortcut" that does capture headlessly. Not urgent, but the architecture would support it.

---

## Estimate

- Phase 0 (spike): 1–2 days
- Phase 1 (native): 2–3 days
- Phase 2 (machine): 2 days
- Phase 3 (matcher): 1 day
- Phase 4 (PTT): 1–2 days
- Phase 5 (collapse): 1 day
- Phase 6 (cleanup): 1 day

**Total: ~2 weeks of focused work**, gated on Phase 0 outcome.
