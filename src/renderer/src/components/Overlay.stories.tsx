import type { Meta, StoryObj } from '@storybook/react'
import { Overlay } from './Overlay'
import {
  recordingState,
  recordingSilentState,
  recordingLoudState,
  transcribingState,
  completeState,
  errorState,
} from '../__fixtures__'

const meta: Meta<typeof Overlay> = {
  title: 'Components/Overlay',
  component: Overlay,
  decorators: [
    (Story) => (
      <div className="h-[80px] w-[400px] bg-stone-900/85 backdrop-blur-xl rounded-full">
        <Story />
      </div>
    ),
  ],
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
