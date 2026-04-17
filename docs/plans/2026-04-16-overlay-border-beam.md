# Overlay: Border Beam as Waveform

**Date:** 2026-04-16
**Status:** Approved — review items resolved 2026-04-16. Ready for execution.
**Scope:** Recording overlay (`Overlay.tsx`, 240×32 px frameless floating pill)
**Approach:** Replace the 16 internal waveform bars with an audio-reactive conic-gradient beam travelling around the pill's border. Interior becomes quiet — just a timer and controls. State transitions (recording → transcribing → complete → error) choreograph through beam color, speed, and glow.
**Design inspiration:** Jakub Antalik's [Border Beam](https://beam.jakubantalik.com/), Dona.ai state transitions.

## Pre-execution Review (resolved 2026-04-16)

- [x] **Window-size audit — completed.** The overlay is NOT a separate HTML file; it's `src/renderer/index.html` routed by hash. Hardcoded dimensions that need updating when bumping `240×32 → 260×44`:
  - `src/renderer/src/App.tsx` L160 — `h-[32px]` on the pill div (see §2.7 below)
  - `src/renderer/src/components/Overlay.tsx` L32 — `level * 240` is a waveform-height scale factor, NOT a width; delete with the bars
  - `src/renderer/src/styles/tokens.css` L77 — `--space-2xl: 32px` is an unrelated spacing token; no change
  - `index.html` — no hardcoded overlay sizes; safe
