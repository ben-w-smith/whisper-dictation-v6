# Settings Window UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the settings window's visual system with a warm-neutral, Wispr Flow-inspired palette and consistent component patterns.

**Architecture:** Update the design token layer first, then propagate the new palette and layout patterns through the sidebar shell and each settings page. No logic changes — purely CSS/JSX markup updates.

**Tech Stack:** React 19, Tailwind CSS 4 (`@theme` + `@utility` directives), TypeScript 5

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `src/renderer/src/styles/tokens.css` | Design token palette | Modify: 8 token values |
| `src/renderer/src/views/Home.tsx` | Settings window shell (sidebar + content frame) | Modify: sidebar width, nav states, header |
| `src/renderer/src/components/ToggleSwitch.tsx` | Toggle switch component | Modify: unchecked bg color |
| `src/renderer/src/components/ShortcutRecorder.tsx` | Keyboard shortcut capture | Modify: key badge colors |
| `src/renderer/src/views/home/GeneralPage.tsx` | Audio, output, shortcuts settings | Modify: sections, toggles, alerts, heading styles |
| `src/renderer/src/views/home/ModelPage.tsx` | Whisper model selection | Modify: heading style |
| `src/renderer/src/views/home/AIPage.tsx` | AI refinement settings | Modify: tabs, cards, inputs, buttons, headings |
| `src/renderer/src/views/home/DictionaryPage.tsx` | Custom dictionary | Modify: heading style |
| `src/renderer/src/views/home/HistoryPage.tsx` | Transcription history | Modify: alerts, inputs, hardcoded colors |
| `src/renderer/src/views/home/AboutPage.tsx` | App info | Modify: spacing, bg references |

---

### Task 1: Update Design Tokens

**Files:**
- Modify: `src/renderer/src/styles/tokens.css`

This is the foundation — all subsequent tasks depend on these token values being correct.

- [ ] **Step 1: Update surface colors**

In `tokens.css`, change the `canvas` color inside `@theme`:

```
Old: --color-canvas: #fafaf9;
New: --color-canvas: #f5f2ef;
```

- [ ] **Step 2: Update border colors**

```
Old: --color-border-custom: #e7e5e4;
New: --color-border-custom: #e0dbd5;

Old: --color-border-hover: #d6d3d1;
New: --color-border-hover: #d1cbc3;
```

- [ ] **Step 3: Update accent-subtle**

```
Old: --color-accent-subtle: #f0fdfa;
New: --color-accent-subtle: #e8f5f2;
```

- [ ] **Step 4: Update text colors**

```
Old: --color-text-secondary: #78716c;
New: --color-text-secondary: #6b6560;

Old: --color-text-muted: #a8a29e;
New: --color-text-muted: #9c9590;
```

- [ ] **Step 5: Update info color**

```
Old: --color-info: #3b82f6;
New: --color-info: #0d9488;
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/styles/tokens.css
git commit -m "style: update design tokens for warm-neutral palette"
```

---

### Task 2: Redesign Sidebar Navigation

**Files:**
- Modify: `src/renderer/src/views/Home.tsx`

- [ ] **Step 1: Reduce sidebar width from 200px to 180px**

In `Home.tsx` line 34, change the sidebar aside width:

```
Old: <aside className="w-[200px] bg-surface border-r border-border-custom flex-shrink-0">
New: <aside className="w-[180px] bg-surface border-r border-border-custom flex-shrink-0">
```

- [ ] **Step 2: Add separator between app label and nav**

After the "Whisper Dictation" label div (line 37), add a border-b to create a visual separator. Change the label container:

```
Old: <div className="titlebar-drag pt-8 pb-1">
New: <div className="titlebar-drag pt-8 pb-2 border-b border-border-custom">
```

- [ ] **Step 3: Update nav button states**

Replace the nav button className (lines 43-49) with warm neutral active state instead of teal:

```
Old: ${activePage === page.id
  ? 'bg-accent-subtle text-accent'
  : 'text-text-secondary hover:bg-stone-100'
}

New: ${activePage === page.id
  ? 'bg-[#ebe6df] text-text-primary'
  : 'text-text-secondary hover:bg-[#f5f2ef]'
}
```

- [ ] **Step 4: Update nav button padding**

```
Old: w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
New: w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
```

- [ ] **Step 5: Update close button in header**

Line 63, update the close button hover style:

