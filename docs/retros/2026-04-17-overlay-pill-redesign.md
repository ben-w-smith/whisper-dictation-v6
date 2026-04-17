# Retro: overlay pill redesign (2026-04-16 → 2026-04-17)

This is a full postmortem of the overlay pill redesign that went from
"replace conic rotation with an audio-reactive bottom aurora" to "why is
my overlay completely transparent after three fixes" over two days. It
exists so the next agent working in this area can skip the mistakes.

Paired rule: `.cursor/rules/overlay-pill.mdc`.

## TL;DR

The overlay pill had one root-cause bug — `html / body / #root` had no
explicit height — and three stacked symptoms that kept pulling fixes in
the wrong direction:

1. `h-full` wrappers collapsed to 0, so percentage-heighted descendants
   (`.beam-pill-frame`) had no paint box.
2. A horizontal `mask-image` on the beam layer composited through the
   nested pill shell's `backdrop-filter` and rasterized the background
   transparent.
3. The vendored `border-beam` library injects `--beam-strength` as an
   inline style, so imperative updates from our rAF loop fought React
   reconciliation on every render.

Each symptom was individually plausible as the root cause, so each fix
got scoped too tightly. The fix that stuck pinned pill geometry in JS
and gave the root elements a height — defense in depth.

## Timeline

### Stage 1: redesign brief
User asked for a "super strong border beam at the bottom of the pill,
animating with audio input." Reference site:
https://beam.jakubantalik.com/. We vendored `border-beam@1.0.1` by
Jakub Antalik into `src/renderer/src/vendor/border-beam/` (MIT, full
attribution in `VENDORED.md`).

### Stage 2: audio recalibration (S1)
First attempt used RMS thresholds copied from the demo site. Speech
barely registered. We traced real post-AGC RMS from our capture
pipeline and found:
- Speech peaks: 0.08–0.15 (not 0.3+ as the demo assumes)
- Quiet speech: ~0.02
- Silence (AGC floor): ~0.001

New constants in `BeamPill.tsx`:
```
SILENCE_FLOOR = 0.003
SPEECH_CEIL   = 0.12
BASELINE     = 0.35
```
Plus `Math.sqrt()` curve so quiet speech isn't dead at the bottom.

### Stage 3: layer split for grayscale-at-silence (S2)
User wanted the beam visible and grayscale when silent, colorful when
speaking. The vendored library's own hue-shift fought our desaturation
filter, so we added `staticColors` to disable it and drove
`filter: grayscale(calc(1 - var(--beam-saturate, 0)))` from the outside.

To keep the grayscale filter off the UI (buttons, spinner), we split the
beam into its own wrapper (`.beam-pill-beam-wrap`) with the pill shell
(`.beam-pill-shell`) nested inside it for "structural grouping." This
was the seed of the later transparency bug.

### Stage 4: per-state polish (S5, S6, S7)
- Transcribing → ocean-variant beam + mono sunburst spinner.
- Complete → 500 ms colorful burst + green checkmark with overshoot scale.
- Error → amber sunset-variant beam, icon + message.
- S7: added horizontal edge-fade mask (`mask-image: linear-gradient(...)`)
  to `.beam-pill-beam-wrap` so the traveling highlight doesn't punch
  through the button slots.

At this point the beam looked correct in Storybook. Shipped.

### Stage 5: the pill goes transparent
User reported the overlay was "completely see-through except for the
buttons." Symptom analysis (wrong direction):
- Mask + `backdrop-filter` interaction was the obvious suspect. The
  horizontal mask on the wrap *did* composite through the shell's
  `backdrop-filter` and rasterize it transparent.
- Fix attempt 1 (`0ba35e8`): promote `.beam-pill-shell` from child of the
  wrap to sibling, assign explicit `z-index` values (shell:0, wrap:1,
  content:2). Shipped.

User reported the issue persisted. We verified the build output
contained the new CSS classes. `app.asar` had the right timestamps. The
running process pointed at the built app. Nothing in the compile chain
was stale — the fix was being deployed and was still not working.

### Stage 6: the real bug
Found by reading the global stylesheet top to bottom:

```css
html, body, #root {
  background: transparent;
}
```

That's it. No `height`. Every overlay wrapper using Tailwind's `h-full`
(which is `height: 100%`) resolved against a 0-height parent and
collapsed to 0.

