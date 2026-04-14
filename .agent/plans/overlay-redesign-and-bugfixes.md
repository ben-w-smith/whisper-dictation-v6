# Overlay Redesign + Bug Fix Plan

## Scope

6 bug fixes + overlay redesign + multi-shortcut support + recording mode removal.

---

## Phase 1: Foundation Changes (types, constants, hotkeys)

### 1.1 Update `AppSettings` types (`src/shared/types.ts`)
- Remove `RecordingMode` type entirely
- Change `keyboardShortcut: string` → `keyboardShortcuts: string[]`
- Keep `mouseButton: number | null` (roadmap)
- Add `CANCEL_RECORDING` to `PipelineEvent` type (for overlay X button)

### 1.2 Update defaults (`src/shared/constants.ts`)
- Remove `recordingMode` from `DEFAULT_SETTINGS`
- Change `keyboardShortcut: 'Command+Shift+D'` → `keyboardShortcuts: ['Command+Shift+D']`
- Add overlay redesign constants: bar count (12), gradient colors
- Remove `WHIMSICAL_MESSAGES` (replaced by subtle pulse animation)

### 1.3 Multi-shortcut hotkeys (`src/main/hotkeys.ts`)
- Change internal storage from `registeredShortcut: string | null` → `registeredShortcuts: Set<string>`
- `registerHotkeys()` accepts `string[]`, registers all, unregisters all previous
- `updateShortcuts()` (new name) handles array replacement
- `pauseHotkey()` / `resumeHotkey()` operates on all registered shortcuts
- Keep `registerMouseButton()` stub as-is (roadmap)

### 1.4 Multi-shortcut main process (`src/main/index.ts`)
- `setupHotkeys()` reads `keyboardShortcuts` array, passes to `registerHotkeys()`
- When `mouseButton` is set, still logs warning + falls back to keyboard

### 1.5 Multi-shortcut IPC handler (`src/main/ipc.ts`)
- `SET_SETTING` for `keyboardShortcuts` → calls `updateShortcuts()` with full array
- Remove old single-shortcut `updateShortcut` call

### 1.6 Migration in store (`src/main/store.ts`)
- On load: if `keyboardShortcut` (old string) exists, migrate to `keyboardShortcuts` (array)
- Delete old `recordingMode` key if present

---

## Phase 2: ShortcutRecorder Multi-Shortcut UI

### 2.1 Rewrite ShortcutRecorder (`src/renderer/src/components/ShortcutRecorder.tsx`)
- Props: `shortcuts: string[]`, `mouseButton: number | null`, `onChange(shortcuts, mouse)`
- Display a list of current shortcuts with X remove buttons
- "Add Shortcut" button opens recorder mode (same capture logic)
- Each list item shows formatted accelerator + delete icon
- Mouse button capture still works but shows "Requires native module" badge

### 2.2 Update GeneralPage (`src/renderer/src/views/home/GeneralPage.tsx`)
- Remove Recording Mode section entirely (lines 202-227)
- Replace with a note under the Shortcut section: "Press your shortcut to start recording, press again to stop."
- Remove `recordingMode` state and the `RecordingMode` import
- Wire ShortcutRecorder to `keyboardShortcuts` array
- `onChange` calls `updateSetting('keyboardShortcuts', shortcuts)`

---

## Phase 3: Overlay Redesign

### 3.1 New OverlayWindow in App.tsx (`src/renderer/src/App.tsx`)

