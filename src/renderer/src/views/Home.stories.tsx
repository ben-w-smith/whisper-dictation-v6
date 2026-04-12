import type { Meta, StoryObj } from '@storybook/react'
import { Home } from './Home'
import { defaultMockApi } from '../__fixtures__'

const meta: Meta<typeof Home> = {
  title: 'Views/Home',
  component: Home,
  decorators: [
    (Story) => {
      // @ts-expect-error Mocking window.api for Storybook
      window.api = defaultMockApi
      return (
        <div className="w-[800px] h-[600px]">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof Home>

export const GeneralPage: Story = { args: { initialPage: 'general' } }
export const ModelPage: Story = { args: { initialPage: 'model' } }
export const AIPage: Story = { args: { initialPage: 'ai' } }
export const HistoryPage: Story = { args: { initialPage: 'history' } }
export const AboutPage: Story = { args: { initialPage: 'about' } }
