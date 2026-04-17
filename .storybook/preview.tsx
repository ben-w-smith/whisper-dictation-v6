import React, { useEffect } from 'react'
import type { Preview, Decorator } from '@storybook/react'
import '../src/renderer/src/styles/tokens.css'

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? 'warm'
  const accent = context.globals.accent ?? 'teal'
  const ambient = context.globals.ambient ?? 'none'
  const radiusScale = context.globals.radiusScale ?? 1

  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
    html.dataset.accent = accent
    html.dataset.ambient = ambient
    html.style.setProperty('--radius-scale', String(radiusScale))
  }, [theme, accent, ambient, radiusScale])

  return <Story />
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'warm', title: 'Warm' },
          { value: 'dark', title: 'Dark' },
          { value: 'black', title: 'Black' },
        ],
        showName: true,
      },
    },
    accent: {
      name: 'Accent',
      toolbar: {
        icon: 'circle',
        items: [
          { value: 'teal',   title: 'Teal' },
          { value: 'amber',  title: 'Amber' },
          { value: 'violet', title: 'Violet' },
          { value: 'rose',   title: 'Rose' },
          { value: 'mono',   title: 'Mono' },
        ],
      },
    },
    ambient: {
      name: 'Ambient',
      toolbar: {
        icon: 'photo',
        items: ['none', 'grain', 'dots', 'sunset', 'ocean'].map(v => ({ value: v, title: v })),
      },
    },
    radiusScale: {
      name: 'Radius',
      toolbar: {
        icon: 'cog',
        items: [
          { value: 0.85, title: 'Sharp (0.85)' },
          { value: 1.0,  title: 'Default (1.0)' },
          { value: 1.2,  title: 'Round (1.2)' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'warm', accent: 'teal', ambient: 'none', radiusScale: 1 },
  decorators: [withTheme],
}

export default preview
