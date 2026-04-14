import React, { useState, useEffect, useCallback } from 'react'
import { ToggleSwitch } from '../../components/ToggleSwitch'
import type { AppSettings, LocalModel, RefinementIntensity, LlamaServerStatus } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'
import { CURATED_GGUF_MODELS } from '@shared/hf'
import type { DownloadedGgufModel, HfModelSearchResult } from '@shared/hf'

const MODEL_INFO: Record<LocalModel, { name: string; size: string; description: string }> = {
  'tiny.en': { name: 'Tiny', size: '39 MB', description: 'Fastest, good for quick commands' },
  'base.en': { name: 'Base', size: '74 MB', description: 'Balanced speed and accuracy' },
  'small.en': { name: 'Small', size: '244 MB', description: 'Better accuracy, still fast' },
  'medium.en': { name: 'Medium', size: '769 MB', description: 'High accuracy for dictation' },
  'large-v3': { name: 'Large V3', size: '1.5 GB', description: 'Best accuracy, slowest' },
}

const INTENSITY_INFO: Record<RefinementIntensity, { name: string; description: string }> = {
  light: { name: 'Light', description: 'Fix only obvious typos and punctuation' },
  medium: { name: 'Medium', description: 'Fix errors and improve sentence structure' },
  heavy: { name: 'Heavy', description: 'Full polish for professional output' },
}

const STATUS_LABELS: Record<LlamaServerStatus, { label: string; color: string }> = {
  stopped: { label: 'Stopped', color: 'text-text-muted' },
  starting: { label: 'Starting...', color: 'text-warning' },
  ready: { label: 'Ready', color: 'text-success' },
  error: { label: 'Error', color: 'text-danger' },
  crashed: { label: 'Crashed — check model file', color: 'text-danger' },
}

