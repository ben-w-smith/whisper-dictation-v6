import React, { useState } from 'react'
import type { HomePage } from '@shared/types'
import { GeneralPage } from './home/GeneralPage'
import { TranscriptionPage } from './home/TranscriptionPage'
import { DictionaryPage } from './home/DictionaryPage'
import { HistoryPage } from './home/HistoryPage'

const pages: { id: HomePage; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'transcription', label: 'Transcription' },
  { id: 'dictionary', label: 'Dictionary' },
  { id: 'history', label: 'History' },
]

interface HomeProps {
  onClose?: () => void
  initialPage?: HomePage
}

export function Home({ onClose, initialPage = 'general' }: HomeProps): React.ReactElement {
  const [activePage, setActivePage] = useState<HomePage>(initialPage)
  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="flex h-screen bg-canvas">
      {/* Sidebar */}
      <aside className="w-[180px] bg-surface border-r border-border-custom flex flex-col flex-shrink-0">
        <div className="titlebar-drag pt-8 pb-1 px-4">
          <span className="text-xs font-medium text-text-muted">Whisper Dictation</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => setActivePage(page.id)}
              className={`
                w-full text-left pl-3 pr-2 py-1.5 rounded-md text-[13px] font-medium transition-colors
                relative
                focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none
                ${activePage === page.id
                  ? 'text-selection-text'
                  : 'text-text-secondary hover:text-text-primary hover:bg-canvas'
                }
              `}
            >
              {activePage === page.id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-accent rounded-full" />
              )}
              {page.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border-custom">
          <button
            onClick={() => setShowAbout(true)}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            About
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activePage === 'general' && <GeneralPage />}
          {activePage === 'transcription' && <TranscriptionPage />}
          {activePage === 'dictionary' && <DictionaryPage />}
          {activePage === 'history' && <HistoryPage />}
        </div>
      </main>

      {/* About modal */}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  )
}

function AboutModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const [version, setVersion] = useState('')

  React.useEffect(() => {
    window.api.invoke('app:version').then((v) => {
      setVersion(v as string)
    }).catch(() => {
      setVersion('unknown')
    })
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-xl border border-border-custom p-8 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Whisper Dictation</h1>
          <p className="text-text-secondary mt-1 text-sm">Version {version}</p>
          <p className="text-text-muted text-xs mt-3">
            macOS voice dictation powered by local whisper.cpp
          </p>
        </div>

        <div className="border-t border-border-custom mt-6 pt-4 space-y-2">
          <a
            href="https://github.com/bensmith/whisper-dictation"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-canvas transition-colors group"
          >
            <svg className="w-4 h-4 text-text-muted group-hover:text-text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-text-primary group-hover:text-accent">GitHub Repository</span>
            <svg className="w-3.5 h-3.5 text-text-muted ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <div className="flex items-center gap-3 p-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-text-secondary">MIT License</span>
          </div>
        </div>

        <div className="border-t border-border-custom mt-4 pt-4">
          <p className="text-xs text-text-muted text-center">
            Built with Electron, React, and XState.
            <br />
            Powered by <span className="font-mono bg-canvas px-1 py-0.5 rounded text-[11px]">whisper.cpp</span>.
            All transcription happens locally.
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-canvas rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