```
Old: className="titlebar-no-drag p-1.5 text-text-secondary hover:text-text-primary hover:bg-stone-100 rounded-lg transition-colors"
New: className="titlebar-no-drag p-1.5 text-text-secondary hover:text-text-primary hover:bg-[#ebe6df] rounded-lg transition-colors"
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/views/Home.tsx
git commit -m "style: redesign sidebar with warm neutral active states"
```

---

### Task 3: Update ToggleSwitch Unchecked Color

**Files:**
- Modify: `src/renderer/src/components/ToggleSwitch.tsx`

- [ ] **Step 1: Replace hardcoded stone-200 with warm token**

Line 25, the unchecked background:

```
Old: ${checked ? 'bg-accent' : 'bg-stone-200'}
New: ${checked ? 'bg-accent' : 'bg-[#d6d1ca]'}
```

The warm gray `#d6d1ca` replaces the cool Tailwind stone-200, matching the warm neutral palette.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/ToggleSwitch.tsx
git commit -m "style: update toggle unchecked color to warm neutral"
```

---

### Task 4: Update ShortcutRecorder Key Badge Colors

**Files:**
- Modify: `src/renderer/src/components/ShortcutRecorder.tsx`

- [ ] **Step 1: Update recording active state border color**

Line 142, change the recording state from teal accent to warm tan:

```
Old: 'border-accent bg-accent-subtle text-accent-hover animate-pulse'
New: 'border-[#c4bdb4] bg-[#ebe6df] text-text-primary animate-pulse'
```

- [ ] **Step 2: Update idle state border**

Line 143, change from hardcoded stone-300 to warm token:

```
Old: 'border-stone-300 bg-surface text-text-primary hover:border-border-hover'
New: 'border-border-custom bg-surface text-text-primary hover:border-border-hover'
```

- [ ] **Step 3: Update clear button hover**

Line 157:

```
Old: className="p-2 text-text-muted hover:text-text-primary hover:bg-canvas rounded-lg transition-colors"
New: className="p-2 text-text-muted hover:text-text-primary hover:bg-[#ebe6df] rounded-lg transition-colors"
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ShortcutRecorder.tsx
git commit -m "style: update shortcut recorder to warm neutral colors"
```

---

### Task 5: Redesign GeneralPage

**Files:**
- Modify: `src/renderer/src/views/home/GeneralPage.tsx`

- [ ] **Step 1: Update Audio Input section heading**

Line 85, change to uppercase tracking style:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-4">Audio Input</h3>
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3">Audio Input</h3>
```

- [ ] **Step 2: Update denied permission alert banner**

Lines 88-103, replace hardcoded red-50 with token-based danger styles:

```
Old: <div className="flex items-start gap-3 p-3 mb-3 bg-red-50 border border-red-200 rounded-lg">

New: <div className="flex items-start gap-3 p-3 mb-3 bg-danger-subtle border border-danger/20 rounded-lg">
```

Update the icon color (line 89):

```
Old: <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
New: <svg className="w-5 h-5 text-danger shrink-0 mt-0.5"
```

Update title color (line 93):

```
Old: <div className="text-sm font-medium text-red-700">Microphone access denied</div>
New: <div className="text-sm font-medium text-danger">Microphone access denied</div>
```

Update description color (line 94):

```
Old: <div className="text-xs text-red-600 mt-0.5">Enable access in System Settings to use dictation.</div>
New: <div className="text-xs text-danger/80 mt-0.5">Enable access in System Settings to use dictation.</div>
```

Update button colors (lines 96-99):

```
Old: onClick={() => window.api.invoke(IPC.OPEN_SYSTEM_SETTINGS, 'microphone')}
    className="mt-1.5 text-xs font-medium text-red-600 hover:text-red-700 underline underline-offset-2"

New: onClick={() => window.api.invoke(IPC.OPEN_SYSTEM_SETTINGS, 'microphone')}
    className="mt-1.5 text-xs font-medium text-danger hover:text-danger/80 underline underline-offset-2"
```

- [ ] **Step 3: Update prompt permission alert banner**

Lines 104-120, replace hardcoded amber with warning tokens:

```
Old: <div className="flex items-start gap-3 p-3 mb-3 bg-amber-50 border border-amber-200 rounded-lg">

New: <div className="flex items-start gap-3 p-3 mb-3 bg-warning-subtle border border-warning/20 rounded-lg">
```

Icon color (line 106):

```
Old: <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
New: <svg className="w-5 h-5 text-warning shrink-0 mt-0.5"
```

Title color (line 110):

