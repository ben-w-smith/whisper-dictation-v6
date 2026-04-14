import type { Meta, StoryObj } from '@storybook/react'
import { GeneralPage } from './GeneralPage'
import { defaultMockApi } from '../../__fixtures__'

const meta: Meta<typeof GeneralPage> = {
  title: 'Views/Home/General',
  component: GeneralPage,
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

export default meta
type Story = StoryObj<typeof GeneralPage>

export const Default: Story = {}
