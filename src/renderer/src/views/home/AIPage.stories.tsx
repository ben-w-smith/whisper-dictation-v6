import type { Meta, StoryObj } from '@storybook/react'
import { AIPage } from './AIPage'
import { defaultMockApi, refinementMockApi } from '../../__fixtures__'

const meta: Meta<typeof AIPage> = {
  title: 'Views/Home/AI',
  component: AIPage,
}

export default meta
type Story = StoryObj<typeof AIPage>

export const Disabled: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = defaultMockApi
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export const Enabled: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = refinementMockApi
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}
