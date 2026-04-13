import React, { useState, useEffect, useMemo } from 'react'
import type { TranscriptionEntry } from '@shared/types'
import { IPC } from '@shared/ipc'

export function HistoryPage(): React.ReactElement {
  const [history, setHistory] = useState<TranscriptionEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showingRaw, setShowingRaw] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const loadHistory = async () => {
      const loaded = await window.api.invoke(IPC.GET_HISTORY) as TranscriptionEntry[]
      // Debug: log first few entries to check rawText
      loaded.slice(0, 3).forEach((e) => {
        console.log('[HistoryPage] Entry:', {
          id: e.id.substring(0, 8),
          text: e.text?.substring(0, 40),
          rawText: e.rawText?.substring(0, 40),
          hasRawText: !!e.rawText,
          areDifferent: e.rawText !== e.text,
          refinedWith: e.refinedWith,
        })
      })
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

  const formatTimestamp = (timestamp: number): string => {
    const now = new Date()
    const date = new Date(timestamp)
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    const isToday = now.toDateString() === date.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = yesterday.toDateString() === date.toDateString()

    if (isToday) return `today at ${timeStr}`
    if (isYesterday) return `yesterday at ${timeStr}`

    const monthDay = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    return `${monthDay} at ${timeStr}`
  }

  const getProviderBadge = (provider: string): { label: string; className: string } => {
    const badges: Record<string, { label: string; className: string }> = {
      local: { label: 'Local', className: 'bg-canvas text-text-muted' },
      openai: { label: 'OpenAI', className: 'bg-canvas text-text-muted' },
      google: { label: 'Google', className: 'bg-canvas text-text-muted' },
    }
    return badges[provider] ?? badges.local
  }

  const formatMetadata = (entry: TranscriptionEntry): string | null => {
    const parts: string[] = []
    if (entry.transcriptionModel) {
      parts.push(entry.transcriptionModel)
    }
    if (entry.transcriptionDurationMs != null) {
      parts.push(`${(entry.transcriptionDurationMs / 1000).toFixed(1)}s`)
    }
    if (entry.refinementModel) {
      const label = entry.refinementDurationMs != null
        ? `${entry.refinementModel} (${(entry.refinementDurationMs / 1000).toFixed(1)}s)`
        : entry.refinementModel
      parts.push(`Refined by ${label}`)
    }
    return parts.length > 0 ? parts.join(' \u00b7 ') : null
  }

  const filteredHistory = history.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = useMemo(() => {
    if (history.length === 0) return null

    const totalWords = history.reduce((sum, e) => sum + e.wordCount, 0)
    const sessions = history.length

    const validWpmEntries = history.filter((e) => e.audioDurationMs >= 1000)
    const avgWpm =
      validWpmEntries.length > 0
        ? validWpmEntries.reduce(
            (sum, e) => sum + e.wordCount / (e.audioDurationMs / 60000),
            0
          ) / validWpmEntries.length
        : 0

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = history.filter((e) => e.timestamp >= todayStart.getTime()).length

    return {
      totalWords,
      sessions,
      avgWpm: Math.round(avgWpm * 10) / 10,
      todayCount,
    }
  }, [history])

  const copyToClipboard = (text: string, entryId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(entryId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
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
            aria-label="Search transcriptions"
            className="w-full pl-11 pr-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:ring-2 focus:ring-accent bg-surface text-sm"
          />
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            aria-label="Clear all history"
            className="px-3 py-2 text-xs font-medium text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-canvas rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {stats && (
        <div className="text-sm text-text-muted">{stats.totalWords.toLocaleString()} words across {stats.sessions} sessions</div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-canvas mb-4">
            <svg
              className="w-6 h-6 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-text-secondary text-sm font-medium">
            {searchQuery ? 'No transcriptions match your search' : 'No transcriptions yet'}
          </p>
          <p className="text-text-muted text-xs mt-1.5">
            {searchQuery ? 'Try a different search term' : 'Start dictating to see your history here'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-custom">
          {filteredHistory.map((entry) => {
            const providerBadge = getProviderBadge(entry.transcriptionProvider)
            const isShowingRaw = showingRaw.has(entry.id)
            const hasRefinement = entry.rawText && entry.rawText !== entry.text
            const displayText = isShowingRaw ? entry.rawText : entry.text

            return (
              <div
                key={entry.id}
                className={`py-4 group transition-colors ${
                  isShowingRaw ? 'bg-amber-50/30 -mx-0 px-0' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary leading-relaxed whitespace-pre-wrap text-[13px]">
                      {displayText}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className={`text-[11px] px-1.5 py-px rounded font-medium ${providerBadge.className}`}>
                        {providerBadge.label}
                      </span>
                      {hasRefinement && !isShowingRaw && (
                        <span className="text-[11px] px-1.5 py-px rounded font-medium bg-info-subtle text-info">
                          Refined
                        </span>
                      )}
                      {isShowingRaw && (
                        <span className="text-[11px] px-1.5 py-px rounded font-medium bg-warning-subtle text-warning">
                          Original
                        </span>
                      )}
                      <span className="text-[11px] text-text-muted">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {entry.wordCount} words
                      </span>
                    </div>
                    {formatMetadata(entry) && (
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {formatMetadata(entry)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasRefinement && (
                      <button
                        onClick={() => {
                          setShowingRaw((prev) => {
                            const next = new Set(prev)
                            if (next.has(entry.id)) {
                              next.delete(entry.id)
                            } else {
                              next.add(entry.id)
                            }
                            return next
                          })
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          isShowingRaw
                            ? 'text-amber-500 bg-amber-100'
                            : 'text-stone-300 hover:text-amber-500 hover:bg-amber-50 opacity-30 hover:opacity-100 focus:opacity-100'
                        }`}
                        title={isShowingRaw ? 'Show refined text' : 'Show original transcription'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {isShowingRaw ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          )}
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => copyToClipboard(displayText, entry.id)}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        copiedId === entry.id
                          ? 'text-teal-500 bg-teal-50'
                          : 'text-stone-300 hover:text-accent hover:bg-accent-subtle opacity-30 hover:opacity-100 focus:opacity-100'
                      }`}
                      title={copiedId === entry.id ? 'Copied!' : 'Copy to clipboard'}
                    >
                      {copiedId === entry.id ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
