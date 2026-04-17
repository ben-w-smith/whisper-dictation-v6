import React from 'react'

/**
 * 12-tick sunburst loading spinner, mono gray. Styled in beam.css under
 * `.pill-spinner`. Each tick's opacity cascades from fully visible (first
 * child) to near-transparent (last child); rotating the whole ring in
 * steps(12) makes the ticks appear to cycle around the perimeter.
 *
 * Sizing matches the 22×22 stop button in OverlayInterior so the right
 * slot of the pill doesn't reflow when transitioning recording →
 * transcribing.
 *
 * Inline opacity is preferred over 12 CSS pseudo-classes — keeps the
 * stylesheet short and the JSX readable.
 */
const TICK_COUNT = 12

export function PillSpinner(): React.ReactElement {
  return (
    <div className="pill-spinner" role="progressbar" aria-label="Transcribing">
      {Array.from({ length: TICK_COUNT }, (_, i) => (
        <span
          key={i}
          style={{
            opacity: (TICK_COUNT - i) / TICK_COUNT,
            transform: `rotate(${i * (360 / TICK_COUNT)}deg)`,
          }}
        />
      ))}
    </div>
  )
}
