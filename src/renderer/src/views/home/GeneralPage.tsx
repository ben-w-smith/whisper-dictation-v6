import React, { useState, useEffect, useCallback } from 'react'
import { ToggleSwitch } from '../../components/ToggleSwitch'
import { ShortcutRecorder } from '../../components/ShortcutRecorder'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

interface AudioDevice {
  deviceId: string
  label: string
}

type MicPermission = 'granted' | 'denied' | 'prompt' | 'checking'

export function GeneralPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [microphones, setMicrophones] = useState<AudioDevice[]>([])
  const [micPermission, setMicPermission] = useState<MicPermission>('checking')

  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    loadSettings()
    checkMicPermission()
  }, [])

  const checkMicPermission = useCallback(async () => {
    setMicPermission('checking')
    const result = await window.api.invoke(IPC.CHECK_PERMISSIONS) as { microphone: 'granted' | 'denied' | 'prompt' }
    setMicPermission(result.microphone)
  }, [])

  const requestMicPermission = useCallback(async () => {
    setMicPermission('checking')
    const granted = await window.api.invoke(IPC.REQUEST_MICROPHONE) as boolean
    setMicPermission(granted ? 'granted' : 'denied')
  }, [])

  const refreshMicrophones = useCallback(async (opts?: { hardRefresh?: boolean }) => {
    try {
      // Try enumerateDevices() WITHOUT activating the microphone hardware.
      // In Electron with macOS TCC permissions already granted, this returns
      // device labels without triggering an audio codec switch (which causes
      // an audible glitch/pop, especially with AirPods).
      let devices = await navigator.mediaDevices.enumerateDevices()
      const hasLabels = devices.some(d => d.kind === 'audioinput' && d.label)

      // If labels are missing or this is an explicit hard refresh, activate
      // the microphone via getUserMedia and re-enumerate. This ensures labels
      // are populated on first run before permissions are sticky, and gives
      // the refresh button a way to do a full re-scan.
      if (!hasLabels || opts?.hardRefresh) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempStream.getTracks().forEach(t => t.stop())
        devices = await navigator.mediaDevices.enumerateDevices()
      }

      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone (${d.deviceId.slice(0, 8)})`,
        }))
      setMicrophones(audioInputs)
    } catch (error) {
      console.warn('[Settings] Could not enumerate microphones:', error)
      setMicrophones([])
    }
  }, [])

  useEffect(() => {
    refreshMicrophones()
  }, [refreshMicrophones])

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Audio Input</h3>

        {micPermission === 'denied' && (
          <div className="flex items-start gap-3 p-3 mb-3 bg-red-50 border border-red-200 rounded-lg">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium text-red-700">Microphone access denied</div>
              <div className="text-xs text-red-600 mt-0.5">Enable access in System Settings to use dictation.</div>
              <button
                onClick={() => window.api.invoke(IPC.OPEN_SYSTEM_SETTINGS, 'microphone')}
                className="mt-1.5 text-xs font-medium text-red-600 hover:text-red-700 underline underline-offset-2"
              >
                Open System Settings →
              </button>
            </div>
          </div>
        )}
        {micPermission === 'prompt' && (
          <div className="flex items-start gap-3 p-3 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-700">Microphone permission required</div>
              <div className="text-xs text-amber-600 mt-0.5">Grant access so the app can record your voice.</div>
              <button
                onClick={requestMicPermission}
                className="mt-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2"
              >
                Grant Access →
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-text-primary font-medium">Microphone</div>
              {micPermission === 'granted' && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Access granted
                </span>
              )}
            </div>
            <div className="text-sm text-text-secondary">Select the microphone for recording</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={settings.microphoneDeviceId}
              onChange={(e) => updateSetting('microphoneDeviceId', e.target.value)}
              disabled={micPermission !== 'granted'}
              className="bg-surface border border-border-custom rounded-lg px-3 py-1.5 text-sm text-text-primary max-w-[200px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Select microphone"
            >
              <option value="">System Default</option>
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => refreshMicrophones({ hardRefresh: true })}
              className="text-text-secondary hover:text-text-primary p-1 transition-colors"
              title="Refresh microphone list"
              aria-label="Refresh microphone list"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Output</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-border-custom last:border-b-0">
            <div>
              <div className="text-text-primary font-medium">Copy to clipboard</div>
              <div className="text-sm text-text-secondary">Copy transcribed text to clipboard</div>
            </div>
            <ToggleSwitch
              checked={settings.copyToClipboard}
              onChange={(checked) => updateSetting('copyToClipboard', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border-custom last:border-b-0">
            <div>
              <div className="text-text-primary font-medium">Auto-paste</div>
              <div className="text-sm text-text-secondary">Automatically paste transcribed text</div>
            </div>
            <ToggleSwitch
              checked={settings.autoPaste}
              onChange={(checked) => updateSetting('autoPaste', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border-custom last:border-b-0">
            <div>
              <div className="text-text-primary font-medium">Play sounds</div>
              <div className="text-sm text-text-secondary">Play sound effects when recording</div>
            </div>
            <ToggleSwitch
              checked={settings.playSounds}
              onChange={(checked) => updateSetting('playSounds', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border-custom last:border-b-0">
            <div>
              <div className="text-text-primary font-medium">Show overlay</div>
              <div className="text-sm text-text-secondary">Show floating recording indicator</div>
            </div>
            <ToggleSwitch
              checked={settings.showOverlay}
              onChange={(checked) => updateSetting('showOverlay', checked)}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Shortcuts</h3>
        <div>
          <div className="text-sm text-text-secondary mb-3">
            Press your shortcut to start recording, press again to stop.
          </div>
          <div className="space-y-2">
            {(settings.keyboardShortcuts ?? []).map((shortcut, index) => (
              <div key={index} className="flex items-center gap-2">
                <ShortcutRecorder
                  value={shortcut}
                  mouseButton={index === 0 ? settings.mouseButton : null}
                  onChange={(keyboard, mouse) => {
                    // Mouse button captured
                    if (typeof mouse === 'number' && index === 0) {
                      updateSetting('mouseButton', mouse)
                      return
                    }
                    // Keyboard shortcut captured
                    if (keyboard) {
                      const updated = [...settings.keyboardShortcuts]
                      updated[index] = keyboard
                      updateSetting('keyboardShortcuts', updated)
                      return
                    }
                    // Clear: both null
                    if (index === 0) {
                      updateSetting('mouseButton', null)
                    } else {
                      const updated = settings.keyboardShortcuts.filter((_, i) => i !== index)
                      updateSetting('keyboardShortcuts', updated)
                    }
                  }}
                />
                {(settings.keyboardShortcuts ?? []).length > 1 && (
                  <button
                    onClick={() => {
                      const updated = settings.keyboardShortcuts.filter((_, i) => i !== index)
                      updateSetting('keyboardShortcuts', updated)
                    }}
                    className="p-2 text-text-muted hover:text-text-primary hover:bg-canvas rounded-lg transition-colors"
                    aria-label="Remove shortcut"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                updateSetting('keyboardShortcuts', [...settings.keyboardShortcuts, ''])
              }}
              className="text-sm text-accent hover:text-accent-hover font-medium transition-colors"
            >
              + Add Shortcut
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
