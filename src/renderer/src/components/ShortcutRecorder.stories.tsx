import type { Meta, StoryObj } from '@storybook/react'
import { ShortcutRecorder } from './ShortcutRecorder'

const meta: Meta<typeof ShortcutRecorder> = {
  title: 'Components/ShortcutRecorder',
  component: ShortcutRecorder,
  argTypes: {
    onChange: { action: 'changed' },
  },
}

export default meta
type Story = StoryObj<typeof ShortcutRecorder>

export const Empty: Story = {
  args: {
    value: null,
    mouseButton: null,
  },
}

export const WithKeyboardShortcut: Story = {
  args: {
    value: 'Command+Shift+D',
    mouseButton: null,
  },
}

export const WithMouseButton: Story = {
  args: {
    value: null,
    mouseButton: 3,
  },
}

export const Disabled: Story = {
  args: {
    value: 'Command+Shift+D',
    mouseButton: null,
    disabled: true,
  },
}
