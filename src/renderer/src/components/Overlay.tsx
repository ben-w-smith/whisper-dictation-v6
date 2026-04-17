import React, { useEffect, useCallback, useRef } from 'react'
import type { ActorStateFrom } from 'xstate'
import type { PipelineMachine } from '@renderer/state'
import { BeamPill } from './BeamPill'
import { OverlayInterior } from './OverlayInterior'

interface OverlayProps {
  state: ActorStateFrom<PipelineMachine>
  send: (event: { type: string; [key: string]: unknown }) => void
  elapsedMs?: number
}

export function Overlay({ state, elapsedMs: externalElapsedMs, send }: OverlayProps): React.ReactElement | null {
  const { audioLevels } = state.context
  const elapsedMs = externalElapsedMs ?? state.context.elapsedMs

  // Mirror App.tsx pattern: read audio levels from a ref so getAudioLevel
  // has empty deps and doesn't restart BeamPill's rAF loop every 100ms
  const audioLevelsRef = useRef<number[]>([])
  useEffect(() => { audioLevelsRef.current = audioLevels }, [audioLevels])

  const getAudioLevel = useCallback(() => {
    const levels = audioLevelsRef.current
    if (levels.length === 0) return 0
    return levels.reduce((a, b) => a + b, 0) / levels.length
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
      <BeamPill state={beamState} getAudioLevel={getAudioLevel}>
        <OverlayInterior
          beamState={beamState}
          timerDisplay={timerDisplay}
          timerMinutes={timerMinutes}
          timerSeconds={timerSeconds}
          onCancel={handleCancel}
          onStop={() => send({ type: 'HOTKEY_PRESSED' })}
          errorMessage={state.matches('error') ? (state.context.error?.message ?? 'Error') : undefined}
        />
      </BeamPill>
    </div>
  )
}
