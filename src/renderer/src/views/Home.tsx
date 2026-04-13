import React, { useState } from 'react'
import type { HomePage } from '@shared/types'
import { GeneralPage } from './home/GeneralPage'
import { ModelPage } from './home/ModelPage'
import { AIPage } from './home/AIPage'
import { DictionaryPage } from './home/DictionaryPage'
import { HistoryPage } from './home/HistoryPage'
import { AboutPage } from './home/AboutPage'

const pages: { id: HomePage; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'model', label: 'Model' },
  { id: 'ai', label: 'AI' },
  { id: 'dictionary', label: 'Dictionary' },
  { id: 'history', label: 'History' },
  { id: 'about', label: 'About' },
]

interface HomeProps {
  onClose?: () => void
  initialPage?: HomePage
}

export function Home({ onClose, initialPage = 'general' }: HomeProps): React.ReactElement {
  const [activePage, setActivePage] = useState<HomePage>(initialPage)

  const handleClose = () => {
    onClose?.()
  }

  return (
    <div className="flex h-screen bg-canvas">
      {/* Sidebar */}
      <aside className="w-[200px] bg-surface border-r border-border-custom flex-shrink-0">
        <div className="titlebar-drag pt-8 pb-1">
          <span className="px-4 text-xs font-medium text-text-muted">Whisper Dictation</span>
        </div>
        <nav className="p-2">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => setActivePage(page.id)}
              className={`
                w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
                focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none
                ${activePage === page.id
                  ? 'bg-accent-subtle text-accent'
                  : 'text-text-secondary hover:bg-stone-100'
                }
              `}
            >
              {page.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="titlebar-drag flex items-center justify-end px-5 py-2 border-b border-border-custom bg-surface">
          <button
            onClick={handleClose}
            className="titlebar-no-drag p-1.5 text-text-secondary hover:text-text-primary hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {activePage === 'general' && <GeneralPage />}
          {activePage === 'model' && <ModelPage />}
          {activePage === 'ai' && <AIPage />}
          {activePage === 'dictionary' && <DictionaryPage />}
          {activePage === 'history' && <HistoryPage />}
          {activePage === 'about' && <AboutPage />}
        </div>
      </main>
    </div>
  )
}
