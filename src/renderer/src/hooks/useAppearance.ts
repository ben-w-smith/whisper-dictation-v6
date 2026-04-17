import { useEffect, useMemo, useState } from 'react'
import type { ThemeName, AccentName, AmbientName } from '@shared/types'

interface AppearanceSettings {
  theme: ThemeName
  accent: AccentName
  radiusScale: number
  ambient: AmbientName
  followSystemTheme: boolean
}

export function useAppearance(settings: AppearanceSettings) {
  const effectiveTheme = useMemo<ThemeName>(() => {
    if (!settings.followSystemTheme) return settings.theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }, [settings.theme, settings.followSystemTheme])

  const [systemThemeVersion, setSystemThemeVersion] = useState(0)

  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = effectiveTheme
    html.dataset.accent = settings.accent
    html.dataset.ambient = settings.ambient
    html.style.setProperty('--radius-scale', String(settings.radiusScale))

    // Write-through to localStorage for no-flash bootstrap on next launch
    try {
      localStorage.setItem('wd-appearance', JSON.stringify({
        theme: settings.theme,
        accent: settings.accent,
        ambient: settings.ambient,
        radiusScale: settings.radiusScale,
      }))
    } catch {}
  }, [effectiveTheme, settings.accent, settings.ambient, settings.radiusScale, settings.theme])

  // Listen for system theme changes when followSystemTheme is on
  useEffect(() => {
    if (!settings.followSystemTheme) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemThemeVersion(v => v + 1)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.followSystemTheme])
}