**Recording state:**
- Left: X button (gray circle with X) → sends `CANCEL_RECORDING` event
- Center: 12 thin vertical bars (2px wide, 24px max height)
  - Color gradient: left-to-right, teal (#14b8a6) → purple (#a855f7) → pink (#ec4899)
  - Bar height driven by audio levels (decoupled fast path)
  - Smooth CSS transitions (75ms)
- Right: Red circle stop button → sends `HOTKEY_PRESSED` (same as stop)
- No text labels, no timer display, no red recording dot
- Background: same `bg-stone-900/85 backdrop-blur-xl rounded-full` pill
- Width ~360px, height ~52px

**Transcribing state:**
- Single pulsing dot or small waveform icon, centered
- Subtle scale+opacity pulse animation (1.5s cycle)
- No text, no whimsical messages

**Complete state:**
- Green checkmark, centered
- Auto-dismiss after 500ms (already configured in pipeline machine)
- Brief flash effect on appear

**Error state:**
- Orange warning icon + error text
- Auto-dismiss after current timeout
- Same click-to-dismiss behavior

### 3.2 Overlay.tsx component (`src/renderer/src/components/Overlay.tsx`)
- Match the same redesign as OverlayWindow (shared visual language)
- Simplify to match — remove whimsical messages, recording dot, timer

### 3.3 CSS artifact fix
- The `animate-ping` red dot is being removed entirely (replaced by waveform bars)
- This eliminates the black circle artifact at its source

---

## Phase 4: Audio Levels Decoupling

### 4.1 Direct overlay audio path in App.tsx
The current fast-path (50ms interval) in `DictationApp` already bypasses the state machine for the overlay. The remaining lag comes from:
1. IPC relay latency (background → main → overlay)
2. React re-render batching in the overlay window

**Fix:**
- Reduce the overlay audio interval from 50ms → 33ms (~30fps)
- In the overlay window (`OverlayWindow`), use `requestAnimationFrame` for bar animation instead of React state updates
- Store audio levels in a ref, render bars via CSS custom properties updated directly on DOM elements
- This eliminates React rendering overhead entirely for the bars

### 4.2 AudioCapture level smoothing (`src/renderer/src/audio/capture.ts`)
- Apply exponential smoothing to level values before returning
- This prevents the "first levels then pause" behavior caused by raw RMS jitter

---

## Phase 5: Sound Design

### 5.1 Sound synthesis in App.tsx
Replace the single `playTone(880, 150)` with three distinct tones:

**Recording start (880Hz, 120ms):** Short, crisp ascending ping
- Current behavior, keep as-is but slightly shorter

**Recording stop (660Hz → 440Hz, 150ms):** Descending two-tone
- Two quick notes descending — signals "done speaking"

**Transcription complete (880Hz → 1100Hz, 180ms):** Ascending two-tone chime
- Higher-pitched confirmation — signals "ready to paste"

### 5.2 Sound trigger points
- Recording start: existing `playTone` call in recording state handler
- Recording stop: add `playTone` when entering `transcribing` state
- Transcription complete: add `playTone` when entering `complete` state
- All gated on `settings.playSounds`

---

## Phase 6: Focus Stealing Fix

### 6.1 Overlay window creation (`src/main/ipc.ts`, line 117)
- Change `show: true` → `show: false` in BrowserWindow options
- Call `overlayWin.showInactive()` after creation
- Also apply to the `.show()` call on existing overlay (line 149): use `showInactive()` instead

### 6.2 Onboarding window
- Same treatment if needed — but onboarding is user-initiated, less critical

---

## Phase 7: Cancel Recording Support

### 7.1 Pipeline machine (`src/renderer/src/state/pipelineMachine.ts`)
- Add `CANCEL` event on `recording` state → transitions to `idle`
- Separate from `HOTKEY_PRESSED` (which toggles) — cancel always goes to idle

### 7.2 Overlay cancel button
- X button in overlay sends cancel action through IPC
- Background window receives it, sends `CANCEL` event to state machine
- Cancel stops audio capture and resets cleanly

### 7.3 New IPC channels (`src/shared/ipc.ts`)
- `OVERLAY_CANCEL: 'overlay:cancel'` — overlay → main → background relay

---

## File Change Summary

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Remove RecordingMode, keyboardShortcut→keyboardShortcuts[], add CANCEL event |
| `src/shared/constants.ts` | Remove recordingMode, update defaults, add gradient colors |
| `src/shared/ipc.ts` | Add OVERLAY_CANCEL channel |
| `src/main/hotkeys.ts` | Multi-shortcut array support |
| `src/main/index.ts` | Multi-shortcut setup |
| `src/main/ipc.ts` | showInactive(), multi-shortcut IPC, cancel relay |
| `src/main/store.ts` | Migration: keyboardShortcut→keyboardShortcuts, remove recordingMode |
| `src/renderer/src/App.tsx` | Overlay redesign, sound design, cancel support, rAF audio bars |
| `src/renderer/src/components/Overlay.tsx` | Match overlay redesign |
| `src/renderer/src/components/ShortcutRecorder.tsx` | Multi-shortcut list UI |
| `src/renderer/src/views/home/GeneralPage.tsx` | Remove recording mode, multi-shortcut wiring |
| `src/renderer/src/state/pipelineMachine.ts` | Add CANCEL event |
| `src/renderer/src/audio/capture.ts` | Level smoothing |

---

## Implementation Order

1. **Phase 1** (types/constants/hotkeys) — foundation, must go first
2. **Phase 6** (focus fix) — one-line fix, quick win
3. **Phase 3 + 4** (overlay redesign + audio decoupling) — largest change, do together
4. **Phase 7** (cancel recording) — depends on overlay redesign
5. **Phase 5** (sounds) — depends on new overlay states
6. **Phase 2** (shortcut UI) — independent, can be done anytime after Phase 1
