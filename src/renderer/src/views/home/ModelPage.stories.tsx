import type { Meta, StoryObj } from '@storybook/react'
import { ModelPage } from './ModelPage'
import { defaultMockApi } from '../../__fixtures__'

const meta: Meta<typeof ModelPage> = {
  title: 'Views/Home/Model',
  component: ModelPage,
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
type Story = StoryObj<typeof ModelPage>

export const Default: Story = {}
