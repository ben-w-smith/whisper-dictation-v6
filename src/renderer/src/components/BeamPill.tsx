import React, { useEffect, useRef } from 'react'
import './beam.css'

interface BeamPillProps {
  state: 'recording' | 'transcribing' | 'complete' | 'error'
  audioLevel: number // 0–1, smoothed RMS
  children: React.ReactNode
}

export function BeamPill({ state, audioLevel, children }: BeamPillProps): React.ReactElement {
  const pillRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number>(0)
  const levelRef = useRef(0)          // smoothed
  const targetLevelRef = useRef(0)    // latest from props

  // When audioLevel prop changes, update target
  useEffect(() => { targetLevelRef.current = audioLevel }, [audioLevel])

  useEffect(() => {
    const el = pillRef.current
    if (state !== 'recording') {
      // Clear inline custom properties so CSS-defined values take over
      if (el) {
        el.style.removeProperty('--beam-opacity')
        el.style.removeProperty('--beam-glow')
      }
      return
    }
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

  return (
    <div
      ref={pillRef}
      className="beam-pill"
      data-beam-state={state}
      role="status"
      aria-live="polite"
      style={{
        background: 'rgba(17, 17, 19, 0.78)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderRadius: '9999px',
        border: '1px inset rgba(255,255,255,0.06)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </div>
  )
}
