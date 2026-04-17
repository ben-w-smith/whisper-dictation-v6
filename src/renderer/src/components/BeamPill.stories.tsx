import type { Meta, StoryObj } from '@storybook/react'
import { BeamPill } from './BeamPill'

/**
 * NOTE: Storybook uses a solid dark backdrop. The real overlay is a transparent
 * frameless macOS window composited over arbitrary desktop content. Final visual
 * verification MUST be done in `pnpm run app`, not Storybook. This file exists
 * for component structure, state-transition logic, and keyboard/click targets.
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

function Interior({ state }: { state: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '0 12px',
      gap: '8px',
    }}>
      {state === 'recording' && (
        <>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: '#f87171', opacity: 0.8,
          }} />
          <span style={{
            fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
            fontSize: 11, color: 'rgba(255,255,255,0.7)',
          }}>0:05</span>
          <button style={{
            width: 22, height: 22, borderRadius: '50%',
            backgroundColor: '#ef4444', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'white' }} />
          </button>
        </>
      )}
      {state === 'transcribing' && (
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: '#93c5fd',
        }} />
      )}
      {state === 'complete' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === 'error' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
    </div>
  )
}

export const Recording: Story = {
  args: {
    state: 'recording',
    audioLevel: 0.4,
    children: <Interior state="recording" />,
  },
}

export const RecordingLoud: Story = {
  args: {
    state: 'recording',
    audioLevel: 0.9,
    children: <Interior state="recording" />,
  },
}

export const RecordingSilent: Story = {
  args: {
    state: 'recording',
    audioLevel: 0.05,
    children: <Interior state="recording" />,
  },
}

export const Transcribing: Story = {
  args: {
    state: 'transcribing',
    audioLevel: 0,
    children: <Interior state="transcribing" />,
  },
}

export const Complete: Story = {
  args: {
    state: 'complete',
    audioLevel: 0,
    children: <Interior state="complete" />,
  },
}

export const Error: Story = {
  args: {
    state: 'error',
    audioLevel: 0,
    children: <Interior state="error" />,
  },
}

export const RecordingReducedMotion: Story = {
  args: {
    state: 'recording',
    audioLevel: 0.4,
    children: <Interior state="recording" />,
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100vh', background: '#0f1014', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <style>{`@media (prefers-reduced-motion: reduce) { .beam-pill::before { animation: none !important; } }`}</style>
        <div style={{ width: 260, height: 44 }}>
          <Story />
        </div>
      </div>
    ),
  ],
}
