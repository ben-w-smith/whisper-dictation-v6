import React from 'react'

interface OverlayInteriorProps {
  beamState: 'recording' | 'transcribing' | 'complete' | 'error'
  timerDisplay: string
  timerMinutes: number
  timerSeconds: number
  onCancel: () => void
  onStop: () => void
  errorMessage?: string
}

export function OverlayInterior({
  beamState,
  timerDisplay,
  timerMinutes,
  timerSeconds,
  onCancel,
  onStop,
  errorMessage,
}: OverlayInteriorProps): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-[32px]">
      {beamState === 'recording' && (
        <div className="flex items-center justify-between gap-2 px-2.5 h-full group">
          {/* Cancel button (X) — visible on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onCancel() }}
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
            onClick={(e) => { e.stopPropagation(); onStop() }}
            className="shrink-0 w-[22px] h-[22px] rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            aria-label="Stop recording"
          >
            <div className="w-2 h-2 rounded-[1px] bg-white" />
          </button>
        </div>
      )}

      {beamState === 'transcribing' && (
        <div className="flex items-center gap-2 px-2.5 h-full">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--color-state-transcribing)]" />
          <span className="font-mono tabular-nums text-[11px] text-white/70 select-none">{timerDisplay}</span>
        </div>
      )}

      {beamState === 'complete' && (
        <div className="flex items-center justify-center px-3 h-full">
          <svg className="w-3.5 h-3.5 text-[var(--color-state-complete)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {beamState === 'error' && (
        <div className="flex items-center gap-2 px-2.5 h-full">
          <svg className="w-4 h-4 text-[var(--color-state-error)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMessage && <span className="text-white/90 text-xs">{errorMessage}</span>}
        </div>
      )}
    </div>
  )
}
