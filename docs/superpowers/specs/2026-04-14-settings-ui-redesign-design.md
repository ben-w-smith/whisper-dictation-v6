# Settings UI Redesign — Full Layout Overhaul

**Date:** 2026-04-14
**Approach:** C — Full Layout Redesign
**Scope:** Settings/home window (900x600), all page views, shared components, design tokens
**Reference:** Wispr Flow design language — warm neutrals, editorial feel, restrained accent use

---

## 1. Navigation & Window Layout

### Sidebar (~180px)

- App identity at top: small muted text "Whisper Dictation", no icon
- Nav items are flat text links with a **2px left-edge accent bar** for active state + warm tan background fill (`bg-selection`)
- No rounded corners on nav items
- **Footer area** at bottom: "About" link separated from main nav by a divider, styled as small muted text

### Page reorganization

Merge Model + AI into one "Transcription" page. Final nav:

1. **General** — Mic, output toggles, shortcuts
2. **Transcription** — Whisper model + AI refinement (merged)
3. **Dictionary** — Word replacements
4. **History** — Transcription log
5. *(About — sidebar footer link, opens inline or as small modal)*

### Content area

- Remove the close button header bar (macOS traffic lights already handle this)
- Content padding: `px-8 py-6` (increased from `p-5`)
- Pages scroll independently within content area

---

## 2. Color Token System

### Surfaces

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `canvas` | `#fafaf9` | Warm bone white | `#f7f5f2` |
| `surface` | `#ffffff` | Pure white (unchanged) | `#ffffff` |
| `overlay` | `rgba(15,15,18,0.85)` | Unchanged | — |

### Text

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `text-primary` | `#1c1917` | Softer warm dark | `#292524` |
| `text-secondary` | `#78716c` | Unchanged | `#78716c` |
| `text-muted` | `#a8a29e` | Unchanged | `#a8a29e` |

### Accent (teal brand)

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `accent` | `#0d9488` | Unchanged | `#0d9488` |
| `accent-hover` | `#0f766e` | Unchanged | `#0f766e` |
| `accent-subtle` | `#f0fdfa` | Warmer pastel teal | `#eef8f5` |

### Borders

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `border-custom` | `#e7e5e4` | Warmer tan-tinted | `#e8e5e1` |
| `border-hover` | `#d6d3d1` | Warmer | `#d5d0ca` |

### Selection & active states (new)

| Token | Hex | Notes |
|-------|-----|-------|
| `selection` | `#f0ece6` | Warm tan fill for active nav, selected cards |
| `selection-text` | `#44403c` | Dark warm text on selection backgrounds |

### Semantic states

| Token | Current | New | Hex |
|-------|---------|-----|-----|
| `success` | `#16a34a` | Unchanged | `#16a34a` |
| `success-subtle` | `#f0fdf4` | Warmer | `#eef7f0` |
| `warning` | `#d97706` | Unchanged | `#d97706` |
| `warning-subtle` | `#fffbeb` | Warmer | `#faf5eb` |
| `danger` | `#dc2626` | Unchanged | `#dc2626` |
| `danger-subtle` | `#fef2f2` | Warmer | `#faf0f0` |

### Color usage rules

- **Selection (warm tan):** Active nav items, selected model/intensity cards
- **Accent (teal):** CTAs (Download, Save, Add), toggle switches (on state), focus rings, links, "correction" text in dictionary
- **Danger (red):** Clear All, delete buttons, permission-denied warnings
- **Canvas background:** Warm bone white across the entire window

---

## 3. Component Patterns

### Section headings

```
text-[15px] font-semibold text-text-primary mb-4
```

Optional subtitle: `text-sm text-text-secondary` below heading, `mb-3` before content.

Sections separated by `space-y-8`. No border dividers between sections.

### Settings rows (label + control)

```html
<div class="flex items-center justify-between py-3">
  <div>
    <div class="text-text-primary font-medium">Label</div>
    <div class="text-sm text-text-secondary">Description</div>
  </div>
  <Control />
</div>
```

No borders between rows. Used for toggles, status rows, dropdowns.

### Cards (selectable items)

```html
<div class="p-4 rounded-xl border transition-all
  selected ? 'border-selection bg-selection' : 'border-border-custom bg-surface hover:border-border-hover'">
  ...
</div>
```

Active state uses warm tan selection tokens. Inner layout: flex row.

### Alert banners

- Error: `bg-danger-subtle border border-[#e8c4c4]`
- Warning: `bg-warning-subtle border border-[#e8d9b8]`
- Info: `bg-accent-subtle border border-[#c4ddd9]`

All: `flex items-start gap-3 p-3 rounded-lg`, icon `w-5 h-5 shrink-0 mt-0.5`.

### Buttons

