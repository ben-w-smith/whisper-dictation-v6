import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Synchronous theme bootstrap — prevents flash of wrong theme on app open.
// Reads cached appearance from localStorage and sets data attributes before
// React mounts so the first paint already uses the correct theme.
try {
  const cached = JSON.parse(localStorage.getItem('wd-appearance') || 'null')
  if (cached) {
    document.documentElement.dataset.theme = cached.theme ?? 'warm'
    document.documentElement.dataset.accent = cached.accent ?? 'teal'
    document.documentElement.dataset.ambient = cached.ambient ?? 'none'
    document.documentElement.style.setProperty('--radius-scale', String(cached.radiusScale ?? 1))
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
