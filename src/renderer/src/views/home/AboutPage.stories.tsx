import type { Meta, StoryObj } from '@storybook/react'
import { AboutPage } from './AboutPage'
import { defaultMockApi } from '../../__fixtures__'

const meta: Meta<typeof AboutPage> = {
  title: 'Views/Home/About',
  component: AboutPage,
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
type Story = StoryObj<typeof AboutPage>

export const Default: Story = {}
