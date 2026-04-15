import React, { useState, useEffect } from 'react'

export function AboutPage(): React.ReactElement {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.invoke('app:version').then((v) => {
      setVersion(v as string)
    }).catch(() => {
      setVersion('unknown')
    })
  }, [])

  return (
    <div className="space-y-[var(--spacing-section)]">
      <div className="py-2">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center shadow-md">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Whisper Dictation</h1>
            <p className="text-text-secondary text-sm">Version {version}</p>
          </div>
        </div>
        <p className="text-sm text-text-muted">
          macOS voice dictation powered by local whisper.cpp
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Links</h3>
        <div className="space-y-2">
          <a
            href="https://github.com/bensmith/whisper-dictation"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-border-custom bg-surface hover:border-border-hover hover:bg-canvas transition-colors group"
          >
            <svg className="w-5 h-5 text-text-muted group-hover:text-text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span className="text-text-primary group-hover:text-accent">GitHub Repository</span>
            <svg className="w-4 h-4 text-text-muted ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border-custom bg-surface">
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-text-primary">MIT License</span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Credits</h3>
        <div className="text-sm text-text-secondary space-y-2">
          <p>Built with Electron, React, and XState</p>
          <p>Powered by <span className="font-mono text-xs bg-canvas px-1.5 py-0.5 rounded">whisper.cpp</span> by Georgi Gerganov</p>
          <p className="text-text-muted mt-4">
            Whisper Dictation respects your privacy. All transcription happens locally on your Mac when using local models.
          </p>
        </div>
      </section>
    </div>
  )
}
