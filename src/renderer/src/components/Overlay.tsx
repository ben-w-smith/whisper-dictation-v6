import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { ActorStateFrom } from 'xstate'
import type { PipelineMachine } from '@renderer/state'
import { WAVEFORM_GRADIENT, WAVEFORM_BAR_COUNT } from '@shared/constants'

interface OverlayProps {
  state: ActorStateFrom<PipelineMachine>
  send: (event: { type: string; [key: string]: unknown }) => void
  elapsedMs?: number
}

export function Overlay({ state, elapsedMs: externalElapsedMs, send }: OverlayProps): React.ReactElement | null {
  const { audioLevels } = state.context
  const elapsedMs = externalElapsedMs ?? state.context.elapsedMs
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number>(0)
  const levelsRef = useRef<number[]>(audioLevels)

  // Keep ref in sync
  levelsRef.current = audioLevels

  // rAF loop for waveform bars
  useEffect(() => {
    const tick = () => {
      const levels = levelsRef.current
      const bars = barsRef.current
      for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
        const bar = bars[i]
        if (!bar) continue
        const levelIndex = Math.floor((i / WAVEFORM_BAR_COUNT) * levels.length)
        const level = levels[levelIndex] ?? 0
        const height = Math.max(3, Math.min(24, level * 240))
        bar.style.height = `${height}px`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleCancel = useCallback(() => {
    send({ type: 'CANCEL' })
  }, [send])

  const handleClick = useCallback(() => {
    if (state.matches('complete')) {
      send({ type: 'COMPLETE_ACKNOWLEDGED' })
    } else if (state.matches('error')) {
      send({ type: 'ERROR_DISMISSED' })
    }
  }, [state, send])

  if (state.matches('idle')) {
    return null
  }

  return (
    <div
      className={`h-full flex items-center justify-center ${
        state.matches('complete') || state.matches('error') ? 'cursor-pointer' : ''
      }`}
      onClick={handleClick}
    >
      <div className="bg-stone-900/85 backdrop-blur-xl rounded-full px-3 py-2.5 shadow-2xl border border-white/10 w-full">
        <div className="flex items-center justify-between gap-2">
          {state.matches('recording') && (
            <>
              {/* Cancel button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleCancel() }}
                className="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Waveform bars */}
              <div className="flex-1 flex items-center justify-center gap-[3px] h-7">
                {[...Array(WAVEFORM_BAR_COUNT)].map((_, i) => (
                  <div
                    key={i}
                    ref={(el) => { barsRef.current[i] = el }}
                    className="w-[2px] rounded-full transition-none"
                    style={{
                      backgroundColor: WAVEFORM_GRADIENT[i],
                      height: '3px',
                    }}
                  />
                ))}
              </div>

              {/* Stop button */}
              <button
                onClick={(e) => { e.stopPropagation(); send({ type: 'HOTKEY_PRESSED' }) }}
                className="shrink-0 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-sm bg-white" />
              </button>
            </>
          )}

          {state.matches('transcribing') && (
            <div className="flex-1 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            </div>
          )}

          {state.matches('complete') && (
            <div className="flex-1 flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {state.matches('error') && (
            <div className="flex items-center gap-2 w-full px-1">
              <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-white/90 text-xs">{state.context.error?.message ?? 'Error'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
