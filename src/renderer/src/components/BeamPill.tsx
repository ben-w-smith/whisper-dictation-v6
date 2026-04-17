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

const SILENCE_FLOOR = 0.05
const SPEECH_CEIL = 0.45
const SMOOTHING = 0.22

/**
 * Audio-reactive pill wrapper.
 *
 * Recording state: vendored BorderBeam (size='line', colorVariant='colorful')
 * renders an aurora beam along the pill's bottom edge. An rAF loop writes a
 * smoothed `--beam-strength` to the wrapper, which the library multiplies into
 * every beam/glow/bloom layer — so loudness = brightness/spread, silence = invisible.
 *
 * Non-recording states: beam fades out (`active={false}`) and a static
 * state-semantic strip renders at the bottom of the pill (blue pulse while
 * transcribing, green flash on complete, amber pulse on error).
 *
 * prefers-reduced-motion: falls back to the static-strip for every state,
 * including recording. No rAF loop; no audio reactivity.
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
      levelRef.current = 0
      return
    }
    const tick = (): void => {
      levelRef.current += SMOOTHING * (getAudioLevel() - levelRef.current)
      const raw = levelRef.current
      const s = Math.max(0, Math.min(1, (raw - SILENCE_FLOOR) / (SPEECH_CEIL - SILENCE_FLOOR)))
      el?.style.setProperty('--beam-strength', s.toFixed(3))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [beamActive, getAudioLevel])

  const showStaticStrip = !isRecording || reducedMotion

  return (
    <BorderBeam
      ref={wrapperRef}
      size="line"
      colorVariant="colorful"
      theme="dark"
      active={beamActive}
      strength={0}
      style={{ width: '100%', height: '100%' }}
    >
      <div className="beam-pill" data-beam-state={state} role="status" aria-live="polite">
        {children}
        {showStaticStrip && <span className="beam-pill-static-strip" aria-hidden="true" />}
      </div>
    </BorderBeam>
  )
}
