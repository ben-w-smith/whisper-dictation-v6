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
 * Audio-reactive pill wrapper.
 *
 * Layering:
 *   .beam-pill-frame
 *   ├── .beam-pill-beam-wrap    (aria-hidden; filter: grayscale applied here)
 *   │     └── <BorderBeam>       (vendored; owns ::before/::after/bloom)
 *   │           └── .beam-pill-shell  (pill surface, carries radius)
 *   └── .beam-pill-content       (absolutely positioned UI, z:1, un-filtered)
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
      <div className="beam-pill-beam-wrap" aria-hidden="true">
        <BorderBeam
          ref={wrapperRef}
          size="line"
          colorVariant={mode.colorVariant}
          theme="dark"
          staticColors
          active={beamActive}
          strength={mode.strength}
          style={{ width: '100%', height: '100%' }}
        >
          <div className="beam-pill-shell" />
        </BorderBeam>
      </div>
      <div className="beam-pill-content" role="status" aria-live="polite">
        {children}
      </div>
    </div>
  )
}