Consequences:
- `.beam-pill-frame` was 0×0 → its absolutely-positioned children were
  all inset:0 against 0×0 → nothing to paint.
- `flex items-center` around a 0-height box placed its 44px-tall pill
  child vertically centered around y=0, putting half the pill *above*
  the window's visible area.
- The buttons showed because they have intrinsic 22×22 sizing and got
  dragged back into the visible rect by flex's cross-axis auto behavior
  on a flex child with `align-self: auto`. So you saw the buttons in
  roughly the right vertical band, but the pill surface had nowhere to
  draw.

### The fix that stuck
Commit `7fa95c1`:

1. `html, body, #root { height: 100%; margin: 0 }` so `h-full`
   propagates through the overlay tree.
2. `BeamPill` pins width/height via inline `style={{ width: 260, height:
   44 }}` so even if something else collapses a parent later, the pill
   stays the right size.
3. Collapsed the 3-layer nesting into 2 siblings:
   `.beam-pill-frame` (carries visible surface) →
   `.beam-pill-beam` + `.beam-pill-content`. The background is never
   inside the masked beam subtree again.

## Why every earlier fix attempt failed

| Attempt | What we changed | Why it didn't work |
|---|---|---|
| v1 | Single-div pill with BorderBeam as child | Grayscale filter for silent state desaturated the interior UI too. |
| v2 | Beam split into its own wrap; shell nested inside | Mask on wrap composited through shell's backdrop-filter → transparent. |
| v3 (`0ba35e8`) | Shell promoted to sibling, z-indexed | Parent `.beam-pill-frame` was 0×0 because of the root-height bug, so sibling-or-child didn't matter — the whole paint box was empty. |
| v4 (`7fa95c1`) | Pin pill size + give root 100% height | Works. Paint box is never 0. |

## Red herrings (things we chased that were not the bug)

- **"Rebuild is stale."** It wasn't. We grepped the `.asar`, `.js`, and
  `.css` bundles; all three contained the fix. The user was running the
  latest code.
- **"`backdrop-filter` + `mask-image` is the bug."** Real, but fixing
  only that still left the pill 0×0.
- **"z-index ordering."** Correct to promote siblings, but sibling vs
  child didn't matter in a 0-size frame.
- **"The state machine is broken — dictation doesn't complete."** Not
  a real bug. The overlay was invisible through the entire recording →
  transcribing → complete → idle cycle, so the user perceived it as
  "nothing happened." Clipboard writes and history saves worked the
  whole time; they just had no visual confirmation.

## Lessons for the next agent

1. **When a visual bug survives three architecturally-reasonable fixes,
   check the root.** `html`, `body`, and `#root` are load-bearing for
   any UI that uses percentage heights. Don't assume they're right.
2. **Pin critical geometry in JS, not CSS, for floating UI.** The
   overlay has one job: render a 260×44 pill. Pinning it via inline
   style is defense in depth against any global CSS mistake.
3. **Do not nest translucent `backdrop-filter` layers inside masked
   parents.** The compositor rasterizes masked subtrees before
   applying the filter, and any child that relies on the backdrop is
   silently transparent.
4. **Verify the deploy, not just the build.** We spent time wondering
   if the build was stale before confirming it wasn't. A `grep -c
   'newClassName' out/renderer/assets/*.css && grep -c '...'
   dist/mac-arm64/.../app.asar` loop would have been faster than
   reasoning about it.
5. **Symptoms cluster.** "Invisible pill" and "dictation doesn't work"
   were the same bug. When two reports land together, try to find a
   single cause before chasing both independently.
6. **The vendored library's contract matters.** `strength` as inline
   style vs imperative rAF updates is a real conflict. Pass `strength=
   {0}` + imperatively update for audio-reactive; pass static value
   for non-reactive. Mixing them causes flicker.

## What we should have done first

Opened DevTools on the overlay window, selected the `.beam-pill-frame`
node, and read its computed height. It would have said `0` and we'd
have been done in five minutes.

Electron's renderer DevTools attach via `Cmd+Option+I` when the window
has focus. The overlay window is `focusable: false`, so use the Main
Menu → View → Toggle Developer Tools, or right-click → Inspect while
holding the overlay open via a long recording.
