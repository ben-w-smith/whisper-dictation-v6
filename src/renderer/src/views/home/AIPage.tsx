import React, { useState, useEffect, useCallback } from 'react'
import { ToggleSwitch } from '../../components/ToggleSwitch'
import type { AppSettings, RefinementIntensity, LlamaServerStatus } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

const INTENSITY_INFO: Record<RefinementIntensity, { name: string; description: string }> = {
  light: { name: 'Light', description: 'Fix only obvious typos and punctuation' },
  medium: { name: 'Medium', description: 'Fix errors and improve sentence structure' },
  heavy: { name: 'Heavy', description: 'Full polish for professional output' },
}

const STATUS_LABELS: Record<LlamaServerStatus, { label: string; color: string }> = {
  stopped: { label: 'Stopped', color: 'text-stone-400' },
  starting: { label: 'Starting...', color: 'text-amber-500' },
  ready: { label: 'Ready', color: 'text-green-600' },
  error: { label: 'Error', color: 'text-red-500' },
  crashed: { label: 'Crashed — check model file', color: 'text-red-600' },
}

export function AIPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [llamaStatus, setLlamaStatus] = useState<LlamaServerStatus>('stopped')

  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    loadSettings()

    const unsubStatus = window.api.on(IPC.LLAMA_SERVER_STATUS, (status: unknown) => {
      setLlamaStatus(status as LlamaServerStatus)
    })

    return () => { unsubStatus() }
  }, [])

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }, [])

  const statusInfo = STATUS_LABELS[llamaStatus]

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <section className="flex items-center justify-between p-4 rounded-xl border border-border-custom bg-surface">
        <div>
          <h3 className="font-medium text-text-primary">AI Refinement</h3>
          <p className="text-sm text-text-secondary mt-1">
            Clean up transcription with a local Gemma model
          </p>
        </div>
        <ToggleSwitch
          checked={settings.refinementEnabled}
          onChange={(checked) => updateSetting('refinementEnabled', checked)}
        />
      </section>

      {settings.refinementEnabled && (
        <>
          {/* Model path */}
          <section>
            <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-2">
              Model File (GGUF)
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Paste the absolute path to a GGUF file. Recommended: Gemma 4 E2B Q4_K_M from{' '}
              <span className="font-mono text-text-primary">unsloth/gemma-4-E2B-it-GGUF</span> on Hugging Face.
            </p>
            <input
              type="text"
              value={settings.refinementModelPath}
              onChange={(e) => updateSetting('refinementModelPath', e.target.value)}
              placeholder="/path/to/gemma-4-E2B-Q4_K_M.gguf"
              className="w-full px-4 py-3 border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-accent bg-surface font-mono text-sm"
              spellCheck={false}
            />
          </section>

          {/* Server status */}
          <section className="flex items-center justify-between py-2">
            <span className="text-sm text-text-secondary">llama-server status</span>
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </section>

          {/* Intensity */}
          <section>
            <h3 className="text-sm font-medium uppercase tracking-wide text-text-secondary mb-4">
              Intensity
            </h3>
            <div className="space-y-3">
              {(Object.keys(INTENSITY_INFO) as RefinementIntensity[]).map((intensity) => {
                const info = INTENSITY_INFO[intensity]
                const isSelected = settings.refinementIntensity === intensity
                return (
                  <button
                    key={intensity}
                    onClick={() => updateSetting('refinementIntensity', intensity)}
                    className={`
                      w-full p-4 rounded-xl border-2 text-left transition-all
                      ${isSelected ? 'border-accent bg-accent-subtle' : 'border-border-custom bg-surface hover:border-stone-300'}
                    `}
                  >
                    <div className="font-medium text-text-primary">{info.name}</div>
                    <div className="text-sm text-text-secondary mt-1">{info.description}</div>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}

      {!settings.refinementEnabled && (
        <div className="p-8 rounded-xl border border-border-custom bg-surface text-center">
          <p className="text-text-secondary text-sm">
            Enable refinement and point to a GGUF model file to activate local AI cleanup.
          </p>
        </div>
      )}
    </div>
  )
}
