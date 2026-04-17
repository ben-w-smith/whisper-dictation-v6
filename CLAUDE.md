# Whisper Dictation v6 — Working Agreement

## Build

To build and open the app for manual testing (required for shortcuts, accessibility, auto-paste):

```bash
npm_config_python=/opt/homebrew/bin/python3.11 pnpm run app
```

- `pnpm dev` does NOT work for testing global shortcuts, accessibility permissions, or real audio capture.
- `npm_config_python` is needed because `node-gyp@9.4.1` requires Python's `distutils` (removed in Python 3.12+).
- The built app opens from `dist/mac-arm64/Whisper Dictation.app`.

---

## Guidance for AI coding assistants (read every session)

This codebase has three non-local subsystems where symptom-level fixes create new
bugs. Before editing these files, you MUST follow the pre-flight and anti-pattern
rules below. Adherence matters more than speed — every "nine bugs in an afternoon"
incident in this project's history traces back to skipping these.

### Pre-flight reads (mandatory)

| If you're editing… | First read | Run before and after |
|---|---|---|
| `src/main/hotkeys.ts`, `src/renderer/src/components/ShortcutRecorder.tsx`, or any hotkey-adjacent IPC handler | `docs/shortcut-architecture.md` in full | `pnpm test:fragile` |
| `src/renderer/src/audio/capture.ts` | The comment block at L128–150 (AudioContext sample-rate workaround) | Manual test via `pnpm run app` and record once. `pnpm dev` will not catch audio regressions. |
| `src/main/ipc.ts` window-routing code | "Window Architecture" section in `docs/shortcut-architecture.md` | `pnpm test:fragile` |
| `src/main/llama.ts` | Comments around the consecutive-failure policy | `pnpm vitest run src/main/` |
| Any page in `src/renderer/src/views/home/` | `docs/superpowers/specs/2026-04-14-settings-ui-redesign-design.md` | `pnpm storybook` |
| `BeamPill.tsx`, `beam.css`, `Overlay.tsx`, `OverlayInterior.tsx`, `vendor/border-beam/**`, or `tokens.css` root-height rules | `docs/retros/2026-04-17-overlay-pill-redesign.md` + `.cursor/rules/overlay-pill.mdc` | `pnpm storybook` then `pnpm app` (Storybook doesn't reproduce the transparent BrowserWindow) |

If you edit a fragile file without doing the pre-flight, stop and redo the change.

### Non-local systems (edit these with extra care)

1. **Hotkey subsystem.** Spans `main/hotkeys.ts`, `main/ipc.ts` (SET_SETTING +
   CAPTURE_MOUSE_BUTTON), `preload/index.ts`,
   `renderer/components/ShortcutRecorder.tsx`,
   `renderer/views/home/GeneralPage.tsx`, `renderer/components/Onboarding.tsx`. It
   has **two registration systems** (Electron `globalShortcut` for keys,
   `iohook-macos` for mouse) that share one callback and must stay consistent. The
   rules at the bottom of `docs/shortcut-architecture.md` are load-bearing — do not
   "simplify" them.

2. **Window IPC routing.** As of 2026-04-16, routing is role-based via the
   registry in `src/main/windows.ts`. Use `getWindow(role)`, `sendTo(role, ...)`,
   or `broadcast(...)`. Roles: `background` | `home` | `overlay` | `onboarding` |
   `about`. Do **not** add new `w.getTitle() === '...'` lookups — CI
   (`scripts/.title-routing-baseline`) enforces a non-growing count. If you add a
   new window, register it at creation time; if you remove one, call
   `unregisterWindow(role)` in its `closed` handler.

3. **Overlay pill rendering.** The pill has three load-bearing invariants
   that were rediscovered the hard way (see
   `docs/retros/2026-04-17-overlay-pill-redesign.md`):
   - `html, body, #root` must keep `height: 100%` in `tokens.css`. Without
     it every `h-full` wrapper collapses to 0 and the pill rasterizes
     at 0×0 while looking "see-through."
   - `BeamPill` pins its own 260×44 via inline style. Do not rewrite to
     `w-full h-full` — this is defense in depth for (1).
   - The visible surface (background, backdrop-filter, border, shadow)
     lives on `.beam-pill-frame` itself, not on a nested shell inside
     the masked beam wrapper. Nesting it there makes
     `backdrop-filter` composite through the mask and the pill goes
     transparent.

4. **Hidden background window audio.** The main BrowserWindow is hidden and hosts
   the XState machine + Web Audio capture. The following are NOT cleanup
   opportunities — removing any of them silently breaks recording:
   - `app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')`
     in `main/index.ts`
   - `mainWindow.webContents.setBackgroundThrottling(false)` in `main/index.ts`
   - The manual 48 kHz → 16 kHz resample in `audio/capture.ts` (Chromium's
     internal resampler conflicts with `ScriptProcessorNode`)
   - The zero-gain node in the audio graph (ScriptProcessorNode is silently
     disconnected without it)
   - The `process.stdout.on('error')` / `process.stderr.on('error')` EPIPE guards
     in `main/index.ts`

### Forbidden patterns

1. **Do not use hardcoded hex colors** in `src/renderer/src/views/**` or
   `src/renderer/src/components/**`. Use tokens from
   `src/renderer/src/styles/tokens.css`. If the token you need doesn't exist, add
   it and use it. Existing hardcoded hexes are tech debt — prefer fixing them when
   nearby, never adding new ones. CI enforces this via
   `scripts/check-hex-colors.sh`.
2. **Do not grow `AIPage.tsx`, `HistoryPage.tsx`, `GeneralPage.tsx`, or `App.tsx`**
   past their current size. If your change adds more than ~20 net lines, extract a
   component into `src/renderer/src/components/` first.
3. **Do not inline a second copy of a Card, ToggleRow, RadioCard, AlertBanner, or
   TabBar pattern.** If you catch yourself writing one of these inline when a
   similar one already exists, extract both into a shared component.
4. **Do not add module-level mutable state** to `main/hotkeys.ts`, `main/llama.ts`,
   or `audio/capture.ts`. These modules already have too much. New state either
   goes through an existing accessor or you refactor to a proper state machine
   (see `renderer/src/state/pipelineMachine.ts` for the pattern).
5. **Do not `console.log` inside an `iohook-macos` event listener.** It crashes
   the app via EPIPE when the launching terminal closes its pipe. Safety guards
   exist in `main/index.ts`; do not remove them either.
6. **Do not introduce Electron `globalShortcut` for new event types.** It cannot
   do key-up, per-button mouse, or push-to-talk. All new event-surface work goes
   through `iohook-macos`.
7. **Do not send overlay state from a third code path.** `App.tsx` already has
   two: a 16 ms fast-path during recording (`overlayAudioIntervalRef`) and an
   effect-driven path for state transitions. A third path produces lag and
   out-of-order renders.
8. **Do not look up windows by title.** Use `getWindow(role)` / `sendTo(role, ...)` /
   `broadcast(...)` from `src/main/windows.ts`. CI's title-routing guard
   (`scripts/.title-routing-baseline`) fails on any new `.getTitle() === '...'`
   site in `src/main/`. The one surviving call site in `e2e/helpers.ts` is
   deliberate test-only fallback code.
9. **Do not rewrite `BeamPill` to use `w-full h-full` for its frame size.**
   Pin `PILL_WIDTH × PILL_HEIGHT` via inline style. This is defense in
   depth against any global CSS regression that would collapse the pill
   to 0 and re-trigger the "see-through overlay" bug.
10. **Do not remove `height: 100%` from `html, body, #root` in
    `tokens.css`.** The overlay's `h-full` wrappers depend on it. See
    `docs/retros/2026-04-17-overlay-pill-redesign.md`.
11. **Do not modify files in `src/renderer/src/vendor/border-beam/`
    directly.** It's a pristine copy of the upstream library — wrap
    changes from `BeamPill.tsx` instead. Upgrade policy in
    `vendor/border-beam/VENDORED.md`.

### Required workflow for fragile-file changes

Fragile files: `hotkeys.ts`, `ipc.ts`, `audio/capture.ts`, `llama.ts`, `App.tsx`,
`ShortcutRecorder.tsx`.

Before editing any fragile file:

1. State in chat: the goal, the files you expect to touch, the invariants that
   must still hold, and which tests cover them.
2. Run the relevant tests (`pnpm test:fragile` or more specific). Paste the
   result.
3. Make the change.
4. Re-run the tests. Paste the result.
5. For hotkey-subsystem changes, also do a manual verification in
   `pnpm run app`. Note in chat what you tested.

### The local-fix red flag

When your instinct says "just add an `if` here" or "special-case this," pause and
ask whether the real fix is upstream. This codebase has been bitten by local fixes
repeatedly — see the numbered bug history at the bottom of
`docs/shortcut-architecture.md`. Specific heuristics:

- A `typeof x === 'number'` / `!== null` check that feels like a workaround → the
  types are probably wrong one layer up.
- A boolean state flag added to a module → the module probably needs to be a
  state machine, not grow another flag.
- An inline copy of existing logic with one tweak → extract a parameterized
  version.
- A silent `catch { /* ignore */ }` → consider whether the caller should know.

If you decide the local fix is correct anyway, write down what the upstream fix
would look like so the next session can see it.

### Verification before claiming done

Do not say "done" or "fixed" without running the relevant tests:

- `pnpm lint` (runs `tsc --noEmit`)
- `pnpm test` (Vitest unit tests)
- `pnpm test:fragile` (targeted tests for the fragile subsystems)
- `pnpm test:e2e` for UI/IPC changes
- `bash scripts/check-hex-colors.sh` if you touched any renderer page/component

If manual verification is required (shortcuts, audio, accessibility), say so
explicitly and describe what you tested.
