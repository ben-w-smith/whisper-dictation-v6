import React from 'react'

interface OverlayInteriorProps {
  beamState: 'recording' | 'transcribing' | 'complete' | 'error'
  /** @deprecated no longer rendered; pill no longer displays an elapsed-time counter. */
  timerDisplay?: string
  /** @deprecated unused — retained so existing callers compile. */
  timerMinutes?: number
  /** @deprecated unused — retained so existing callers compile. */
  timerSeconds?: number
  onCancel: () => void
  onStop: () => void
  errorMessage?: string
}

/**
 * Pill interior. Rendered inside `.beam-pill-content` (an absolutely-
 * positioned layer that sits above the beam subtree).
 *
 * The recording state uses a 3-slot grid (`[22px | flex | 22px]`) so the
 * pill's width/height stay constant across frames and the aurora beam is
 * the visually dominant element in the empty center. The cancel (X) button
 * is always visible — no hover gate — and the stop button uses a softer
 * pastel-red token rather than the full-saturation recording-state red.
 *
 * Non-recording states (transcribing / complete / error) still use simple
 * centered layouts for now and will adopt the same slot grid in S5/S6.
 */
export function OverlayInterior({
  beamState,
  onCancel,
  onStop,
  errorMessage,
}: OverlayInteriorProps): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full">
      {beamState === 'recording' && (
        <div className="grid grid-cols-[22px_1fr_22px] items-center gap-2 px-2.5 h-full w-full">
          {/* Left slot: always-visible cancel */}
          <button
            onClick={(e) => { e.stopPropagation(); onCancel() }}
            className="w-[22px] h-[22px] rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center transition-colors"
            aria-label="Cancel recording"
          >
            <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Center slot: intentionally empty — the audio-reactive beam below
              is the recording indicator. */}
          <div aria-hidden="true" />

          {/* Right slot: stop button in soft pastel red */}
          <button
            onClick={(e) => { e.stopPropagation(); onStop() }}
            className="w-[22px] h-[22px] rounded-full bg-[var(--color-stop-button)] hover:bg-[var(--color-stop-button-hover)] flex items-center justify-center transition-colors"
            aria-label="Stop recording"
          >
            <div className="w-2 h-2 rounded-[1px] bg-white" />
          </button>
        </div>
      )}

      {beamState === 'transcribing' && (
        <div className="flex items-center justify-center gap-2 px-2.5 h-full">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--color-state-transcribing)]" />
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
