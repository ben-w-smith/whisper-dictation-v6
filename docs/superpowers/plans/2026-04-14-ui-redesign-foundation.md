# Settings UI Redesign — Foundation (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the design token system, update shared types, and rebuild the settings window layout shell (sidebar + content area + About modal).

**Architecture:** Update Tailwind v4 `@theme` tokens with a warm, Wispr Flow-inspired palette. Add new `selection`/`selection-text` tokens for active states. Rebuild `Home.tsx` with a refined sidebar (flat nav, 2px left-edge active indicator, footer About link) and remove the redundant close-button header. Convert `AboutPage` to a lightweight modal. Update `HomePage` type to merge Model+AI into Transcription.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4 (`@theme` + `@utility` directives), Electron 41+

**Design spec:** `docs/superpowers/specs/2026-04-14-settings-ui-redesign-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/renderer/src/styles/tokens.css` | Modify | Design token palette + custom utilities |
| `src/shared/types.ts` | Modify | Update `HomePage` union type |
| `src/renderer/src/views/Home.tsx` | Modify | Sidebar layout, nav, content area, About modal |
| `src/renderer/src/views/home/AboutPage.tsx` | Delete | Replaced by inline modal in Home.tsx |

---

### Task 1: Update design tokens

**Files:**
- Modify: `src/renderer/src/styles/tokens.css`

- [ ] **Step 1: Replace the full `tokens.css` file**

This is a complete rewrite of the token file. The new palette uses warm bone-white canvas, tan-tinted borders, new selection tokens, and warmer semantic state tints.

```css
@import "tailwindcss";

@theme {
  /* Design tokens as CSS custom properties */

  /* Surfaces */
  --color-canvas: #f7f5f2;
  --color-surface: #ffffff;
  --color-overlay: rgba(15, 15, 18, 0.85);

  /* Text */
  --color-text-primary: #292524;
  --color-text-secondary: #78716c;
  --color-text-muted: #a8a29e;

  /* Accent */
  --color-accent: #0d9488;
  --color-accent-hover: #0f766e;
  --color-accent-subtle: #eef8f5;

  /* Selection & active states */
  --color-selection: #f0ece6;
  --color-selection-text: #44403c;

  /* Borders & dividers */
  --color-border-custom: #e8e5e1;
  --color-border-hover: #d5d0ca;

  /* Semantic state colors */
  --color-success: #16a34a;
  --color-success-subtle: #eef7f0;
  --color-warning: #d97706;
  --color-warning-subtle: #faf5eb;
  --color-danger: #dc2626;
  --color-danger-subtle: #faf0f0;
  --color-info: #3b82f6;
  --color-info-subtle: #eff6ff;

  /* Pipeline state colors (legacy names kept for overlay compatibility) */
  --color-recording: #ef4444;
  --color-transcribing: #3b82f6;
  --color-complete: #22c55e;
  --color-error: #f97316;

  /* Focus */
  --color-focus-ring: rgba(13, 148, 136, 0.3);

  /* Spacing */
  --spacing-section: 24px;
}

/* Tailwind utility extensions */
@utility text-primary {
  color: var(--color-text-primary);
}

@utility text-secondary {
  color: var(--color-text-secondary);
}

@utility text-muted {
  color: var(--color-text-muted);
}

@utility bg-canvas {
  background-color: var(--color-canvas);
}

@utility bg-surface {
  background-color: var(--color-surface);
}

@utility bg-overlay {
  background-color: var(--color-overlay);
}

@utility bg-accent-subtle {
  background-color: var(--color-accent-subtle);
}

@utility border-border-custom {
  border-color: var(--color-border-custom);
}

@utility border-border-hover {
  border-color: var(--color-border-hover);
}

@utility text-success {
  color: var(--color-success);
}

@utility text-warning {
  color: var(--color-warning);
}

@utility text-danger {
  color: var(--color-danger);
}

@utility text-info {
  color: var(--color-info);
}

@utility bg-success-subtle {
  background-color: var(--color-success-subtle);
}

@utility bg-warning-subtle {
  background-color: var(--color-warning-subtle);
}

@utility bg-danger-subtle {
  background-color: var(--color-danger-subtle);
}

@utility bg-info-subtle {
  background-color: var(--color-info-subtle);
}

@utility bg-border-custom {
  background-color: var(--color-border-custom);
}

/* Selection & active state utilities */
@utility bg-selection {
  background-color: var(--color-selection);
}

@utility text-selection-text {
  color: var(--color-selection-text);
}

@utility border-selection {
  border-color: var(--color-selection);
}

@utility ring-focus {
  --tw-ring-color: var(--color-focus-ring);
}

@utility focus-ring {
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }
}

/* Title bar drag region utilities (macOS hidden title bar) */
@utility titlebar-drag {
  -webkit-app-region: drag;
  -webkit-user-select: none;
  user-select: none;
}

@utility titlebar-no-drag {
  -webkit-app-region: no-drag;
}

/* Global styles */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Utility classes for text clamping */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `cd /Users/bensmith/personal/whisper-dictation-v6/.claude/worktrees/ui-refactor && pnpm build`
Expected: Build completes with no errors. (Color token changes are backwards-compatible — old classes still resolve.)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/styles/tokens.css
git commit -m "feat: redesign color tokens — warm bone-white canvas, tan selection, warmer borders"
```

