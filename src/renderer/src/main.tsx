import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Synchronous theme bootstrap — prevents flash of wrong theme on app open.
// Always sets data attributes (defaults or cached) before React mounts so the
// first paint already uses the correct theme.
try {
  const cached = JSON.parse(localStorage.getItem('wd-appearance') || 'null') || {}
  const root = document.documentElement
  root.dataset.theme = cached.theme ?? 'warm'
  root.dataset.accent = cached.accent ?? 'teal'
  root.dataset.ambient = cached.ambient ?? 'none'
  root.style.setProperty('--radius-scale', String(cached.radiusScale ?? 1))
} catch {
  const root = document.documentElement
  root.dataset.theme = 'warm'
  root.dataset.accent = 'teal'
  root.dataset.ambient = 'none'
  root.style.setProperty('--radius-scale', '1')
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
