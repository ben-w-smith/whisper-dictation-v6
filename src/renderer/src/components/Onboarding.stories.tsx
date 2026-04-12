import type { Meta, StoryObj } from '@storybook/react'
import { Onboarding } from './Onboarding'

const mockApi = {
  invoke: async (channel: string, ..._args: unknown[]) => {
    switch (channel) {
      case 'permissions:check':
        return { microphone: 'prompt', accessibility: 'prompt' }
      case 'settings:get':
        return {
          localModel: 'base.en',
          recordingMode: 'toggle',
          keyboardShortcut: 'Command+Shift+D',
          mouseButton: null,
        }
      case 'model:download':
        return undefined
      case 'settings:set':
        return undefined
      default:
        return undefined
    }
  },
  send: () => {},
  on: () => () => {},
}

const meta: Meta<typeof Onboarding> = {
  title: 'Components/Onboarding',
  component: Onboarding,
  decorators: [
    (Story) => {
      ;(window as unknown as { api: typeof mockApi }).api = mockApi
      return (
        <div className="w-[600px] h-[700px]">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof Onboarding>

export const Step1Welcome: Story = {
  args: {
    onComplete: () => console.log('done'),
  },
}