```
Old: <div className="text-sm font-medium text-amber-700">Microphone permission required</div>
New: <div className="text-sm font-medium text-warning">Microphone permission required</div>
```

Description (line 111):

```
Old: <div className="text-xs text-amber-600 mt-0.5">Grant access so the app can record your voice.</div>
New: <div className="text-xs text-warning/80 mt-0.5">Grant access so the app can record your voice.</div>
```

Button (lines 113-115):

```
Old: onClick={requestMicPermission}
    className="mt-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2"

New: onClick={requestMicPermission}
    className="mt-1.5 text-xs font-medium text-warning hover:text-warning/80 underline underline-offset-2"
```

- [ ] **Step 4: Update Output section heading**

Line 167:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-4">Output</h3>
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3">Output</h3>
```

- [ ] **Step 5: Remove individual border-b from toggle rows**

Remove `border-b border-border-custom last:border-b-0` from all four toggle row divs (lines 169, 179, 189, 199). Each toggle row div changes from:

```
Old: <div className="flex items-center justify-between py-2 border-b border-border-custom last:border-b-0">
New: <div className="flex items-center justify-between py-3">
```

Apply this change to all four toggle rows (Copy to clipboard, Auto-paste, Play sounds, Show overlay).

- [ ] **Step 6: Update Shortcuts section heading**

Line 213:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-4">Shortcuts</h3>
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3">Shortcuts</h3>
```

- [ ] **Step 7: Update remove shortcut button hover**

Line 243:

```
Old: className="p-2 text-text-muted hover:text-text-primary hover:bg-canvas rounded-lg transition-colors"
New: className="p-2 text-text-muted hover:text-text-primary hover:bg-[#ebe6df] rounded-lg transition-colors"
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/views/home/GeneralPage.tsx
git commit -m "style: redesign GeneralPage with token-based alerts and clean toggle rows"
```

---

### Task 6: Redesign ModelPage

**Files:**
- Modify: `src/renderer/src/views/home/ModelPage.tsx`

- [ ] **Step 1: Update section heading**

Line 67:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-4">Local Model</h3>
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3">Local Model</h3>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/views/home/ModelPage.tsx
git commit -m "style: update ModelPage heading to editorial style"
```

---

### Task 7: Redesign AIPage

**Files:**
- Modify: `src/renderer/src/views/home/AIPage.tsx`

- [ ] **Step 1: Update section heading for "Hugging Face Token"**

Line 217:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary">
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide">
```

- [ ] **Step 2: Update section heading for "Recommended Models"**

Line 257:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-4">
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3">
```

- [ ] **Step 3: Update tab selector active state**

Lines 192-196, change from teal to warm neutral active state:

```
Old: source === 'downloaded'
  ? 'border-accent text-accent'
  : 'border-transparent text-text-secondary hover:text-text-primary'

New: source === 'downloaded'
  ? 'border-text-primary text-text-primary'
  : 'border-transparent text-text-secondary hover:text-text-primary'
```

Apply the same change to the "Manual Path" tab (lines 200-205):

```
Old: source === 'manual'
  ? 'border-accent text-accent'
  : 'border-transparent text-text-secondary hover:text-text-primary'

New: source === 'manual'
  ? 'border-text-primary text-text-primary'
  : 'border-transparent text-text-secondary hover:text-text-primary'
```

- [ ] **Step 4: Update "Search Hugging Face" section heading**

Line 329:

```
Old: className="flex items-center gap-2 text-[15px] font-semibold text-text-primary hover:text-text-primary transition-colors w-full"
New: className="flex items-center gap-2 text-[14px] font-semibold text-text-primary uppercase tracking-wide hover:text-text-primary transition-colors w-full"
```

- [ ] **Step 5: Update "Intensity" section heading**

Line 449:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-4">
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3">
```

- [ ] **Step 6: Update "Model File (GGUF)" heading**

