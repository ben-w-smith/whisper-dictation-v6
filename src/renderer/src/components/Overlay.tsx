import React, { useMemo, useCallback } from 'react'
import type { ActorStateFrom } from 'xstate'
import type { PipelineMachine } from '@renderer/state'
import { BeamPill } from './BeamPill'
import './beam.css'

interface OverlayProps {
  state: ActorStateFrom<PipelineMachine>
  send: (event: { type: string; [key: string]: unknown }) => void
  elapsedMs?: number
}

export function Overlay({ state, elapsedMs: externalElapsedMs, send }: OverlayProps): React.ReactElement | null {
  const { audioLevels } = state.context
  const elapsedMs = externalElapsedMs ?? state.context.elapsedMs
  const audioLevel = useMemo(
    () => audioLevels.reduce((a, b) => a + b, 0) / (audioLevels.length || 1),
    [audioLevels]
  )

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

  const beamState =
    state.matches('recording')    ? 'recording'    :
    state.matches('transcribing') ? 'transcribing' :
    state.matches('complete')     ? 'complete'     :
    state.matches('error')        ? 'error'        : 'recording'

  const timerSeconds = Math.floor(elapsedMs / 1000)
  const timerMinutes = Math.floor(timerSeconds / 60)
  const timerDisplay = `${timerMinutes}:${(timerSeconds % 60).toString().padStart(2, '0')}`

  return (
    <div
      className={`h-full flex items-center justify-center ${
        state.matches('complete') || state.matches('error') ? 'cursor-pointer' : ''
      }`}
      onClick={handleClick}
    >
      <BeamPill state={beamState} audioLevel={audioLevel}>
        <div className="flex items-center justify-center h-[32px]">
          {state.matches('recording') && (
            <div className="flex items-center justify-between gap-2 px-2.5 h-full group">
              {/* Cancel button (X) — visible on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); handleCancel() }}
                className="shrink-0 w-[22px] h-[22px] rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Cancel recording"
              >
                <svg className="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Status dot — solid red, pulses */}
              <div className="w-[6px] h-[6px] rounded-full bg-[var(--color-state-recording)] animate-[beam-status-pulse_1.4s_linear_infinite]" />

              {/* Elapsed timer */}
              <span
                className="font-mono tabular-nums text-[11px] text-white/70 select-none"
                aria-label={`Recording elapsed: ${timerMinutes} minutes ${(timerSeconds % 60)} seconds`}
              >
                {timerDisplay}
              </span>

              {/* Stop button — red with square */}
              <button
                onClick={(e) => { e.stopPropagation(); send({ type: 'HOTKEY_PRESSED' }) }}
                className="shrink-0 w-[22px] h-[22px] rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                aria-label="Stop recording"
              >
                <div className="w-2 h-2 rounded-[1px] bg-white" />
              </button>
            </div>
          )}

          {state.matches('transcribing') && (
            <div className="flex items-center gap-2 px-2.5 h-full">
              <div className="w-[6px] h-[6px] rounded-full bg-[var(--color-state-transcribing)]" />
              <span className="font-mono tabular-nums text-[11px] text-white/70 select-none">{timerDisplay}</span>
            </div>
          )}

          {state.matches('complete') && (
            <div className="flex items-center justify-center px-3 h-full">
              <svg className="w-3.5 h-3.5 text-[var(--color-state-complete)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {state.matches('error') && (
            <div className="flex items-center gap-2 px-2.5 h-full">
              <svg className="w-4 h-4 text-[var(--color-state-error)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-white/90 text-xs">{state.context.error?.message ?? 'Error'}</span>
            </div>
          )}
        </div>
      </BeamPill>
    </div>
  )
}
