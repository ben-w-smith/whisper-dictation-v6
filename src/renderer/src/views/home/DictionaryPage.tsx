import React, { useState, useEffect } from 'react'
import type { AppSettings, DictionaryEntry } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

export function DictionaryPage(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [duplicateError, setDuplicateError] = useState(false)

  useEffect(() => {
    const load = async () => {
      const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
      setSettings(loaded)
    }
    load()
    const unsub = window.api.on(IPC.SETTINGS_UPDATED, () => load())
    return () => { unsub() }
  }, [])

  const dictionary = settings.dictionary || []

  const addEntry = async () => {
    if (!newFrom.trim() || !newTo.trim()) return
    const fromTrimmed = newFrom.trim().toLowerCase()
    if (dictionary.some(e => e.from.toLowerCase() === fromTrimmed)) {
      setDuplicateError(true)
      return
    }
    setDuplicateError(false)
    const entry: DictionaryEntry = {
      id: crypto.randomUUID(),
      from: newFrom.trim(),
      to: newTo.trim(),
    }
    const updated = [...dictionary, entry]
    setSettings(prev => ({ ...prev, dictionary: updated }))
    await window.api.invoke(IPC.SET_SETTING, 'dictionary', updated)
    setNewFrom('')
    setNewTo('')
  }

  const removeEntry = async (id: string) => {
    const updated = dictionary.filter(e => e.id !== id)
    setSettings(prev => ({ ...prev, dictionary: updated }))
    await window.api.invoke(IPC.SET_SETTING, 'dictionary', updated)
  }

  return (
    <div className="space-y-[var(--spacing-section)]">
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Custom Dictionary</h3>
        <p className="text-sm text-text-secondary mb-4">
          Add word replacements that are automatically applied to transcriptions. Useful for names, technical terms, or common misrecognitions.
        </p>

        {/* Add new entry */}
        <div className="flex items-end gap-2 mb-6">
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">When you say</label>
            <input
              type="text"
              value={newFrom}
              onChange={(e) => { setNewFrom(e.target.value); setDuplicateError(false) }}
              placeholder="e.g., tablty"
              className="w-full px-3 py-1.5 border border-border-custom rounded-lg text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              onKeyDown={(e) => { if (e.key === 'Enter') addEntry() }}
              aria-label="Word to replace"
            />
          </div>
          <svg className="w-4 h-4 text-text-muted mb-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">Replace with</label>
            <input
              type="text"
              value={newTo}
              onChange={(e) => setNewTo(e.target.value)}
              placeholder="e.g., tabletly"
              className="w-full px-3 py-1.5 border border-border-custom rounded-lg text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              onKeyDown={(e) => { if (e.key === 'Enter') addEntry() }}
              aria-label="Replacement word"
            />
          </div>
          <button
            onClick={addEntry}
            disabled={!newFrom.trim() || !newTo.trim()}
            className="px-4 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        {duplicateError && (
          <p className="text-xs text-danger mb-4">This word already exists in the dictionary.</p>
        )}

        {/* Entries list */}
        {dictionary.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-text-secondary text-sm">No dictionary entries yet</p>
            <p className="text-text-muted text-xs mt-1">Add words above to auto-fix common misrecognitions</p>
          </div>
        ) : (
          <div className="divide-y divide-border-custom">
            {dictionary.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-3 group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm text-text-primary truncate max-w-[200px]" title={entry.from}>{entry.from}</span>
                  <svg className="w-3 h-3 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className="text-sm text-accent font-medium truncate max-w-[200px]" title={entry.to}>{entry.to}</span>
                </div>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors opacity-30 hover:opacity-100 focus:opacity-100"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