export function TranscriptionPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [llamaStatus, setLlamaStatus] = useState<LlamaServerStatus>('stopped')

  const [downloadProgress, setDownloadProgress] = useState<Record<LocalModel, number>>({
    'tiny.en': 0, 'base.en': 0, 'small.en': 0, 'medium.en': 0, 'large-v3': 0,
  })
  const [downloading, setDownloading] = useState<LocalModel | null>(null)
  const [downloadedModels, setDownloadedModels] = useState<Set<LocalModel>>(new Set())

  const [hfToken, setHfToken] = useState('')
  const [hfTokenSaved, setHfTokenSaved] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [downloadedGguf, setDownloadedGguf] = useState<DownloadedGgufModel[]>([])
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [ggufDownloadProgress, setGgufDownloadProgress] = useState<Record<string, number>>({})

  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<HfModelSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null)
  const [repoFiles, setRepoFiles] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    const loadDownloaded = async () => {
      const list = await window.api.invoke(IPC.GET_DOWNLOADED_MODELS) as LocalModel[]
      setDownloadedModels(new Set(list))
    }
    const loadToken = async () => {
      const token = await window.api.invoke(IPC.HF_GET_TOKEN) as string
      if (token) { setHfToken(token); setHfTokenSaved(true) }
      else { setShowTokenInput(true) }
    }
    const loadDownloadedGguf = async () => {
      const list = await window.api.invoke(IPC.HF_GET_DOWNLOADED_GGUF) as DownloadedGgufModel[]
      setDownloadedGguf(list)
    }

    loadSettings()
    loadDownloaded()
    loadToken()
    loadDownloadedGguf()

    const unsubProgress = window.api.on(IPC.DOWNLOAD_PROGRESS, (progress: { model: LocalModel; percent: number }) => {
      setDownloadProgress((prev) => ({ ...prev, [progress.model]: progress.percent }))
    })
    const unsubComplete = window.api.on(IPC.DOWNLOAD_COMPLETE, (model: LocalModel) => {
      setDownloading(null)
      setDownloadProgress((prev) => ({ ...prev, [model]: 100 }))
      setDownloadedModels((prev) => new Set([...prev, model]))
    })
    const unsubStatus = window.api.on(IPC.LLAMA_SERVER_STATUS, (status: unknown) => {
      setLlamaStatus(status as LlamaServerStatus)
    })
    const unsubGgufProgress = window.api.on(IPC.HF_DOWNLOAD_PROGRESS, (data: unknown) => {
      const p = data as { filename: string; percent: number }
      setGgufDownloadProgress((prev) => ({ ...prev, [p.filename]: p.percent }))
    })
    const unsubGgufComplete = window.api.on(IPC.HF_DOWNLOAD_COMPLETE, (data: unknown) => {
      const d = data as { filename: string }
      setDownloadingFile(null)
      setGgufDownloadProgress((prev) => ({ ...prev, [d.filename]: 100 }))
      window.api.invoke(IPC.HF_GET_DOWNLOADED_GGUF).then((list) => {
        setDownloadedGguf(list as DownloadedGgufModel[])
      })
    })
    const unsubGgufError = window.api.on(IPC.HF_DOWNLOAD_ERROR, (data: unknown) => {
      const e = data as { filename: string; error: string }
      setDownloadingFile(null)
      console.error('GGUF download error:', e.error)
    })

    return () => {
      unsubProgress?.(); unsubComplete?.(); unsubStatus?.()
      unsubGgufProgress?.(); unsubGgufComplete?.(); unsubGgufError?.()
    }
  }, [])

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }, [])

  const handleDownloadModel = async (model: LocalModel) => {
    setDownloading(model)
    setDownloadProgress((prev) => ({ ...prev, [model]: 0 }))
    await window.api.invoke(IPC.DOWNLOAD_MODEL, model)
  }

  const saveToken = async () => {
    await window.api.invoke(IPC.HF_SET_TOKEN, hfToken)
    setHfTokenSaved(true)
    setShowTokenInput(false)
  }

  const handleDownloadCurated = async (model: typeof CURATED_GGUF_MODELS[number]) => {
    setDownloadingFile(model.filename)
    setGgufDownloadProgress((prev) => ({ ...prev, [model.filename]: 0 }))
    try {
      await window.api.invoke(IPC.HF_DOWNLOAD_GGUF, model.repoId, model.filename, model.id)
    } catch (err) {
      setDownloadingFile(null)
      console.error('Download failed:', err)
    }
  }

  const handleDownloadSearch = async (repoId: string, filename: string) => {
    setDownloadingFile(filename)
    setGgufDownloadProgress((prev) => ({ ...prev, [filename]: 0 }))
    try {
      await window.api.invoke(IPC.HF_DOWNLOAD_GGUF, repoId, filename, null)
    } catch (err) {
      setDownloadingFile(null)
      console.error('Download failed:', err)
    }
  }

  const handleSelectGgufModel = async (filename: string) => {
    await updateSetting('refinementModelSource', 'downloaded')
    await updateSetting('refinementModelPath', `gguf://${filename}`)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await window.api.invoke(IPC.HF_SEARCH_MODELS, searchQuery) as HfModelSearchResult[]
      setSearchResults(results)
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  const toggleRepoFiles = async (repoId: string) => {
    if (expandedRepo === repoId) { setExpandedRepo(null); return }
    setExpandedRepo(repoId)
    if (!repoFiles[repoId]) {
      try {
        const files = await window.api.invoke(IPC.HF_GET_MODEL_FILES, repoId) as string[]
        setRepoFiles((prev) => ({ ...prev, [repoId]: files }))
      } catch {
        setRepoFiles((prev) => ({ ...prev, [repoId]: [] }))
      }
    }
  }

  const isFileDownloaded = (filename: string) => downloadedGguf.some((m) => m.filename === filename)
  const isSelectedFile = (filename: string) => settings.refinementModelPath === `gguf://${filename}`
  const source = settings.refinementModelSource

  return (
    <div className="space-y-8">
      {/* Whisper Model Section */}
      <section>
        <h3 className="text-[15px] font-semibold text-text-primary mb-1">Transcription Model</h3>
        <p className="text-sm text-text-secondary mb-4">Choose the local whisper.cpp model for speech-to-text</p>
        <div className="space-y-3">
          {(Object.keys(MODEL_INFO) as LocalModel[]).map((model) => {
            const info = MODEL_INFO[model]
            const isSelected = settings.localModel === model
            const isDownloading = downloading === model
            const isDownloaded = downloadedModels.has(model)
            const progress = downloadProgress[model]

            return (
              <button
                key={model}
                onClick={() => isDownloaded && updateSetting('localModel', model)}
                className={`
                  w-full p-4 rounded-xl border text-left transition-all
                  ${isSelected
                    ? 'border-selection bg-selection'
                    : 'border-border-custom bg-surface hover:border-border-hover'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`
                      w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${isSelected ? 'border-accent' : 'border-border-hover'}
                    `}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-accent" />}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">{info.name}</div>
                      <div className="text-sm text-text-secondary">{info.description}</div>
                      <div className="text-xs text-text-muted mt-1">{info.size}</div>
                    </div>
                  </div>
                  {isDownloading ? (
                    <div className="ml-4 w-32">
                      <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                        <span>Downloading</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-border-custom rounded-full overflow-hidden">
                        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
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
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDownloadModel(model) }}
                      className="ml-4 px-3 py-1.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle transition-colors"
                    >
                      Download
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* AI Refinement Section */}
      <section className="border-t border-border-custom pt-8">
        <div className="flex items-center justify-between p-4 rounded-xl border border-border-custom bg-surface">
          <div>
            <h3 className="font-medium text-text-primary">AI Refinement</h3>
            <p className="text-sm text-text-secondary mt-1">Clean up transcription with a local AI model</p>
          </div>
          <ToggleSwitch
            checked={settings.refinementEnabled}
            onChange={(checked) => updateSetting('refinementEnabled', checked)}
          />
        </div>

        {settings.refinementEnabled && (
          <div className="mt-6 space-y-6">
            <div className="flex border-b border-border-custom">
              <button
                onClick={() => updateSetting('refinementModelSource', 'downloaded')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  source === 'downloaded' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Downloaded
              </button>
              <button
                onClick={() => updateSetting('refinementModelSource', 'manual')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  source === 'manual' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Manual Path
              </button>
            </div>

            {source === 'downloaded' && (
              <>
                <div className="p-4 rounded-xl border border-border-custom bg-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[15px] font-semibold text-text-primary">Hugging Face Token</h4>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Required for downloading models. Some models need a token to accept their license first.
                  </p>
                  {hfTokenSaved && !showTokenInput ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-success font-medium">Token saved</span>
                      <button onClick={() => setShowTokenInput(true)} className="text-sm text-accent hover:text-accent-hover">Edit</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={hfToken}
                        onChange={(e) => setHfToken(e.target.value)}
                        placeholder="hf_..."
                        className="flex-1 px-3 py-2 border border-border-custom rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-surface font-mono text-sm"
                        spellCheck={false}
                      />
                      <button
                        onClick={saveToken}
                        disabled={!hfToken.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-[15px] font-semibold text-text-primary mb-4">Recommended Models</h4>
                  <div className="space-y-3">
                    {CURATED_GGUF_MODELS.map((model) => {
                      const dl = isFileDownloaded(model.filename)
                      const selected = isSelectedFile(model.filename)
                      const downloading = downloadingFile === model.filename
                      const progress = ggufDownloadProgress[model.filename] ?? 0

                      return (
                        <div
                          key={model.id}
                          className={`p-4 rounded-xl border transition-all ${
                            selected ? 'border-selection bg-selection' : 'border-border-custom bg-surface'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`
                                w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                ${selected ? 'border-accent' : 'border-border-hover'}
                              `}>
                                {selected && <div className="w-2 h-2 rounded-full bg-accent" />}
                              </div>
                              <div>
                                <div className="font-medium text-text-primary">{model.name}</div>
                                <div className="text-sm text-text-secondary">{model.description}</div>
                                <div className="text-xs text-text-muted mt-1">{model.size}</div>
                              </div>
                            </div>
                            {downloading ? (
                              <div className="ml-4 w-32">
                                <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                                  <span>Downloading</span>
                                  <span>{progress}%</span>
                                </div>
                                <div className="h-2 bg-border-custom rounded-full overflow-hidden">
                                  <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            ) : dl ? (
                              <span className="ml-4 flex items-center gap-1 text-sm text-success">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Downloaded
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDownloadCurated(model)}
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
                </div>

                <div>
                  <button
                    onClick={() => setSearchExpanded(!searchExpanded)}
                    className="flex items-center gap-2 text-[15px] font-semibold text-text-primary w-full"
                  >
                    <svg className={`w-4 h-4 transition-transform ${searchExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Search Hugging Face
                  </button>
                  {searchExpanded && (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          placeholder="Search GGUF models..."
                          className="flex-1 px-3 py-2 border border-border-custom rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-sm"
                          spellCheck={false}
                        />
                        <button
                          onClick={handleSearch}
                          disabled={searching || !searchQuery.trim()}
                          className="px-4 py-2 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle disabled:opacity-50 transition-colors"
                        >
                          {searching ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                      {searchResults.length > 0 && (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {searchResults.map((result) => (
                            <div key={result.id} className="p-3 rounded-lg border border-border-custom bg-surface">
                              <button onClick={() => toggleRepoFiles(result.id)} className="w-full text-left">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-mono text-text-primary">{result.id}</span>
                                  <span className="text-xs text-text-muted">{(result.downloads / 1000).toFixed(1)}k downloads</span>
                                </div>
                              </button>
                              {expandedRepo === result.id && (
                                <div className="mt-2 space-y-1">
                                  {repoFiles[result.id] === undefined ? (
                                    <span className="text-xs text-text-muted">Loading files...</span>
                                  ) : repoFiles[result.id].length === 0 ? (
                                    <span className="text-xs text-text-muted">No GGUF files found</span>
                                  ) : (
                                    repoFiles[result.id].map((file) => {
                                      const fileDl = isFileDownloaded(file)
                                      return (
                                        <div key={file} className="flex items-center justify-between py-1">
                                          <span className="text-xs font-mono text-text-secondary truncate mr-2">{file}</span>
                                          {fileDl ? (
                                            <span className="text-xs text-success flex-shrink-0">Downloaded</span>
                                          ) : (
                                            <button
                                              onClick={() => handleDownloadSearch(result.id, file)}
                                              disabled={downloadingFile === file}
                                              className="text-xs text-accent hover:text-accent-hover flex-shrink-0 disabled:opacity-50"
                                            >
                                              {downloadingFile === file ? `${ggufDownloadProgress[file] ?? 0}%` : 'Download'}
                                            </button>
                                          )}
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {source === 'manual' && (
              <div>
                <h4 className="text-[15px] font-semibold text-text-primary mb-2">Model File (GGUF)</h4>
                <p className="text-xs text-text-secondary mb-3">Paste the absolute path to a GGUF file on your machine.</p>
                <input
                  type="text"
                  value={settings.refinementModelPath}
                  onChange={(e) => updateSetting('refinementModelPath', e.target.value)}
                  placeholder="/path/to/model.gguf"
                  className="w-full px-3 py-2 border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-accent bg-surface font-mono text-sm"
                  spellCheck={false}
                />
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">llama-server status</span>
              <span className={`text-sm font-medium ${STATUS_LABELS[llamaStatus].color}`}>
                {STATUS_LABELS[llamaStatus].label}
              </span>
            </div>

            <div>
              <h4 className="text-[15px] font-semibold text-text-primary mb-4">Intensity</h4>
              <div className="space-y-3">
                {(Object.keys(INTENSITY_INFO) as RefinementIntensity[]).map((intensity) => {
                  const info = INTENSITY_INFO[intensity]
                  const isSelected = settings.refinementIntensity === intensity
                  return (
                    <button
                      key={intensity}
                      onClick={() => updateSetting('refinementIntensity', intensity)}
                      className={`
                        w-full p-4 rounded-xl border text-left transition-all
                        ${isSelected ? 'border-selection bg-selection' : 'border-border-custom bg-surface hover:border-border-hover'}
                      `}
                    >
                      <div className="font-medium text-text-primary">{info.name}</div>
                      <div className="text-sm text-text-secondary mt-1">{info.description}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!settings.refinementEnabled && (
          <div className="mt-6 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-canvas mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm font-medium">Enable refinement and download a model</p>
            <p className="text-text-muted text-xs mt-1.5">to activate local AI cleanup</p>
          </div>
        )}
      </section>
    </div>
  )
}
