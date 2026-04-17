import React, { useState, useEffect, useCallback } from 'react'
import type { HomePage, AppSettings } from '@shared/types'
import { GeneralPage } from './home/GeneralPage'
import { AppearancePage } from './home/AppearancePage'
import { ModelPage } from './home/ModelPage'
import { AIPage } from './home/AIPage'
import { DictionaryPage } from './home/DictionaryPage'
import { HistoryPage } from './home/HistoryPage'
import { AboutPage } from './home/AboutPage'
import { IPC } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/constants'

const pages: { id: HomePage; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
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
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    window.api.invoke(IPC.GET_SETTINGS).then((s) => {
      if (s) setSettings(s as AppSettings)
    }).catch(() => {})
    const unsub = window.api.on(IPC.SETTINGS_UPDATED, () => {
      window.api.invoke(IPC.GET_SETTINGS).then((s) => {
        if (s) setSettings(s as AppSettings)
      }).catch(() => {})
    })
    return unsub
  }, [])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    window.api.invoke(IPC.SET_SETTING, key, value).catch(() => {})
  }, [settings])

  const handleClose = () => {
    onClose?.()
  }

  return (
    <div className="flex h-screen rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/[0.10]">
      {/* Sidebar */}
      <aside className="w-[180px] bg-canvas border-r border-border-custom flex-shrink-0">
        <div className="titlebar-drag h-[52px]">
        </div>
        <nav className="p-2">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => setActivePage(page.id)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors
                focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none
                ${activePage === page.id
                  ? 'bg-surface-hover text-text-primary border-l-2 border-accent'
                  : 'text-text-secondary hover:bg-canvas border-l-2 border-transparent'
                }
              `}
            >
              {page.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-surface">
        <header className="titlebar-drag relative flex items-center justify-center px-5 py-2 border-b border-border-custom bg-surface">
          <span className="text-xs text-text-muted font-medium">Whisper Dictation</span>
          <button
            onClick={handleClose}
            className="titlebar-no-drag absolute right-5 p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-[640px]">
          {activePage === 'general' && <GeneralPage />}
          {activePage === 'appearance' && <AppearancePage settings={settings} updateSetting={updateSetting} />}
          {activePage === 'model' && <ModelPage />}
          {activePage === 'ai' && <AIPage />}
          {activePage === 'dictionary' && <DictionaryPage />}
          {activePage === 'history' && <HistoryPage />}
          {activePage === 'about' && <AboutPage />}
          </div>
        </div>
      </main>
    </div>
  )
}
