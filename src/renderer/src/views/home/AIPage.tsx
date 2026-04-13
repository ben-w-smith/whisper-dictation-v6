import React, { useState, useEffect, useCallback } from 'react'
import { ToggleSwitch } from '../../components/ToggleSwitch'
import type { AppSettings, RefinementIntensity, LlamaServerStatus } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'
import { CURATED_GGUF_MODELS } from '@shared/hf'
import type { DownloadedGgufModel, HfModelSearchResult } from '@shared/hf'

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

export function AIPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [llamaStatus, setLlamaStatus] = useState<LlamaServerStatus>('stopped')

  // HF integration state
  const [hfToken, setHfToken] = useState('')
  const [hfTokenSaved, setHfTokenSaved] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [downloadedGguf, setDownloadedGguf] = useState<DownloadedGgufModel[]>([])
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})

  // Search state
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
    const loadToken = async () => {
      const token = await window.api.invoke(IPC.HF_GET_TOKEN) as string
      if (token) {
        setHfToken(token)
        setHfTokenSaved(true)
      } else {
        setShowTokenInput(true)
      }
    }
    const loadDownloaded = async () => {
      const list = await window.api.invoke(IPC.HF_GET_DOWNLOADED_GGUF) as DownloadedGgufModel[]
      setDownloadedGguf(list)
    }

    loadSettings()
    loadToken()
    loadDownloaded()

    const unsubStatus = window.api.on(IPC.LLAMA_SERVER_STATUS, (status: unknown) => {
      setLlamaStatus(status as LlamaServerStatus)
    })
    const unsubProgress = window.api.on(IPC.HF_DOWNLOAD_PROGRESS, (data: unknown) => {
      const p = data as { filename: string; percent: number }
      setDownloadProgress((prev) => ({ ...prev, [p.filename]: p.percent }))
    })
    const unsubComplete = window.api.on(IPC.HF_DOWNLOAD_COMPLETE, (data: unknown) => {
      const d = data as { filename: string }
      setDownloadingFile(null)
      setDownloadProgress((prev) => ({ ...prev, [d.filename]: 100 }))
      // Refresh downloaded list
      window.api.invoke(IPC.HF_GET_DOWNLOADED_GGUF).then((list) => {
        setDownloadedGguf(list as DownloadedGgufModel[])
      })
    })
    const unsubError = window.api.on(IPC.HF_DOWNLOAD_ERROR, (data: unknown) => {
      const e = data as { filename: string; error: string }
      setDownloadingFile(null)
      console.error('GGUF download error:', e.error)
    })

    return () => {
      unsubStatus?.()
      unsubProgress?.()
      unsubComplete?.()
      unsubError?.()
    }
  }, [])

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.invoke(IPC.SET_SETTING, key, value)
  }, [])

  const saveToken = async () => {
    await window.api.invoke(IPC.HF_SET_TOKEN, hfToken)
    setHfTokenSaved(true)
    setShowTokenInput(false)
  }

  const handleDownloadCurated = async (model: typeof CURATED_GGUF_MODELS[number]) => {
    setDownloadingFile(model.filename)
    setDownloadProgress((prev) => ({ ...prev, [model.filename]: 0 }))
    try {
      await window.api.invoke(IPC.HF_DOWNLOAD_GGUF, model.repoId, model.filename, model.id)
    } catch (err) {
      setDownloadingFile(null)
      console.error('Download failed:', err)
    }
  }

  const handleDownloadSearch = async (repoId: string, filename: string) => {
    setDownloadingFile(filename)
    setDownloadProgress((prev) => ({ ...prev, [filename]: 0 }))
    try {
      await window.api.invoke(IPC.HF_DOWNLOAD_GGUF, repoId, filename, null)
    } catch (err) {
      setDownloadingFile(null)
      console.error('Download failed:', err)
    }
  }

  const handleSelectModel = async (filename: string) => {
    await updateSetting('refinementModelSource', 'downloaded')
    // The main process resolves the path — we store a marker that points to the downloaded file
    await updateSetting('refinementModelPath', `gguf://${filename}`)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await window.api.invoke(IPC.HF_SEARCH_MODELS, searchQuery) as HfModelSearchResult[]
      setSearchResults(results)
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }

  const toggleRepoFiles = async (repoId: string) => {
    if (expandedRepo === repoId) {
      setExpandedRepo(null)
      return
    }
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

  const statusInfo = STATUS_LABELS[llamaStatus]
  const source = settings.refinementModelSource

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <section className="flex items-center justify-between p-4 rounded-xl border border-border-custom bg-surface">
        <div>
          <h3 className="font-medium text-text-primary">AI Refinement</h3>
          <p className="text-sm text-text-secondary mt-1">
            Clean up transcription with a local AI model
          </p>
        </div>
        <ToggleSwitch
          checked={settings.refinementEnabled}
          onChange={(checked) => updateSetting('refinementEnabled', checked)}
        />
      </section>

      {settings.refinementEnabled && (
        <>
          {/* Source tabs */}
          <section>
            <div className="flex border-b border-border-custom">
              <button
                onClick={() => updateSetting('refinementModelSource', 'downloaded')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  source === 'downloaded'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Downloaded
              </button>
              <button
                onClick={() => updateSetting('refinementModelSource', 'manual')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  source === 'manual'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Manual Path
              </button>
            </div>
          </section>

          {source === 'downloaded' && (
            <>
              {/* HF Token */}
              <section className="p-4 rounded-xl border border-border-custom bg-surface space-y-3">
                <h3 className="text-[15px] font-semibold text-text-primary">
                  Hugging Face Token
                </h3>
                <p className="text-xs text-text-secondary">
                  Required for downloading models. Some models need a token to accept their license first.
                </p>
                {hfTokenSaved && !showTokenInput ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-success font-medium">Token saved</span>
                    <button
                      onClick={() => setShowTokenInput(true)}
                      className="text-sm text-accent hover:text-accent-hover"
                    >
                      Edit
                    </button>
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
              </section>

              {/* Curated models */}
              <section className="border-t border-border-custom pt-6">
                <h3 className="text-[15px] font-semibold text-text-primary mb-4">
                  Recommended Models
                </h3>
                <div className="space-y-3">
                  {CURATED_GGUF_MODELS.map((model) => {
                    const downloaded = isFileDownloaded(model.filename)
                    const selected = isSelectedFile(model.filename)
                    const downloading = downloadingFile === model.filename
                    const progress = downloadProgress[model.filename] ?? 0

                    return (
                      <div
                        key={model.id}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selected ? 'border-accent bg-accent-subtle' : 'border-border-custom bg-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <input
                              type="radio"
                              name="gguf-model"
                              checked={selected}
                              onChange={() => downloaded && handleSelectModel(model.filename)}
                              disabled={!downloaded}
                              className="w-4 h-4 mt-0.5 text-accent focus:ring-accent"
                            />
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
                                <div
                                  className="h-full bg-accent transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          ) : downloaded ? (
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
              </section>

              {/* Search */}
              <section className="border-t border-border-custom pt-6">
                <button
                  onClick={() => setSearchExpanded(!searchExpanded)}
                  className="flex items-center gap-2 text-[15px] font-semibold text-text-primary hover:text-text-primary transition-colors w-full"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${searchExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
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
                          <div
                            key={result.id}
                            className="p-3 rounded-lg border border-border-custom bg-surface"
                          >
                            <button
                              onClick={() => toggleRepoFiles(result.id)}
                              className="w-full text-left"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-mono text-text-primary">{result.id}</span>
                                <span className="text-xs text-text-muted">
                                  {(result.downloads / 1000).toFixed(1)}k downloads
                                </span>
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
                                    const dl = isFileDownloaded(file)
                                    return (
                                      <div key={file} className="flex items-center justify-between py-1">
                                        <span className="text-xs font-mono text-text-secondary truncate mr-2">
                                          {file}
                                        </span>
                                        {dl ? (
                                          <span className="text-xs text-success flex-shrink-0">Downloaded</span>
                                        ) : (
                                          <button
                                            onClick={() => handleDownloadSearch(result.id, file)}
                                            disabled={downloadingFile === file}
                                            className="text-xs text-accent hover:text-accent-hover flex-shrink-0 disabled:opacity-50"
                                          >
                                            {downloadingFile === file ? `${downloadProgress[file] ?? 0}%` : 'Download'}
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
              </section>
            </>
          )}

          {source === 'manual' && (
            <section>
              <h3 className="text-[15px] font-semibold text-text-primary mb-2">
                Model File (GGUF)
              </h3>
              <p className="text-xs text-text-secondary mb-3">
                Paste the absolute path to a GGUF file on your machine.
              </p>
              <input
                type="text"
                value={settings.refinementModelPath}
                onChange={(e) => updateSetting('refinementModelPath', e.target.value)}
                placeholder="/path/to/model.gguf"
                className="w-full px-4 py-3 border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-accent bg-surface font-mono text-sm"
                spellCheck={false}
              />
            </section>
          )}

          {/* Server status */}
          <section className="flex items-center justify-between py-2">
            <span className="text-sm text-text-secondary">llama-server status</span>
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </section>

          {/* Intensity */}
          <section className="border-t border-border-custom pt-6">
            <h3 className="text-[15px] font-semibold text-text-primary mb-4">
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
                      ${isSelected ? 'border-accent bg-accent-subtle' : 'border-border-custom bg-surface hover:border-border-hover'}
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
            Enable refinement and download a model to activate local AI cleanup.
          </p>
        </div>
      )}
    </div>
  )
}
