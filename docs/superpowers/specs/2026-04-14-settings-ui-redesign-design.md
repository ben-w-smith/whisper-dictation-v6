# Settings Window UI Redesign

**Date:** 2026-04-14
**Scope:** Settings/Home window (900x600, sidebar navigation, 6 page views)
**Approach:** Visual System Overhaul — new tokens + consistent component patterns + layout refinement
**Design inspiration:** Wispr Flow (soft neutrals, warm tones, editorial restraint, teal accent)

## Problem

The settings window accumulated visual inconsistencies during rapid prototyping: mixed border styles, varying padding, hardcoded color values, weak visual hierarchy, and no shared component patterns. The result feels disjointed rather than polished.

## Design Direction

- **Warm neutrals** — bone white backgrounds, warm gray borders, tan/sand selected states
- **Teal for purpose** — saturated teal for CTAs and active model selection, pastel teal for informational highlights
- **Red for urgency** — destructive and time-sensitive actions only
- **Editorial restraint** — uppercase tracking on section headings, consistent whitespace rhythm, minimal chrome

---

## 1. Color Tokens

### Surfaces

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `canvas` | `#fafaf9` | Warm bone white | `#f5f2ef` |
| `surface` | `#ffffff` | Pure white (unchanged) | `#ffffff` |
| `overlay` | `rgba(15,15,18,0.85)` | Unchanged | — |

### Borders

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `border-custom` | `#e7e5e4` | Warm off-gray | `#e0dbd5` |
| `border-hover` | `#d6d3d1` | Warm hover gray | `#d1cbc3` |

### Accent / Selection

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `accent` | `#0d9488` | Saturated teal (unchanged) | `#0d9488` |
| `accent-hover` | `#0f766e` | Unchanged | `#0f766e` |
| `accent-subtle` | `#f0fdfa` | Softer pastel teal | `#e8f5f2` |

### Text

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `text-primary` | `#1c1917` | Warm near-black (unchanged) | `#1c1917` |
| `text-secondary` | `#78716c` | Warmer mid-gray | `#6b6560` |
| `text-muted` | `#a8a29e` | Warmer light gray | `#9c9590` |

### Semantic states

| Token | Current | New | Notes |
|-------|---------|-----|-------|
| `success` | `#16a34a` | Unchanged | — |
| `warning` | `#d97706` | Unchanged | — |
| `danger` | `#dc2626` | Unchanged | — |
| `info` | `#3b82f6` | **Teal `#0d9488`** | Aligns with brand; stops competing |

### New utility colors (not in tokens, used inline)

| Purpose | Value | Usage |
|---------|-------|-------|
| Nav active bg | `#ebe6df` | Warm tan for selected sidebar items |
| Nav hover bg | `#f5f2ef` | Same as canvas, for sidebar hover |
| Tab active border | `text-primary` color | Tab underline uses primary text color |

---

## 2. Sidebar & Navigation

**File:** `Home.tsx`

- Width: `200px` → `180px`
- Background: `surface` (#ffffff) with `border-r border-border-custom`
- Separator between "Whisper Dictation" label and nav items (subtle divider)
- Nav items: `px-3 py-2.5 rounded-lg`, transition-colors

**Nav states:**
- Active: `bg-[#ebe6df] text-text-primary` (warm tan, no teal)
- Inactive: `text-text-secondary`
- Hover: `bg-[#f5f2ef] text-text-primary` (bone white)
- Focus-visible: `ring-2 ring-accent/30`

**Header bar** (content area top):
- `surface` background, `border-b border-border-custom`
- Close button: ghost style (`text-text-secondary hover:text-text-primary`)

---

## 3. Page Layout Patterns

### Page structure
- Content on `canvas` background
- Sections are `surface` cards: `border border-border-custom rounded-xl`
- Sections separated by `space-y-6` (24px)
- Internal section padding: `p-4` (16px)

### Section headings
```
text-[14px] font-semibold text-text-primary uppercase tracking-wide mb-3
```
Editorial feel — uppercase tracking differentiates from body text.

### Toggle rows
- `flex items-center justify-between py-3`
- No individual `border-b` on each row
- Subtle `border-t border-border-custom` only between the toggle group and the next section
- Whitespace provides sufficient visual separation

### Alert banners
Replace hardcoded `bg-red-50` / `bg-amber-50` with token-based styles:
- Error/denied: `bg-danger-subtle border border-danger/20 rounded-lg p-3`, icon + title + description + action
- Warning/prompt: `bg-warning-subtle border border-warning/20 rounded-lg p-3`
- Icons: keep current SVG patterns, update colors to token references

### Tab selectors
Used in AIPage for Downloaded/Manual source toggle:
- Active: `border-b-2 border-text-primary text-text-primary` (warm neutral, not teal)
- Inactive: `border-b-2 border-transparent text-text-secondary hover:text-text-primary`

### Model cards
Used in AIPage for curated model selection:
- Unselected: `border border-border-custom rounded-xl` on `surface`
- Selected: `border-2 border-accent bg-accent-subtle` (teal — appropriate for a CTA choice)
- Hover: `border-border-hover`

---

## 4. Button Hierarchy

| Level | Style | Usage |
|-------|-------|-------|
| Primary (CTA) | `bg-accent text-white rounded-lg px-4 py-2` | Download, save token, grant access |
| Secondary | `text-accent border border-accent rounded-lg px-4 py-2` | Search, expand |
| Ghost | `text-text-secondary hover:text-text-primary` | Refresh, close, remove |

---

## 5. Input Fields

Standard input style:
```
bg-surface border border-border-custom rounded-lg px-3 py-2 text-sm
focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
```
- `font-mono` for paths and tokens
- `font-sans` for search queries
- Select dropdowns: same border/radius/focus treatment

---

## 6. Shortcut Recorder

No structural changes. Update color references:
- Key badge background: `bg-[#ebe6df]` (warm tan matching sidebar active)
- Text: `text-text-primary`

---

## 7. Spacing System

| Context | Value | Tailwind |
|---------|-------|----------|
| Between sections | 24px | `space-y-6` |
| Within sections (rows) | 12px | `space-y-3` |
| Section internal padding | 16px | `p-4` |
| Page outer padding | 20px | `p-5` |

---

## Files to Modify

| File | Changes |
|------|---------|
| `tokens.css` | 8 token value updates (canvas, borders, accent-subtle, text-secondary, text-muted, info) |
| `Home.tsx` | Sidebar width, active/hover nav states, header styles |
| `GeneralPage.tsx` | Section cards, toggle rows, alert banners, heading styles, select styling |
| `AIPage.tsx` | Section cards, tab selectors, model cards, inputs, alerts, buttons |
| `ModelPage.tsx` | Apply same section/heading/toggle patterns |
| `DictionaryPage.tsx` | Apply same section/heading patterns |
| `HistoryPage.tsx` | Apply same section/heading patterns |
| `AboutPage.tsx` | Minor spacing/color alignment |
| `ShortcutRecorder.tsx` | Update key badge colors to warm tan |

## Out of Scope

- Overlay window (separate design context)
- Onboarding flow
- Functional/interaction changes
- Component library extraction (use consistent patterns inline)
- Dark mode
