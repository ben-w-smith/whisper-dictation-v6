import type { Meta, StoryObj } from '@storybook/react'
import { HistoryPage } from './HistoryPage'
import { createMockApi, emptyHistory, populatedHistory } from '../../__fixtures__'

const meta: Meta<typeof HistoryPage> = {
  title: 'Views/Home/History',
  component: HistoryPage,
}

export default meta
type Story = StoryObj<typeof HistoryPage>

export const Empty: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = createMockApi({ history: emptyHistory })
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export const Populated: Story = {
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = createMockApi({ history: populatedHistory })
      return (
        <div className="w-[600px]">
          <Story />
        </div>
      )
    },
  ],
}
