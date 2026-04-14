import type { Meta, StoryObj } from '@storybook/react'
import { ToggleSwitch } from './ToggleSwitch'

const meta: Meta<typeof ToggleSwitch> = {
  title: 'Components/ToggleSwitch',
  component: ToggleSwitch,
  argTypes: {
    onChange: { action: 'changed' },
  },
}

export default meta
type Story = StoryObj<typeof ToggleSwitch>

export const Off: Story = {
  args: {
    checked: false,
    label: 'Toggle setting',
  },
}

export const On: Story = {
  args: {
    checked: true,
    label: 'Toggle setting',
  },
}

export const Disabled: Story = {
  args: {
    checked: false,
    disabled: true,
    label: 'Toggle setting',
  },
}

export const DisabledOn: Story = {
  args: {
    checked: true,
    disabled: true,
    label: 'Toggle setting',
  },
}