- [x] **CRITICAL FINDING: Overlay is rendered in TWO places.** `src/renderer/src/App.tsx` L160 and `src/renderer/src/components/Overlay.tsx` both render the pill with `WAVEFORM_*` constants. App.tsx is the live-production render path (via `#overlay` hash). Overlay.tsx is used only by Storybook. **Both must be migrated** — see §2.7.
- [x] **Incremental migration plan** (replacing "full rewrite") — see §2.5.
- [x] **Storybook backdrop strategy — decided.** Add a dark-neutral decorator (`#0f1014` full-bleed). Document in the story file that final visual verification happens in `pnpm run app`, not Storybook (the live overlay composites over arbitrary desktop content, which Storybook can't simulate). See §4.
- [x] **`WAVEFORM_*` references — enumerated.** Three files use them (beyond plan/docs):
  - `src/shared/constants.ts` — definitions (delete in Phase 7)
  - `src/renderer/src/components/Overlay.tsx` — import + usage
  - `src/renderer/src/App.tsx` — import + usage (L11, L90, L94, L175, L181)
  
  No test files import them. Safe to delete once both render paths are migrated.

## Problem

The current overlay is functional but visually anonymous: a flat dark pill with a rainbow-gradient bar waveform. It looks like any menu-bar utility. We want the dictation experience to feel *alive* — the recording pill should be a signature moment, not a boring indicator.

The existing bar waveform also wastes the pill's limited real estate (240×32 px total) on visualization, leaving no room for useful context like elapsed time.

## Design Direction

- **The border is the waveform.** A conic-gradient beam traces the pill's rounded edge. Its brightness and glow radius react to live audio RMS. Rotation speed is constant (rhythmic, predictable, never frantic).
- **Interior goes quiet.** Minimal controls + a tabular-nums timer in mono type. No decoration competing with the beam.
- **State is expressed through color, not layout.** Recording = warm red. Transcribing = soft blue with slower pulse. Complete = green flash + settle. Error = amber with gentle shake.
- **Respect reduced motion.** `prefers-reduced-motion` halts rotation; beam pulses in place with audio instead.

---

## 1. Visual Specification

### Pill shell (unchanged dimensions)
- Window: `240 × 32 px` (kept — may grow to `260 × 36 px` for comfortable timer space; see §6 sizing decision)
- Background: `rgba(17, 17, 19, 0.78)` with `backdrop-filter: blur(20px) saturate(140%)`
- Border radius: `9999px` (fully rounded pill)
- Base ring: `1px inset rgba(255,255,255,0.06)` for subtle edge definition under the beam

### Border beam (the star)
- Implemented as a pseudo-element ring clipped with `mask-composite: exclude`
- Ring thickness: `1.5px` (visually reads as a light line, not a border)
- Rotation: `linear` infinite, period varies per state (see table)
- Built from a `conic-gradient` with a short high-intensity wedge (~30°) and a long transparent tail
- Glow: `filter: drop-shadow(0 0 var(--beam-glow) var(--beam-color))`
- CSS variable driven so React can update audio-reactive values per frame without re-render

### State matrix

| State | Beam color | Rotation period | Base opacity | Audio-reactive | Glow base → peak |
|-------|-----------|-----------------|--------------|----------------|------------------|
| `recording` | `#f87171` core, `#fca5a5` halo | 2.8s | 0.55 | Yes — opacity + glow | 4px → 14px |
| `transcribing` | `#93c5fd` core, `#60a5fa` halo | 1.6s (faster, confident) | 0.85 | No — steady pulse | 6px (static) |
| `complete` | `#4ade80` core | Single 0.9s sweep, then fade | 0 → 1 → 0 | No | 0 → 18px → 0 |
| `error` | `#fbbf24` core, `#f59e0b` halo | 3.5s (slow, apologetic) | 0.7 | No | 6px + 3-frame shake |
| `idle` | — | — | 0 (window hidden) | — | — |

### Interior content (inside the pill)

From left to right, vertically centered:

1. **Cancel button** — 22×22 px, `bg-white/8 hover:bg-white/14`, rounded-full, X icon in `text-white/50`. Only visible on hover OR during `error` state.
2. **Left dot / status glyph** — 6×6 px:
   - Recording: solid `#f87171`, opacity pulses 0.4→1.0 at 1.4s linear
   - Transcribing: soft blue, no pulse
   - Complete: green check (SVG, stroke-dashoffset reveal)
   - Error: amber triangle
3. **Elapsed timer** — `font-mono tabular-nums text-[11px] text-white/70`, format `M:SS`. Visible only in `recording` and `transcribing` (shows transcription elapsed too).
4. **Stop button** — 22×22 px, `bg-red-500 hover:bg-red-600`, rounded-full, white square glyph. Recording only.

No waveform bars. No rainbow gradient. Removed.

### Removed elements

- `WAVEFORM_BAR_COUNT` bars (16 divs)
- `WAVEFORM_GRADIENT` inline colors on bars
- The rAF loop that animates bar heights (replaced by a much smaller rAF loop updating two CSS vars on the pill element)

---

## 2. Technical Implementation

### 2.1 New file: `BeamPill.tsx`

A presentational component that owns the beam styling. Takes `state` + `audioLevel` (0–1) + children (interior content).

```tsx
interface BeamPillProps {
  state: 'recording' | 'transcribing' | 'complete' | 'error'
  audioLevel: number // 0–1, smoothed RMS
  children: React.ReactNode
}
```

Responsibilities:
- Root `<div>` with `data-beam-state={state}` and inline CSS vars
- Pseudo-element ring styled via `beam.css`
- Receives audio level → writes `--beam-opacity` and `--beam-glow` (smoothed with small IIR to avoid jitter)
- No per-frame React re-renders — mutation via `ref.current.style.setProperty`

### 2.2 New file: `beam.css`

Colocated with `BeamPill.tsx`. Uses `@property` for GPU-animatable angle:

```css
@property --beam-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.beam-pill {
  position: relative;
  isolation: isolate;
  --beam-opacity: 0.55;
  --beam-glow: 6px;
  --beam-color: #f87171;
  --beam-halo: #fca5a5;
  --beam-period: 2.8s;
}

.beam-pill::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: conic-gradient(
    from var(--beam-angle),
    transparent 0deg,
    transparent 320deg,
    var(--beam-halo) 340deg,
    var(--beam-color) 355deg,
    #ffffff 360deg,
    var(--beam-color) 365deg,
    var(--beam-halo) 380deg,
    transparent 400deg
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  opacity: var(--beam-opacity);
  filter: drop-shadow(0 0 var(--beam-glow) var(--beam-color));
  animation: beam-rotate var(--beam-period) linear infinite;
  pointer-events: none;
  transition: opacity 120ms linear, filter 180ms linear;
}

@keyframes beam-rotate {
  to { --beam-angle: 360deg; }
}

/* State variants — set on the root .beam-pill */
.beam-pill[data-beam-state="transcribing"] {
  --beam-color: #93c5fd;
  --beam-halo: #60a5fa;
  --beam-period: 1.6s;
  --beam-opacity: 0.85;
  --beam-glow: 6px;
}
.beam-pill[data-beam-state="complete"] {
  --beam-color: #4ade80;
  --beam-halo: #86efac;
  --beam-period: 0.9s;
  /* opacity managed via one-shot animation */
  animation: beam-complete-flash 900ms ease-out forwards;
}
.beam-pill[data-beam-state="error"] {
  --beam-color: #fbbf24;
  --beam-halo: #f59e0b;
  --beam-period: 3.5s;
  --beam-opacity: 0.7;
  --beam-glow: 6px;
  animation: beam-error-shake 320ms ease-out;
}

@keyframes beam-complete-flash {
  0%   { --beam-opacity: 0; --beam-glow: 0px; }
  35%  { --beam-opacity: 1; --beam-glow: 18px; }
  100% { --beam-opacity: 0; --beam-glow: 0px; }
}

@keyframes beam-error-shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-2px); }
  75%      { transform: translateX(2px); }
}

/* Reduced motion — halt rotation, audio-reactive opacity still works */
@media (prefers-reduced-motion: reduce) {
  .beam-pill::before {
    animation: none;
  }
}
```

### 2.3 Audio-reactive loop (replaces bar rAF loop)

Inside `BeamPill.tsx`:

```tsx
const pillRef = useRef<HTMLDivElement | null>(null)
const rafRef = useRef<number>(0)
const levelRef = useRef(0)          // smoothed
const targetLevelRef = useRef(0)    // latest from props

// When audioLevel prop changes, update target
useEffect(() => { targetLevelRef.current = audioLevel }, [audioLevel])

useEffect(() => {
  if (state !== 'recording') return  // only react during recording
  const tick = () => {
    // IIR smoothing: level = level + 0.18 * (target - level)
    levelRef.current += 0.18 * (targetLevelRef.current - levelRef.current)
    const lvl = levelRef.current

    // Map level → opacity (0.35 floor so beam is always visible) and glow (4–14px)
    const opacity = 0.35 + Math.min(lvl, 1) * 0.65
    const glow = 4 + Math.min(lvl, 1) * 10

    const el = pillRef.current
    if (el) {
      el.style.setProperty('--beam-opacity', opacity.toFixed(3))
      el.style.setProperty('--beam-glow', `${glow.toFixed(1)}px`)
    }
    rafRef.current = requestAnimationFrame(tick)
  }
  rafRef.current = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafRef.current)
}, [state])
```

### 2.4 Audio level input

Currently the overlay receives `audioLevels: number[]` (16 values, one per bar). We need a single scalar.

**Option A (recommended):** Compute the mean of `audioLevels` in `Overlay.tsx` before handing to `BeamPill`. No backend change needed.

```tsx
const audioLevel = useMemo(
  () => audioLevels.reduce((a, b) => a + b, 0) / (audioLevels.length || 1),
  [audioLevels]
)
```

**Option B:** Add a new `audioRms: number` field to the machine context, populated by the audio worker. Cleaner long-term but out of scope — we can migrate later without changing `BeamPill`'s API.

Going with **A** for this plan.

### 2.5 Incremental migration (replaces "full rewrite")

Rather than rewriting `Overlay.tsx` in one pass — which risks dropping subtle edge cases (click-through zones, `idle` gating, dismissal timing on `complete` + `error`) — migrate in additive steps. Each step is independently testable and revertible.

**Step A — Extract `BeamPill` as additive component.**
New file `src/renderer/src/components/BeamPill.tsx` + `beam.css`. Not used anywhere yet. Unit-testable in Storybook alongside a `BeamPillShowcase` story that exercises all four states and audio-level inputs.

**Step B — Swap pill chrome in `App.tsx` (live path).**
Wrap the existing interior markup in `<BeamPill state={...} audioLevel={...}>`. Keep the bar waveform inside for now — you've only moved the chrome (background, border, beam). Recording still visually works. Commit.

**Step C — Migrate interior elements, one per commit.**
1. Timer (`<Timer ms={elapsedMs} />`) — new additive component, plugs in alongside bars.
2. Status dot (replaces the left edge of the bar group).
3. Cancel button hover-only reveal rules.
4. Stop button stays as-is visually — just re-positioned.
5. **After all four interior pieces are live**, delete the bar `{[...Array(WAVEFORM_BAR_COUNT)].map(...)}` block + the `barsRef` rAF loop.

**Step D — Mirror to `Overlay.tsx` (Storybook path).**
With the new structure proven in App.tsx, port the same `<BeamPill>` + interior into `Overlay.tsx`. Update `Overlay.stories.tsx`.

**Step E — Remove WAVEFORM_* constants.**
After both render paths are clean. See Phase 7.

Structural outline for the final state (both files converge on this):

```tsx
export function Overlay({ state, send, elapsedMs: externalElapsedMs }: OverlayProps) {
  const { audioLevels } = state.context
  const elapsedMs = externalElapsedMs ?? state.context.elapsedMs
  const audioLevel = useMemo(/* mean of audioLevels */, [audioLevels])

  if (state.matches('idle')) return null

  const beamState =
    state.matches('recording')    ? 'recording'    :
    state.matches('transcribing') ? 'transcribing' :
    state.matches('complete')     ? 'complete'     :
    state.matches('error')        ? 'error'        : 'recording'

  return (
    <div className="h-full flex items-center justify-center">
      <BeamPill state={beamState} audioLevel={audioLevel}>
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 h-full">
          {/* left: cancel (hover) or status dot */}
          {/* center: timer */}
          {/* right: stop / check / error glyph */}
        </div>
      </BeamPill>
    </div>
  )
}
```

Interior bits:

- **Recording:** `<CancelButton />` (hover-reveal) · `<StatusDot color="red" pulse />` · `<Timer ms={elapsedMs} />` · `<StopButton />`
- **Transcribing:** `<StatusDot color="blue" />` · `<Timer ms={elapsedMs} />` · spacer
- **Complete:** `<CheckGlyph animated />` centered
- **Error:** `<TriangleGlyph />` · `<ErrorText />` · click-to-dismiss on the pill (existing behavior)

All small SVG/text — under 40 LoC total for the interior block.

### 2.7 The App.tsx render path (critical — don't miss this)

`src/renderer/src/App.tsx` contains a second, live-production copy of the overlay pill (L160ish). This is the code path actually rendered in the overlay window (routed by `#overlay` hash). `src/renderer/src/components/Overlay.tsx` is used ONLY by Storybook.

Migration order per Step B and Step D above:
1. **App.tsx first** — the live path. Ship to real app via `pnpm run app` and verify during actual dictation.
2. **Overlay.tsx second** — mirror the structure so Storybook remains a faithful reference.

Do not attempt to unify these two files in this plan. A separate refactor to dedupe them can happen later.

### 2.6 Timer component

```tsx
function Timer({ ms }: { ms: number }) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const ss = (s % 60).toString().padStart(2, '0')
  return (
    <span className="font-mono tabular-nums text-[11px] text-white/70 select-none">
      {m}:{ss}
    </span>
  )
}
```

If no mono font is loaded yet, it'll fall back to system mono — that's fine for Phase 1. The editorial polish plan adds JetBrains Mono.

---

## 3. Window Sizing Decision

Current window is `240 × 32 px`. With the beam glow (up to 14px drop-shadow), we need glow room outside the visible pill. Options:

- **Keep window at 240×32, pill fills exactly** — glow will be clipped at window edges. Undesirable; kills the most visible effect.
- **Grow window to 260×44, pill stays ~240×32 centered** — gives ~10px glow breathing room on all sides. Transparent window → no visual cost. **Recommended.**
- Growing further (280×52) wastes screen real estate for diminishing glow benefit.

**Action:** update `src/main/ipc.ts:141–156` window creation — `width: 260, height: 44`, `x: Math.round((screenWidth - 260) / 2)`, `y: 20`.

---

## 4. Storybook Stories

### 4.1 Backdrop decorator

The live overlay composites over arbitrary desktop content via a real transparent window. Storybook can't simulate that. To keep the pill legible in Storybook, wrap `Overlay.stories.tsx` with a **full-bleed dark-neutral backdrop decorator**:

```tsx
const withOverlayBackdrop: Decorator = (Story) => (
  <div
    style={{
      minHeight: '100vh',
      background: '#0f1014',              // dark neutral, not pure black
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
    }}
  >
    <div style={{ width: 260, height: 44 }}>
      <Story />
    </div>
  </div>
)

export default {
  component: Overlay,
  decorators: [withOverlayBackdrop],
}
```

Inside the 260×44 container, the `<BeamPill>` renders at its real dimensions and the beam glow has ~10px breathing room on all sides.

**⚠️ Explicit caveat in the story file header:**

```tsx
/**
 * NOTE: Storybook uses a solid dark backdrop. The real overlay is a transparent
 * frameless macOS window composited over arbitrary desktop content. Final visual
 * verification MUST be done in `pnpm run app`, not Storybook. This file exists
 * for component structure, state-transition logic, and keyboard/click targets.
 */
```

### 4.2 Story coverage

Verify all six existing stories (`Recording`, `RecordingSilent`, `RecordingLoud`, `Transcribing`, `Complete`, `Error`) render correctly. Add one new story:

- `RecordingReducedMotion` — sets `prefers-reduced-motion` via CSS on the decorator, confirms beam is still visible but not rotating.

---

## 5. Accessibility

- Root pill gets `role="status" aria-live="polite"` so screen readers announce state changes.
- Timer wrapped in `aria-label="Recording elapsed: ${m} minutes ${ss} seconds"` refreshed once per second.
- Cancel/stop buttons keep their `aria-label`s.
- Beam is decorative — pseudo-element, not focusable, not announced.
- Reduced-motion fallback verified.

---

## 6. Performance Budget

- Current: 16 bars, per-frame height mutation (16 style writes × 60fps = 960 writes/s).
- New: 2 CSS var writes per frame on one element (120 writes/s). **~8× fewer style writes.**
- Beam rotation is pure GPU (conic-gradient + `@property` angle, no JS).
- Drop-shadow filter is the only cost — benchmarks show <0.4ms/frame on M1 for a 260×44 element. Acceptable.

---

## 7. Migration / Deletion

**Can be deleted once BOTH render paths (App.tsx and Overlay.tsx) are migrated:**
- `WAVEFORM_GRADIENT` constant (`src/shared/constants.ts:45`)
- `WAVEFORM_BAR_COUNT` constant (`src/shared/constants.ts:52`)

Imports to remove at the same time:
- `src/renderer/src/App.tsx:11` (import line)
- `src/renderer/src/App.tsx:90,94,175,181` (usage sites — removed as part of Step C bar deletion)
- `src/renderer/src/components/Overlay.tsx:4` (import line)
- `src/renderer/src/components/Overlay.tsx:27,30,80,86` (usage sites — removed in Step D)

No tests reference these constants. Safe to delete after both migrations land.

Leave the `audioLevels: number[]` field on the machine context — still used for the mean calculation and may be useful for the future dedicated `audioRms` migration (§2.4 Option B).

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/components/BeamPill.tsx` | **NEW.** Presentational wrapper, owns audio-reactive rAF loop. |
| `src/renderer/src/components/beam.css` | **NEW.** `@property --beam-angle`, keyframes, state variants. |
| `src/renderer/src/App.tsx` | **PRIMARY LIVE PATH.** Migrate the pill at L160 incrementally per §2.5 Steps B & C. Remove `WAVEFORM_*` imports and bar rAF loop. |
| `src/renderer/src/components/Overlay.tsx` | **STORYBOOK PATH.** Migrate to same structure per §2.5 Step D after App.tsx is proven. |
| `src/renderer/src/components/Overlay.stories.tsx` | Add dark-backdrop decorator per §4.1, add `RecordingReducedMotion` story, add header caveat. |
| `src/main/ipc.ts` | Window size `240×32 → 260×44`, `y: 24 → 20`. |
| `src/shared/constants.ts` | Remove `WAVEFORM_GRADIENT` and `WAVEFORM_BAR_COUNT` (Phase 7, after both render paths migrated). |

---

## 9. Verification

Manual QA in dev build:

- [ ] Recording: beam visible, rotates ~2.8s/loop, opacity/glow respond to speech (quiet → soft glow, loud → bright + large glow)
- [ ] Silence during recording: beam stays at 35% opacity floor, still rotating — system feels "alive but listening"
- [ ] Recording → Transcribing: beam color shifts red → blue, speed increases, no layout jank
- [ ] Transcribing → Complete: one bright green sweep then fades, pill dismisses
- [ ] Error: amber beam + 320ms shake on entrance, click dismisses
- [ ] Timer increments correctly in M:SS format, mono/tabular alignment holds
- [ ] Cancel button only visible on hover in recording state
- [ ] `prefers-reduced-motion: reduce` (System Settings → Accessibility → Display → Reduce motion): beam stops rotating, still changes color/opacity per state
- [ ] No visible clipping of beam glow at window edges
- [ ] Window doesn't steal focus (still uses `showInactive`)
- [ ] Tested against actual mic input at various volumes

Automated:
- [ ] Run existing Playwright e2e suite (no interaction changes, should still pass)
- [ ] `pnpm lint` clean
- [ ] Storybook builds and all Overlay stories render

---

## Out of Scope

- Onboarding overlay demo (covered in editorial-polish plan)
- Theming the overlay (beam color currently fixed to state; theme-driven accent colors land in themeable-foundation plan)
- Migrating `audioLevels` array → single `audioRms` scalar at the machine layer
- New overlay states (paused, slow-transcribing progress) — current state machine unchanged
- Sound effects on state transitions
