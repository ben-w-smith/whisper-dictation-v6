/**
 * NOTE: Storybook uses a solid dark backdrop. The real overlay is a transparent
 * frameless macOS window composited over arbitrary desktop content. Final visual
 * verification MUST be done in `pnpm run app`, not Storybook. This file exists
 * for component structure, state-transition logic, and keyboard/click targets.
 */
import type { Meta, StoryObj, Decorator } from '@storybook/react'
import { Overlay } from './Overlay'
import {
  recordingState,
  recordingSilentState,
  recordingLoudState,
  transcribingState,
  completeState,
  errorState,
} from '../__fixtures__'

const withOverlayBackdrop: Decorator = (Story) => (
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
)

const meta: Meta<typeof Overlay> = {
  title: 'Components/Overlay',
  component: Overlay,
  decorators: [withOverlayBackdrop],
}

export default meta
type Story = StoryObj<typeof Overlay>

export const Recording: Story = {
  args: {
    state: recordingState,
    send: () => {},
    elapsedMs: 5000,
  },
}

export const RecordingSilent: Story = {
  args: {
    state: recordingSilentState,
    send: () => {},
    elapsedMs: 12000,
  },
}

export const RecordingLoud: Story = {
  args: {
    state: recordingLoudState,
    send: () => {},
    elapsedMs: 3000,
  },
}

export const Transcribing: Story = {
  args: {
    state: transcribingState,
    send: () => {},
    elapsedMs: 5000,
  },
}

export const Complete: Story = {
  args: {
    state: completeState,
    send: () => {},
  },
}

export const Error: Story = {
  args: {
    state: errorState,
    send: () => {},
  },
}

export const RecordingReducedMotion: Story = {
  args: {
    state: recordingState,
    send: () => {},
    elapsedMs: 5000,
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
