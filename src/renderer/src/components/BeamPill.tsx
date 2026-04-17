import React, { useEffect, useRef, useState } from 'react'
import { BorderBeam } from '../vendor/border-beam'
import type { BorderBeamColorVariant } from '../vendor/border-beam/types'
import './beam.css'

type PillState = 'recording' | 'transcribing' | 'complete' | 'error'

interface BeamPillProps {
  state: PillState
  getAudioLevel: () => number
  children: React.ReactNode
}

/**
 * Live-updates when the user toggles Reduce Motion in System Settings
 * while the overlay is open — not just at window create time.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

/**
 * Amplitude mapping tuned against real post-AGC RMS values from our audio
 * capture pipeline. `getAudioLevel()` returns the smoothed RMS of recent
 * Float32 PCM samples on a mic stream with `autoGainControl: true`, so
 * signal-level comes back heavily normalized: typical speech peaks at
 * ~0.08–0.15, quiet speech at ~0.02, AGC-floor silence at ~0.001.
 */
const SILENCE_FLOOR = 0.003
const SPEECH_CEIL = 0.12
const BASELINE_STRENGTH = 0.35
const SMOOTHING = 0.22

/**
 * Per-state static beam configuration. Recording drives strength via rAF
 * (see effect below); the other three states are fixed so the library
 * can own `--beam-strength` directly through its `strength` prop.
 *
 * `saturate` is our own axis (not a library prop) — see beam.css. Values
 * outside recording are 1 so the beam shows in full color for those
 * signal states; saturation reactivity is a recording-only signal.
 */
interface BeamModeConfig {
  colorVariant: BorderBeamColorVariant
  strength: number
  saturate: number
}
const BEAM_MODES: Record<PillState, BeamModeConfig> = {
  recording:    { colorVariant: 'colorful', strength: 0,    saturate: 0 }, // rAF overrides both
  transcribing: { colorVariant: 'ocean',    strength: 0.55, saturate: 1 },
  complete:     { colorVariant: 'colorful', strength: 0.9,  saturate: 1 }, // bright flash, ~500ms
  error:        { colorVariant: 'sunset',   strength: 0.55, saturate: 1 },
}

/**
 * Pill dimensions. These are the fixed render size of the overlay window
 * (see ipc.ts: 260×44). They're used to pin the border radius of the
 * BorderBeam wrapper to the same pill-shape the shell uses.
 */
const PILL_BORDER_RADIUS = 22

/**
 * Audio-reactive pill wrapper.
 *
 * Layering (all three layers are SIBLINGS inside the frame — this matters;
 * see the postmortem at the bottom of this comment):
 *
 *   .beam-pill-frame
 *   ├── .beam-pill-shell        (z 0) visible translucent pill surface
 *   ├── .beam-pill-beam-wrap    (z 1) beam layer — masked + filterable
 *   │     └── <BorderBeam>       (vendored; owns ::before/::after/bloom)
 *   └── .beam-pill-content      (z 2) absolutely positioned UI
 *
 * Per-state behavior:
 *
 *   recording    — colorVariant='colorful', rAF drives amplitude. Strength
 *                  and saturation both written by the rAF tick; BorderBeam
 *                  strength prop is 0 (clobbered) and `--beam-saturate` is
 *                  a sibling axis our CSS maps to `filter: grayscale()` on
 *                  the beam pseudo-elements. Silence = gray + faint,
 *                  speech = colorful + bright.
 *   transcribing — colorVariant='ocean', strength 0.55, full saturation.
 *                  Library animates the travel/breathe/spike keyframes on
 *                  its own; no audio reactivity.
 *   complete     — colorVariant='colorful', strength 0.9, full saturation.
 *                  A bright full-spectrum flash while the checkmark shows;
 *                  App auto-dismisses the overlay after 500ms.
 *   error        — colorVariant='sunset', strength 0.55, full saturation.
 *                  Warm amber continues while the error icon is displayed.
 *
 * prefers-reduced-motion: beam inactive entirely (no travel animation).
 * The interior UI still renders its state-specific content.
 *
 * Why are the shell and beam SIBLINGS (not parent/child)? An earlier
 * revision nested the shell inside `.beam-pill-beam-wrap`. S7 then added
 * a horizontal edge-fade `mask-image` to that wrap (so the traveling beam
 * wouldn't punch through behind the buttons). But `mask-image` composites
 * the entire subtree, and with `backdrop-filter` + translucent rgba on
 * the shell, the mask-compose + backdrop-filter interaction rasterized
 * the shell to effectively transparent — the pill looked completely
 * see-through. Separating the shell out and applying the mask only to
 * the beam layer fixes that: the shell is fully opaque in its own right,
 * and only the beam's edges fade.
 */
