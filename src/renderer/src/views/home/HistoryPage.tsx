import React, { useState, useEffect } from 'react'
import type { TranscriptionEntry } from '@shared/types'
import { IPC } from '@shared/ipc'

export function HistoryPage(): React.ReactElement {
  const [history, setHistory] = useState<TranscriptionEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    const loadHistory = async () => {
      const loaded = await window.api.invoke(IPC.GET_HISTORY) as TranscriptionEntry[]
      setHistory(loaded.sort((a, b) => b.timestamp - a.timestamp))
    }
    loadHistory()

    // Listen for history updates from main process
    const unsubscribe = window.api.on(IPC.HISTORY_UPDATED, () => {
      loadHistory()
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleClearAll = async () => {
    await window.api.invoke('history:clear')
    setHistory([])
    setShowClearConfirm(false)
  }

  const getRelativeTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`

    const date = new Date(timestamp)
    return date.toLocaleDateString()
  }

  const getProviderBadge = (provider: string): { label: string; className: string } => {
    const badges: Record<string, { label: string; className: string }> = {
      local: { label: 'Local', className: 'bg-stone-100 text-stone-700' },
      openai: { label: 'OpenAI', className: 'bg-emerald-100 text-emerald-700' },
      google: { label: 'Google', className: 'bg-blue-100 text-blue-700' },
    }
    return badges[provider] ?? badges.local
  }

  const filteredHistory = history.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcriptions..."
            className="w-full pl-10 pr-4 py-2 border border-border-custom rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
          />
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {showClearConfirm && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
          <p className="text-text-primary mb-3">Are you sure you want to clear all history? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={handleClearAll}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="py-16 text-center">
          <svg
            className="w-16 h-16 text-text-muted mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-text-secondary">
            {searchQuery ? 'No transcriptions match your search' : 'No transcriptions yet'}
          </p>
          <p className="text-text-muted text-sm mt-1">
            {searchQuery ? 'Try a different search term' : 'Start dictating to see your history here'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredHistory.map((entry) => {
            const providerBadge = getProviderBadge(entry.transcriptionProvider)

            return (
              <div
                key={entry.id}
                className="p-4 rounded-xl border border-border-custom bg-surface hover:border-stone-300 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary line-clamp-2 leading-relaxed">
                      {entry.text}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${providerBadge.className}`}>
                        {providerBadge.label}
                      </span>
                      {entry.refinedWith && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                          Refined
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {getRelativeTime(entry.timestamp)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {entry.wordCount} words
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(entry.text)}
                    className="p-2 text-text-muted hover:text-accent hover:bg-accent-subtle rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Copy to clipboard"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
