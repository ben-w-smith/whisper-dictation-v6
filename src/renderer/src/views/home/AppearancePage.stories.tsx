import type { Meta, StoryObj } from '@storybook/react'
import { AppearancePage } from './AppearancePage'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings } from '@shared/types'

const meta: Meta<typeof AppearancePage> = {
  title: 'Pages/AppearancePage',
  component: AppearancePage,
}

export default meta
type Story = StoryObj<typeof AppearancePage>

export const Default: Story = {
  render: () => {
    const settings: AppSettings = { ...DEFAULT_SETTINGS }
    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      (settings as Record<string, unknown>)[key] = value
    }
    return (
      <div className="bg-surface p-5">
        <div className="max-w-[640px]">
          <AppearancePage settings={settings} updateSetting={updateSetting} />
        </div>
      </div>
    )
  },
}