export function BeamPill({ state, getAudioLevel, children }: BeamPillProps): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const levelRef = useRef(0)
  const reducedMotion = useReducedMotion()

  const mode = BEAM_MODES[state]
  const beamActive = !reducedMotion

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || !beamActive) {
      el?.style.removeProperty('--beam-strength')
      el?.style.removeProperty('--beam-saturate')
      levelRef.current = 0
      return
    }
    if (state === 'recording') {
      // rAF loop — amplitude drives both strength (visibility) and saturate
      // (color vs. gray). Overrides the library's inline --beam-strength,
      // which is why `strength={0}` is passed on the BorderBeam prop.
      let raf = 0
      const tick = (): void => {
        levelRef.current += SMOOTHING * (getAudioLevel() - levelRef.current)
        const raw = levelRef.current
        const norm = Math.max(0, Math.min(1, (raw - SILENCE_FLOOR) / (SPEECH_CEIL - SILENCE_FLOOR)))
        const curved = Math.sqrt(norm)
        const strength = BASELINE_STRENGTH + (1 - BASELINE_STRENGTH) * curved
        el.style.setProperty('--beam-strength', strength.toFixed(3))
        el.style.setProperty('--beam-saturate', curved.toFixed(3))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => {
        cancelAnimationFrame(raf)
        el.style.removeProperty('--beam-strength')
        el.style.removeProperty('--beam-saturate')
      }
    }
    // Non-recording states: library owns strength via prop; we just set
    // the saturation axis so the CSS grayscale filter resolves to color.
    el.style.setProperty('--beam-saturate', mode.saturate.toFixed(3))
    return () => {
      el.style.removeProperty('--beam-saturate')
    }
  }, [state, beamActive, getAudioLevel, mode.saturate])

  return (
    <div className="beam-pill-frame" data-beam-state={state}>
      {/* Layer 0: visible pill surface. Independent of the beam so it
          stays fully opaque regardless of the beam layer's mask/filter. */}
      <div className="beam-pill-shell" aria-hidden="true" />

      {/* Layer 1: beam. Masked to fade near the left/right button slots
          so the traveling highlight doesn't punch through behind them.
          `overflow: hidden` on the wrap clips the library's internal
          radial gradients to the pill shape. */}
      <div className="beam-pill-beam-wrap" aria-hidden="true">
        <BorderBeam
          ref={wrapperRef}
          size="line"
          borderRadius={PILL_BORDER_RADIUS}
          colorVariant={mode.colorVariant}
          theme="dark"
          staticColors
          active={beamActive}
          strength={mode.strength}
          style={{ width: '100%', height: '100%' }}
        >
          {/* The library's type declares `children` as required. We don't
              have anything to wrap (the shell is a sibling layer), so this
              is just an empty placeholder. */}
          <></>
        </BorderBeam>
      </div>

      {/* Layer 2: interactive UI. isolation: isolate in CSS keeps this
          subtree from ever being affected by beam-layer filters. */}
      <div className="beam-pill-content" role="status" aria-live="polite">
        {children}
      </div>
    </div>
  )
}