---

### Task 2: Update shared types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Update the `HomePage` type**

In `src/shared/types.ts`, find line 123:

```typescript
export type HomePage = 'general' | 'model' | 'ai' | 'dictionary' | 'history' | 'about'
```

Replace with:

```typescript
export type HomePage = 'general' | 'transcription' | 'dictionary' | 'history'
```

This merges `model` and `ai` into `transcription` and removes `about` (it becomes a modal).

- [ ] **Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Build will fail because `Home.tsx` and other files reference `'model'`, `'ai'`, `'about'` pages and import `ModelPage`/`AIPage`/`AboutPage`. That's expected — we fix those in the next task.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: merge model+ai into transcription page type, remove about page type"
```

---

### Task 3: Rebuild Home.tsx layout

**Files:**
- Modify: `src/renderer/src/views/Home.tsx`

- [ ] **Step 1: Replace `Home.tsx` with new layout**

This replaces the entire file. Key changes:
- Sidebar narrows from 200px to 180px, uses flat nav with left-edge active indicator
- About is a footer link that opens a modal
- Close button header bar removed
- Content padding increased
- `ModelPage` and `AIPage` imports replaced with `TranscriptionPage`
- `AboutPage` import removed, modal rendered inline

```tsx
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
```

- [ ] **Step 2: Delete the old AboutPage file**

```bash
rm src/renderer/src/views/home/AboutPage.tsx
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Build will still fail because `TranscriptionPage` doesn't exist yet and `GeneralPage`/`DictionaryPage`/`HistoryPage` still import old types. We'll fix these in Plan 2. The important thing is that `tokens.css`, `types.ts`, and `Home.tsx` are syntactically valid on their own.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/views/Home.tsx src/renderer/src/views/home/AboutPage.tsx
git commit -m "feat: rebuild Home layout — refined sidebar, footer About modal, merged nav"
```

---

### Task 4: Create TranscriptionPage stub

We need a placeholder `TranscriptionPage` so the build passes while we work on Plan 2. This task just creates a minimal stub — the full implementation comes in Plan 2.

**Files:**
- Create: `src/renderer/src/views/home/TranscriptionPage.tsx`

- [ ] **Step 1: Create the stub**

```tsx
import React from 'react'

export function TranscriptionPage(): React.ReactElement {
  return (
    <div className="space-y-8">
      <p className="text-text-secondary text-sm">Transcription settings coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Build succeeds. All existing pages still compile with the new tokens (they reference token-based utility classes that still exist). The type change from `'model' | 'ai'` to `'transcription'` is handled by the Home.tsx rewrite.

Note: Some pages may have visual regressions (old hardcoded colors like `bg-red-50` will still work — they're Tailwind built-ins, not tokens — but won't match the new palette). Fixing these is Plan 2's job.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/home/TranscriptionPage.tsx
git commit -m "feat: add TranscriptionPage stub for build compatibility"
```

---

## Self-Review

**Spec coverage:**
- Section 1 (Navigation): Tasks 3 covers sidebar, footer About, header removal, content padding
- Section 2 (Color tokens): Task 1 covers all palette changes
- Section 5 (Files to modify): tokens.css (Task 1), types.ts (Task 2), Home.tsx (Task 3), AboutPage delete (Task 3), TranscriptionPage create (Task 4)
- Sections 3-4 (Component patterns + page redesigns): Defer to Plan 2

**Placeholder scan:** No TBDs, TODOs, or "implement later". All code is complete.

**Type consistency:** `HomePage` type updated to `'general' | 'transcription' | 'dictionary' | 'history'` — matches usage in `Home.tsx` pages array and conditionals.
