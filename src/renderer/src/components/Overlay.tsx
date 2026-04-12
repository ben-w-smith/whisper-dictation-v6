import React, { useEffect, useState, useCallback } from 'react'
import type { ActorStateFrom } from 'xstate'
import type { PipelineMachine } from '@renderer/state'
import { WHIMSICAL_MESSAGES } from '@shared/constants'

interface OverlayProps {
  state: ActorStateFrom<PipelineMachine>
  send: (event: { type: string; [key: string]: unknown }) => void
  elapsedMs?: number
}

export function Overlay({ state, elapsedMs: externalElapsedMs, send }: OverlayProps): React.ReactElement | null {
  const [whimsicalIndex, setWhimsicalIndex] = useState(0)
  const { audioLevels } = state.context
  const elapsedMs = externalElapsedMs ?? state.context.elapsedMs

  const handleClick = useCallback(() => {
    if (state.matches('complete')) {
      send({ type: 'COMPLETE_ACKNOWLEDGED' })
    } else if (state.matches('error')) {
      send({ type: 'ERROR_DISMISSED' })
    }
  }, [state, send])

  useEffect(() => {
    if (state.matches('transcribing')) {
      const interval = setInterval(() => {
        setWhimsicalIndex((prev) => (prev + 1) % WHIMSICAL_MESSAGES.length)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [state.value])

  if (state.matches('idle')) {
    return null
  }

  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const elapsedFormatted = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`

  const renderRecordingState = () => (
    <>
      <div className="flex items-center gap-2">
        <div className="relative w-3 h-3 overflow-hidden">
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping" />
          <div className="absolute inset-0 bg-red-500 rounded-full" />
        </div>
        <span className="text-white/90 font-medium tabular-nums">{elapsedFormatted}</span>
      </div>
      <div className="flex items-end gap-0.5 h-4">
        {[...Array(5)].map((_, i) => {
          const level = audioLevels[i] ?? 0
          const height = Math.max(4, Math.min(16, level * 160))
          return (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full transition-all duration-75"
              style={{ height: `${height}px` }}
            />
          )
        })}
      </div>
    </>
  )

  const renderTranscribingState = () => (
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="text-white/90 text-sm">{WHIMSICAL_MESSAGES[whimsicalIndex]}</span>
    </div>
  )

  const renderCompleteState = () => (
    <div className="flex items-center gap-2">
      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-white/90 font-medium">Copied</span>
    </div>
  )

  const renderErrorState = () => {
    const errorMessage = state.context.error?.message ?? 'An error occurred'
    return (
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-white/90 text-sm">{errorMessage}</span>
      </div>
    )
  }

  return (
    <div
      className={`h-full flex items-center justify-center ${
        state.matches('complete') || state.matches('error') ? 'cursor-pointer' : 'pointer-events-none'
      }`}
      onClick={handleClick}
    >
      <div className="bg-stone-900/85 backdrop-blur-xl rounded-full px-5 py-3 shadow-2xl border border-white/10 w-full">
        <div className="flex items-center justify-between">
          {state.matches('recording') && renderRecordingState()}
          {state.matches('transcribing') && renderTranscribingState()}
          {state.matches('complete') && renderCompleteState()}
          {state.matches('error') && renderErrorState()}
        </div>
      </div>
    </div>
  )
}