Line 422:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-2">
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-2">
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/views/home/AIPage.tsx
git commit -m "style: redesign AIPage headings and tab selectors"
```

---

### Task 8: Redesign DictionaryPage

**Files:**
- Modify: `src/renderer/src/views/home/DictionaryPage.tsx`

- [ ] **Step 1: Update section heading**

Line 46:

```
Old: <h3 className="text-[15px] font-semibold text-text-primary mb-4">Custom Dictionary</h3>
New: <h3 className="text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3">Custom Dictionary</h3>
```

- [ ] **Step 2: Update remove button hover colors**

Line 108, replace hardcoded red-50 with token-based danger style:

```
Old: className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-30 hover:opacity-100 focus:opacity-100"
New: className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors opacity-30 hover:opacity-100 focus:opacity-100"
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/home/DictionaryPage.tsx
git commit -m "style: update DictionaryPage heading and danger hover tokens"
```

---

### Task 9: Redesign HistoryPage

**Files:**
- Modify: `src/renderer/src/views/home/HistoryPage.tsx`

- [ ] **Step 1: Update clear all button colors**

Line 158, replace hardcoded stone-400/red-50 with tokens:

```
Old: className="px-3 py-2 text-xs font-medium text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
New: className="px-3 py-2 text-xs font-medium text-text-muted hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors"
```

- [ ] **Step 2: Update clear confirmation banner**

Lines 166-167, replace hardcoded red colors with danger tokens:

```
Old: <div className="p-4 rounded-xl border border-red-200 bg-red-50">
New: <div className="p-4 rounded-xl border border-danger/20 bg-danger-subtle">
```

Line 171, confirm button:

```
Old: className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
New: className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-danger/90 rounded-lg transition-colors"
```

Line 176, cancel button:

```
Old: className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-canvas rounded-lg transition-colors"
New: className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-[#ebe6df] rounded-lg transition-colors"
```

- [ ] **Step 3: Update "showing raw" background**

Line 221, replace amber-50 with warning token:

```
Old: isShowingRaw ? 'bg-amber-50/30 -mx-0 px-0' : ''
New: isShowingRaw ? 'bg-warning-subtle/50 -mx-0 px-0' : ''
```

- [ ] **Step 4: Update raw/original toggle button colors**

Lines 269-273, replace hardcoded amber with warning tokens:

```
Old: isShowingRaw
  ? 'text-amber-500 bg-amber-100'
  : 'text-stone-300 hover:text-amber-500 hover:bg-amber-50 opacity-30 hover:opacity-100 focus:opacity-100'

New: isShowingRaw
  ? 'text-warning bg-warning-subtle'
  : 'text-text-muted hover:text-warning hover:bg-warning-subtle opacity-30 hover:opacity-100 focus:opacity-100'
```

- [ ] **Step 5: Update copy button colors**

Lines 288-290, replace hardcoded teal with accent tokens:

```
Old: copiedId === entry.id
  ? 'text-teal-500 bg-teal-50'
  : 'text-stone-300 hover:text-accent hover:bg-accent-subtle opacity-30 hover:opacity-100 focus:opacity-100'

New: copiedId === entry.id
  ? 'text-accent bg-accent-subtle'
  : 'text-text-muted hover:text-accent hover:bg-accent-subtle opacity-30 hover:opacity-100 focus:opacity-100'
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/views/home/HistoryPage.tsx
git commit -m "style: replace hardcoded colors with design tokens in HistoryPage"
```

---

### Task 10: Update AboutPage

**Files:**
- Modify: `src/renderer/src/views/home/AboutPage.tsx`

- [ ] **Step 1: Update link hover background**

Line 36:

```
Old: className="flex items-center gap-3 p-3 rounded-xl border border-border-custom bg-surface hover:border-border-hover hover:bg-canvas transition-colors group"
New: className="flex items-center gap-3 p-3 rounded-xl border border-border-custom bg-surface hover:border-border-hover hover:bg-[#f5f2ef] transition-colors group"
```

- [ ] **Step 2: Update credits bg-stone-100**

Line 59:

```
Old: <p>Powered by <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">whisper.cpp</span> by Georgi Gerganov</p>
New: <p>Powered by <span className="font-mono text-xs bg-canvas px-1.5 py-0.5 rounded">whisper.cpp</span> by Georgi Gerganov</p>
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/home/AboutPage.tsx
git commit -m "style: update AboutPage to use design tokens"
```

---

## Verification

After completing all tasks, run the app and verify:

- [ ] `pnpm dev` launches without errors
- [ ] Settings window sidebar shows warm tan active state on selected page
- [ ] Canvas background is warm bone white (not cool gray)
- [ ] Alert banners (deny mic access to test) show token-based danger/warning colors
- [ ] Toggle rows have no individual borders, clean spacing
- [ ] Tab selectors in AI page use warm neutral active underline
- [ ] Model cards still show teal selection border (CTA appropriate)
- [ ] All section headings are uppercase tracking-wide at 14px
- [ ] No hardcoded Tailwind colors remain (red-50, amber-50, stone-300, stone-400, teal-50, etc.)
- [ ] History page clear confirm uses danger tokens
