import React from 'react'
import type { AppSettings, ThemeName, AccentName, AmbientName } from '@shared/types'
import { ToggleSwitch } from '../components/ToggleSwitch'

const THEMES: { id: ThemeName; label: string; canvas: string; surface: string; border: string }[] = [
  { id: 'light', label: 'Light', canvas: '#fafafa', surface: '#ffffff', border: '#e4e4e7' },
  { id: 'warm',  label: 'Warm',  canvas: '#f0ece8', surface: '#faf8f6', border: '#e0dbd5' },
  { id: 'dark',  label: 'Dark',  canvas: '#1a1918', surface: '#242321', border: '#2e2d2a' },
  { id: 'black', label: 'Black', canvas: '#000000', surface: '#0a0a0a', border: '#1f1f1f' },
]

const ACCENTS: { id: AccentName; color: string }[] = [
  { id: 'teal',   color: '#0d9488' },
  { id: 'amber',  color: '#d97706' },
  { id: 'violet', color: '#7c3aed' },
  { id: 'rose',   color: '#e11d48' },
  { id: 'mono',   color: '#1c1917' },
]

const AMBIENTS: AmbientName[] = ['none', 'grain', 'dots', 'sunset', 'ocean']

interface AppearancePageProps {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

export function AppearancePage({ settings, updateSetting }: AppearancePageProps): React.ReactElement {
  const setTheme = (t: ThemeName) => updateSetting('theme', t)
  const setAccent = (a: AccentName) => updateSetting('accent', a)
  const setAmbient = (a: AmbientName) => updateSetting('ambient', a)
  const setRadiusScale = (v: number) => updateSetting('radiusScale', v)

  return (
    <div className="space-y-8">
      {/* Theme */}
      <section>
        <h2 className="text-text-primary text-sm font-semibold uppercase tracking-wide mb-4">Theme</h2>
        <div className="flex gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex-1 rounded-xl border-2 transition-all ${
                settings.theme === t.id
                  ? 'border-accent ring-2 ring-accent/20'
                  : 'border-border-custom hover:border-border-hover'
              }`}
            >
              <div className="rounded-lg overflow-hidden" style={{ background: t.canvas }}>
                <div
                  className="m-2 p-2 rounded-md text-[10px] font-medium"
                  style={{ background: t.surface, color: t.id === 'dark' || t.id === 'black' ? '#fafafa' : '#1c1917', border: `1px solid ${t.border}` }}
                >
                  {t.label}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Follow System */}
      <section className="flex items-center justify-between py-3 border-b border-border-custom">
        <div>
          <p className="text-text-primary text-sm font-medium">Follow system theme</p>
          <p className="text-text-muted text-xs mt-0.5">Uses macOS appearance setting</p>
        </div>
        <ToggleSwitch
          checked={settings.followSystemTheme}
          onChange={(v) => updateSetting('followSystemTheme', v)}
        />
      </section>

      {/* Accent Color */}
      <section>
        <h2 className="text-text-primary text-sm font-semibold uppercase tracking-wide mb-4">Accent Color</h2>
        <div className="flex gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              className={`w-10 h-10 rounded-full transition-all ${
                settings.accent === a.id
                  ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ background: a.id === 'mono' ? 'linear-gradient(135deg, #1c1917 50%, #e7e5e4 50%)' : a.color }}
              aria-label={a.id}
            />
          ))}
        </div>
      </section>

      {/* Corner Radius */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text-primary text-sm font-semibold uppercase tracking-wide">Corner Radius</h2>
          <span className="text-text-muted text-xs">{settings.radiusScale.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-text-muted text-xs">Sharp</span>
          <input
            type="range"
            min={0.85}
            max={1.2}
            step={0.05}
            value={settings.radiusScale}
            onChange={(e) => setRadiusScale(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-surface-active accent-accent"
          />
          <span className="text-text-muted text-xs">Round</span>
        </div>
        {/* Live preview tile */}
        <div
          className="mt-3 p-4 bg-surface border border-border-custom text-text-primary text-sm font-medium"
          style={{ borderRadius: `${12 * settings.radiusScale}px` }}
        >
          Preview {settings.radiusScale.toFixed(2)}
        </div>
      </section>

      {/* Ambient Background */}
      <section>
        <h2 className="text-text-primary text-sm font-semibold uppercase tracking-wide mb-4">Ambient Background</h2>
        <div className="flex gap-2">
          {AMBIENTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmbient(a)}
              className={`flex-1 py-2 px-1 rounded-lg border text-xs font-medium capitalize transition-all ${
                settings.ambient === a
                  ? 'border-accent bg-accent-subtle text-accent'
                  : 'border-border-custom bg-surface text-text-secondary hover:border-border-hover'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
