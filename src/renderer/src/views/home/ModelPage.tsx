import React, { useState, useEffect } from 'react'
import type { AppSettings, LocalModel } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

const MODEL_INFO: Record<LocalModel, { name: string; size: string; description: string }> = {
  'tiny.en': { name: 'Tiny', size: '39 MB', description: 'Fastest, good for quick commands' },
  'base.en': { name: 'Base', size: '74 MB', description: 'Balanced speed and accuracy' },
  'small.en': { name: 'Small', size: '244 MB', description: 'Better accuracy, still fast' },
  'medium.en': { name: 'Medium', size: '769 MB', description: 'High accuracy for dictation' },
  'large-v3': { name: 'Large V3', size: '1.5 GB', description: 'Best accuracy, slowest' },
}

export function ModelPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [downloadProgress, setDownloadProgress] = useState<Record<LocalModel, number>>({
    'tiny.en': 0,
    'base.en': 0,
    'small.en': 0,
    'medium.en': 0,
    'large-v3': 0,
  })
  const [downloading, setDownloading] = useState<LocalModel | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadedModels, setDownloadedModels] = useState<Set<LocalModel>>(new Set())
  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    const loadDownloaded = async () => {
      const list = await window.api.invoke(IPC.GET_DOWNLOADED_MODELS) as LocalModel[]
      setDownloadedModels(new Set(list))
    }
    loadSettings()
    loadDownloaded()

    // window.api.on is typed as (...args: unknown[]) — cast the first arg
    // to the payload shape the main process actually broadcasts.
    const unsubscribe = window.api.on(IPC.DOWNLOAD_PROGRESS, (...args) => {
      const progress = args[0] as { model: LocalModel; percent: number }
      setDownloadProgress((prev) => ({ ...prev, [progress.model]: progress.percent }))
    })

    const unsubscribeComplete = window.api.on(IPC.DOWNLOAD_COMPLETE, (...args) => {
      const model = args[0] as LocalModel
      setDownloading(null)
      setDownloadProgress((prev) => ({ ...prev, [model]: 100 }))
      setDownloadedModels((prev) => new Set([...prev, model]))
    })

    return () => {
      unsubscribe()
      unsubscribeComplete()
    }
  }, [])

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }

  const handleDownload = async (model: LocalModel) => {
    setDownloading(model)
    setDownloadError(null)
    setDownloadProgress((prev) => ({ ...prev, [model]: 0 }))
    try {
      await window.api.invoke(IPC.DOWNLOAD_MODEL, model)
    } catch (err) {
      setDownloading(null)
      setDownloadError(`Failed to download ${MODEL_INFO[model].name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-[var(--spacing-section)]">
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Local Model</h3>
        {downloadError && (
          <div className="flex items-start gap-2 p-3 mb-3 bg-danger-subtle border border-danger/20 rounded-lg">
            <svg className="w-4 h-4 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <span className="text-sm text-danger">{downloadError}</span>
            </div>
            <button
              onClick={() => setDownloadError(null)}
              className="text-danger/60 hover:text-danger"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="space-y-3">
          {(Object.keys(MODEL_INFO) as LocalModel[]).map((model) => {
            const info = MODEL_INFO[model]
            const isSelected = settings.localModel === model
            const isDownloading = downloading === model
            const isDownloaded = downloadedModels.has(model)
            const progress = downloadProgress[model]

            return (
              <div
                key={model}
                className={`
                  p-4 rounded-xl border-2 transition-all
                  ${isSelected ? 'border-accent bg-accent-subtle' : 'border-border-custom bg-surface'}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="local-model"
                        id={model}
                        checked={isSelected}
                        onChange={() => isDownloaded && updateSetting('localModel', model)}
                        disabled={!isDownloaded}
                        className="w-4 h-4 text-accent focus:ring-accent disabled:opacity-50"
                      />
                      <label htmlFor={model} className="cursor-pointer">
                        <div className="font-medium text-text-primary">{info.name}</div>
                        <div className="text-sm text-text-secondary">{info.description}</div>
                        <div className="text-xs text-text-muted mt-1">{info.size}</div>
                      </label>
                    </div>
                  </div>
                  {isDownloading ? (
                    <div className="ml-4 w-32">
                      <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                        <span>Downloading</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-border-custom rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : isDownloaded ? (
                    <span className="ml-4 flex items-center gap-1 text-sm text-success">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Downloaded
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDownload(model)}
                      className="ml-4 px-3 py-1.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle transition-colors"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
