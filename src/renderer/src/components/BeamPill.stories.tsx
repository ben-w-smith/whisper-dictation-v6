import { useEffect, useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { BeamPill } from './BeamPill'

/**
 * NOTE: Storybook uses a solid dark backdrop. The real overlay is a transparent
 * frameless macOS window composited over arbitrary desktop content. Final visual
 * verification MUST be done in `pnpm run app`, not Storybook. This file exists
 * for component structure, state-transition logic, and keyboard/click targets.
 *
 * prefers-reduced-motion cannot be faked from React — toggle System Settings →
 * Accessibility → Display → Reduce motion and reload Storybook to exercise that
 * branch. Without that, recording stories always show the audio-reactive beam.
 */

const meta: Meta<typeof BeamPill> = {
  title: 'Components/BeamPill',
  component: BeamPill,
  decorators: [
    (Story) => (
      <div
        style={{
          minHeight: '100vh',
          background: '#0f1014',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
        }}
      >
        <div style={{ width: 260, height: 44 }}>
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof BeamPill>

function Interior({ state }: { state: string }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '0 12px',
        gap: '8px',
      }}
    >
      {state === 'recording' && (
        <>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#f87171',
              opacity: 0.8,
            }}
          />
          <span
            style={{
              fontFamily: 'monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 11,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            0:05
          </span>
          <button
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'white' }} />
          </button>
        </>
      )}
      {state === 'transcribing' && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#93c5fd',
          }}
        />
      )}
      {state === 'complete' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === 'error' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}
    </div>
  )
}

export const Recording: Story = {
  args: {
    state: 'recording',
    getAudioLevel: () => 0.4,
    children: <Interior state="recording" />,
  },
}

export const RecordingLoud: Story = {
  args: {
    state: 'recording',
    getAudioLevel: () => 0.9,
    children: <Interior state="recording" />,
  },
}

export const RecordingSilent: Story = {
  args: {
    state: 'recording',
    getAudioLevel: () => 0.02,
    children: <Interior state="recording" />,
  },
}

/**
 * Oscillates audio level on a sine wave — the most natural way to eyeball
 * whether the aurora breathes with amplitude as intended. Pair this story
 * with System Settings → Reduce motion off.
 */
function useSineAudioLevel(periodMs = 2200): () => number {
  const levelRef = useRef(0)
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (): void => {
      const t = (performance.now() - start) / periodMs
      const s = Math.sin(t * Math.PI * 2) * 0.5 + 0.5
      levelRef.current = s * 0.9
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [periodMs])
  return () => levelRef.current
}

function RecordingCyclingRender(): React.ReactElement {
  const getAudioLevel = useSineAudioLevel(2200)
  return (
    <BeamPill state="recording" getAudioLevel={getAudioLevel}>
      <Interior state="recording" />
    </BeamPill>
  )
}

export const RecordingCycling: Story = {
  render: () => <RecordingCyclingRender />,
}

export const Transcribing: Story = {
  args: {
    state: 'transcribing',
    getAudioLevel: () => 0,
    children: <Interior state="transcribing" />,
  },
}

export const Complete: Story = {
  args: {
    state: 'complete',
    getAudioLevel: () => 0,
    children: <Interior state="complete" />,
  },
}

export const Error: Story = {
  args: {
    state: 'error',
    getAudioLevel: () => 0,
    children: <Interior state="error" />,
  },
}
