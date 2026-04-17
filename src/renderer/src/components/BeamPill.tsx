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

interface BeamModeConfig {
  colorVariant: BorderBeamColorVariant
  strength: number
  saturate: number
}
const BEAM_MODES: Record<PillState, BeamModeConfig> = {
  recording:    { colorVariant: 'colorful', strength: 0,    saturate: 0 }, // rAF overrides both
  transcribing: { colorVariant: 'ocean',    strength: 0.55, saturate: 1 },
  complete:     { colorVariant: 'colorful', strength: 0.9,  saturate: 1 },
  error:        { colorVariant: 'sunset',   strength: 0.55, saturate: 1 },
}

/**
 * Fixed pill geometry. The overlay window itself is 260×44 (see ipc.ts), but
 * we pin the pill explicitly so layout never collapses to 0 if html/body/#root
 * don't have height:100% set in the renderer's global CSS (which they don't).
 *
 * Pinning these also lets BorderBeam skip its auto-detection pass.
 */
const PILL_WIDTH = 260
const PILL_HEIGHT = 44
const PILL_BORDER_RADIUS = PILL_HEIGHT / 2

/**
 * Audio-reactive pill.
 *
 * Render tree:
 *
 *   .beam-pill-frame          (260×44 pinned; carries visible background, border, shadow)
 *   ├── .beam-pill-beam       (inset:0; masks horizontally; hosts <BorderBeam/>)
 *   │     └── [data-beam]     (vendored library wrapper + its ::before/::after/[data-beam-bloom])
 *   └── .beam-pill-content    (inset:0; z:2; interactive UI)
 *
 * Why this shape (postmortem):
 *   v1: single div carried background + BorderBeam as child. Worked, but
 *       grayscale filter for silent state desaturated the UI too.
 *   v2: split beam into its own wrap with the shell nested INSIDE. Horizontal
 *       edge-fade mask on the wrap then composited through the shell's
 *       backdrop-filter and rasterized the whole pill transparent (user
 *       reported "completely see-through").
 *   v3 (this): background/border/shadow go directly on `.beam-pill-frame`,
 *       so they're never inside the masked beam subtree. Beam lives in its
 *       own absolutely-positioned sibling; its mask only affects the beam
 *       pseudo-elements. Content is a third sibling on top.
 *
 * Per-state beam behavior:
 *   recording    — colorful variant; rAF drives `--beam-strength` +
 *                  `--beam-saturate` (grayscale at silence → color at speech).
 *   transcribing — ocean variant at fixed strength 0.55; no audio reactivity.
 *   complete     — bright colorful flash (strength 0.9) for ~500ms.
 *   error        — sunset variant at 0.55; sticks while the error is shown.
 *
 * prefers-reduced-motion: beam is `active={false}`, no rAF, no travel
 * animation. Interior content still renders its state-specific UI.
 */
export function BeamPill({ state, getAudioLevel, children }: BeamPillProps): React.ReactElement {
  const beamRef = useRef<HTMLDivElement | null>(null)
  const levelRef = useRef(0)
  const reducedMotion = useReducedMotion()

  const mode = BEAM_MODES[state] ?? BEAM_MODES.recording
  const beamActive = !reducedMotion

  useEffect(() => {
    const el = beamRef.current
    if (!el || !beamActive) {
      el?.style.removeProperty('--beam-strength')
      el?.style.removeProperty('--beam-saturate')
      levelRef.current = 0
      return
    }
    if (state === 'recording') {
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
    el.style.setProperty('--beam-saturate', mode.saturate.toFixed(3))
    return () => {
      el.style.removeProperty('--beam-saturate')
    }
  }, [state, beamActive, getAudioLevel, mode.saturate])

  return (
    <div
      className="beam-pill-frame"
      data-beam-state={state}
      style={{ width: PILL_WIDTH, height: PILL_HEIGHT }}
    >
      <div className="beam-pill-beam" aria-hidden="true">
        <BorderBeam
          ref={beamRef}
          size="line"
          borderRadius={PILL_BORDER_RADIUS}
          colorVariant={mode.colorVariant}
          theme="dark"
          staticColors
          active={beamActive}
          strength={mode.strength}
          style={{ width: '100%', height: '100%' }}
        >
          {/*
            The library declares `children` required and uses the first child's
            border-radius for auto-detection. We pass an empty fixed-radius
            placeholder so auto-detect (even though we also pass `borderRadius`
            explicitly) has something sensible to measure.
          */}
          <div style={{ width: '100%', height: '100%', borderRadius: PILL_BORDER_RADIUS }} />
        </BorderBeam>
      </div>

      <div className="beam-pill-content" role="status" aria-live="polite">
        {children}
      </div>
    </div>
  )
}