| Tier | Style | Use cases |
|------|-------|-----------|
| Primary | `bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover` | Save, Download, Add |
| Secondary | `border border-accent text-accent px-3 py-1.5 rounded-lg hover:bg-accent-subtle` | Search, non-critical |
| Destructive | `bg-danger text-white px-4 py-2 rounded-lg hover:bg-red-700` | Clear All |
| Ghost | `text-text-secondary hover:text-text-primary hover:bg-canvas px-3 py-2 rounded-lg` | Cancel, text links |

All: `text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`.

### Input fields

```
w-full px-3 py-2 border border-border-custom rounded-lg bg-surface text-sm text-text-primary
focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
```

Add `font-mono` for paths and tokens.

### Progress bars

- Track: `bg-border-custom rounded-full h-2`
- Fill: `bg-accent` with width transition

### Empty states

```html
<div class="py-16 text-center">
  <div class="w-12 h-12 rounded-2xl bg-canvas mx-auto mb-4">
    <Icon class="w-6 h-6 text-text-muted" />
  </div>
  <p class="text-text-secondary text-sm font-medium">Title</p>
  <p class="text-text-muted text-xs mt-1.5">Subtitle</p>
</div>
```

### Badges/pills

```
text-[11px] px-1.5 py-0.5 rounded font-medium
```

- Neutral: `bg-canvas text-text-muted`
- Info: `bg-accent-subtle text-accent`
- Warning: `bg-warning-subtle text-warning`

---

## 4. Page-by-Page Redesign

### General Page

**Audio Input section:**
- Permission alerts: token-based alert banners (warm danger-subtle for denied, warm warning-subtle for prompt)
- Mic selector: settings row pattern, refresh button stays
- "Access granted" badge: info badge style

**Output section:**
- Four toggle rows (copy, paste, sounds, overlay) using settings row pattern
- No border-b between items, just `py-3` spacing

**Shortcuts section:**
- Same functionality, updated border tokens
- "Add Shortcut": ghost button style
- Remove buttons: ghost style, `text-danger` on hover

### Transcription Page (merged Model + AI)

**Whisper Model subsection** (from ModelPage):
- Heading: "Transcription Model"
- Subtitle: "Choose the local whisper.cpp model for speech-to-text"
- Five model cards using selectable card pattern
- Selected card: warm tan selection (`bg-selection border-selection`)
- Download/progress/downloaded states stay the same functionally

**Visual divider** between subsections: `border-b border-border-custom` after whisper section, `mt-8 pt-8` before AI section.

**AI Refinement subsection** (from AIPage):
- Enable toggle as full-width card (`p-4 rounded-xl border bg-surface`)
- When enabled:
  - Source tabs (Downloaded/Manual): tab bar with underline, accent for active
  - HF Token: compact card with save/edit toggle
  - Model cards: selectable card pattern (warm tan for selected)
  - Search: collapsible section, same interaction
  - Server status: settings row
  - Intensity: three selectable cards

### Dictionary Page

- Add form: two inputs side-by-side with arrow, "Add" primary button — updated tokens
- Empty state: standardized pattern
- Entry list: `divide-y divide-border-custom`, `py-3 group`
- Replacement text: `text-accent font-medium`
- Delete buttons: ghost style, `opacity-0 group-hover:opacity-100`

### History Page

- Search bar: updated input tokens
- Stats line: `text-sm text-text-muted`
- Clear All: ghost style, `text-danger` on hover
- Clear confirmation: danger-subtle alert pattern
- Entry list: `divide-y divide-border-custom`
  - Metadata badges: badge pattern
  - "Refined" badge: info style
  - "Original" badge: warning style
  - Action buttons: ghost pattern, `opacity-0 group-hover:opacity-100`
  - Raw text highlight: `bg-warning-subtle/30`
  - Copied state: `text-accent bg-accent-subtle`
- Empty state: standardized pattern

### About

Moved to sidebar footer link. Clicking opens a small modal/panel overlay:
- App icon + name + version
- Links (GitHub, License)
- Credits paragraph
- Close via button or click-outside

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/styles/tokens.css` | New palette, add selection/active tokens, update utilities |
| `src/renderer/src/views/Home.tsx` | Narrower sidebar, flat nav items, footer About link, remove header bar |
| `src/renderer/src/views/home/GeneralPage.tsx` | Token-based alerts, settings rows, updated spacing |
| `src/renderer/src/views/home/ModelPage.tsx` | Delete (merged into TranscriptionPage) |
| `src/renderer/src/views/home/AIPage.tsx` | Delete (merged into TranscriptionPage) |
| `src/renderer/src/views/home/TranscriptionPage.tsx` | New — merged Model + AI |
| `src/renderer/src/views/home/DictionaryPage.tsx` | Updated tokens, ghost delete buttons, cleaner empty state |
| `src/renderer/src/views/home/HistoryPage.tsx` | Updated tokens, standardized badges, ghost actions |
| `src/renderer/src/views/home/AboutPage.tsx` | Convert to modal component or inline footer display |
| `src/shared/types.ts` | Update `HomePage` type to reflect new page names |
