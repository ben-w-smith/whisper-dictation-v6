import type { Meta, StoryObj } from '@storybook/react'
import { DictionaryPage } from './DictionaryPage'
import { createMockApi } from '../../__fixtures__'
import { defaultSettings, populatedDictionarySettings } from '../../__fixtures__/settings'

const meta: Meta<typeof DictionaryPage> = {
  title: 'Views/Home/Dictionary',
  component: DictionaryPage,
  decorators: [
    (Story, { parameters }) => {
      const settings = parameters.settings ?? defaultSettings
      // @ts-expect-error Mocking window.api for Storybook
      window.api = createMockApi({ settings })
      return (
        <div className="w-[600px] p-5">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof DictionaryPage>

export const Empty: Story = {}

export const Populated: Story = {
  parameters: { settings: populatedDictionarySettings },
}
