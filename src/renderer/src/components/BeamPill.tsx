import React, { useEffect, useRef, useState } from 'react'
import { BorderBeam } from '../vendor/border-beam'
import './beam.css'

interface BeamPillProps {
  state: 'recording' | 'transcribing' | 'complete' | 'error'
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
 * ~0.08–0.15, quiet speech at ~0.02, and AGC-floor silence at ~0.001.
 *
 * Previous calibration (floor 0.05, ceil 0.45) meant strength spent its life
 * in the 0.0–0.2 range and the beam was effectively invisible even for loud
 * speech. The new ceiling of 0.12 places normal conversation at or near peak
 * strength, matching the brightness of beam.jakubantalik.com's demo.
 *
 * The sqrt curve boosts quiet signals so whispered speech still visibly
 * modulates the beam instead of sitting under the floor.
 *
 * BASELINE_STRENGTH is the minimum strength we ever emit during active
 * recording, so the aurora is always at least softly visible — the
 * "grayscale, kind of there, softly moving" look we want during silence.
 */
const SILENCE_FLOOR = 0.003
const SPEECH_CEIL = 0.12
const BASELINE_STRENGTH = 0.35
const SMOOTHING = 0.22

/**
 * Audio-reactive pill wrapper.
 *
 * Layering:
 *   .beam-pill-frame
 *   ├── .beam-pill-beam-wrap    (aria-hidden; may be filtered grayscale)
 *   │     └── <BorderBeam>       (vendored; owns ::before/::after/bloom layers)
 *   │           └── .beam-pill-shell  (transparent-ish pill surface, carries radius)
 *   └── .beam-pill-content       (absolutely positioned, z-index 1; the real UI)
 *
 * The beam and the pill content live in separate DOM subtrees so a
 * `filter: grayscale(...)` on the beam side does NOT desaturate the X button,
 * stop button, or the backdrop-filtered desktop behind the pill.
 *
 * `staticColors={true}` tells the vendored library to emit no hue-shift
 * animation — which would otherwise override any `filter` we set here.
 *
 * Recording state: rAF writes smoothed `--beam-strength` (amplitude) and
 * `--beam-saturate` (speech-vs-silence) onto the BorderBeam wrapper. The
 * library multiplies strength into stroke/inner/bloom opacity; our own CSS
 * rule in beam.css turns saturate into `filter: grayscale()` on the beam
 * pseudo-elements only.
 *
 * prefers-reduced-motion: beam is inactive, no rAF loop, no audio reactivity.
 * The content layer still renders its state-specific UI.
 */
export function BeamPill({ state, getAudioLevel, children }: BeamPillProps): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number>(0)
  const levelRef = useRef(0)
  const reducedMotion = useReducedMotion()

  const isRecording = state === 'recording'
  const beamActive = isRecording && !reducedMotion

  useEffect(() => {
    const el = wrapperRef.current
    if (!beamActive) {
      el?.style.removeProperty('--beam-strength')
      el?.style.removeProperty('--beam-saturate')
      levelRef.current = 0
      return
    }
    const tick = (): void => {
      levelRef.current += SMOOTHING * (getAudioLevel() - levelRef.current)
      const raw = levelRef.current
      const norm = Math.max(0, Math.min(1, (raw - SILENCE_FLOOR) / (SPEECH_CEIL - SILENCE_FLOOR)))
      const curved = Math.sqrt(norm) // gamma ~0.5 lifts quiet speech
      const strength = BASELINE_STRENGTH + (1 - BASELINE_STRENGTH) * curved
      el?.style.setProperty('--beam-strength', strength.toFixed(3))
      el?.style.setProperty('--beam-saturate', curved.toFixed(3))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [beamActive, getAudioLevel])

  return (
    <div className="beam-pill-frame" data-beam-state={state}>
      <div className="beam-pill-beam-wrap" aria-hidden="true">
        <BorderBeam
          ref={wrapperRef}
          size="line"
          colorVariant="colorful"
          theme="dark"
          staticColors
          active={beamActive}
          strength={0}
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
