# Themeable Foundation

**Date:** 2026-04-16
**Status:** Approved — review items resolved 2026-04-16. Ready for execution.
**Scope:** Introduce a user-facing Appearance system — themes (Light / Warm / Dark / Black), accent swatches, corner-radius slider, ambient background. Requires restructuring tokens and adding a new settings page.
**Approach:** Extend the existing `tokens.css` with theme-scoped CSS variables driven by `data-theme` / `data-accent` attributes on `<html>`. Add one new `AppearancePage` and a small persistence layer.
**Design inspiration:** [jakubantalik.com](https://jakubantalik.com/) customization panel, [dona.ai](https://dona.ai/)'s Light/Dark/Black triplet.

## Pre-execution Review (resolved 2026-04-16)

- [x] **Default-settings contradiction** — resolved. `followSystemTheme` default flipped to `false` so warm is the meaningful first-launch experience. Users opt into follow-system via the Appearance page.
- [x] **Radius slider range** — narrowed from `0.75–1.5` to `0.85–1.2` (yields `~10–14px` at the `xl` radius, safe visual range).
- [x] **Ambient `dots` opacity** — fixed from `0.5` to `0.06` to match the other ambient intensities.
- [x] **Storybook theme decorator** — spelled out in §6 with a concrete implementation.
- [x] **Cleanup** — `calc(9999px)` simplified to `9999px` in §2.1.
- [x] **Naming** — `--color-recorder-border` renamed to `--color-border-subtle` (generalized semantic name, reusable across components).

## Problem

The current token system has a single warm-neutral palette hardcoded. There is no dark mode, no accent choice, no way for users to tune the interface to their preference. For a utility app that lives in the menu bar all day, appearance customization is table stakes at the "designed" tier — and it's the clearest differentiator versus competing dictation apps.

Phase 1 (overlay border beam) ships the signature visual moment. Phase 2 (this plan) gives users ownership of the system.

## Design Direction

- **Three themes, not two.** Light (cool neutral), Warm (current — the default), Dark (warm dark), Black (true OLED). Four total.
- **Five accents.** Teal (current default), Amber, Violet, Rose, Mono (monochrome — no color, grayscale UI).
- **Radius slider.** Single scalar `--radius-scale` (0.85–1.2) that multiplies the base radius scale. Users who like square UIs can dial down; users who like big pills can dial up.
- **Ambient background.** Optional texture layer on `canvas`: None (default), Grain, Dots, Sunset (warm radial), Ocean (cool radial). Sits below content at low opacity.
- **Instant feedback.** Changes apply live with a 200ms color-interpolation transition. No "apply" button.
- **Persisted.** Theme preferences saved via existing `electron-store` settings pipeline.

---

## 1. Settings Schema Extension

**File:** `src/shared/types.ts` (`AppSettings` interface)

Add:

```ts
export type ThemeName = 'light' | 'warm' | 'dark' | 'black'
export type AccentName = 'teal' | 'amber' | 'violet' | 'rose' | 'mono'
export type AmbientName = 'none' | 'grain' | 'dots' | 'sunset' | 'ocean'

interface AppearanceSettings {
  theme: ThemeName            // default: 'warm'
  accent: AccentName          // default: 'teal'
  radiusScale: number         // 0.85–1.2, default: 1.0
  ambient: AmbientName        // default: 'none'
  followSystemTheme: boolean  // default: false — user opts in via Appearance page
}
```

**File:** `src/shared/constants.ts` (`DEFAULT_SETTINGS`)

Add the five new fields with defaults above.

---

## 2. Token Restructure

**File:** `src/renderer/src/styles/tokens.css`

### 2.1 Move theme-variant tokens out of `@theme`

The current single palette lives under `@theme { ... }`. Move all *surface/text/border* tokens into theme-scoped selectors; keep *spacing/radius/font* tokens in `@theme` since they're theme-independent.

```css
@theme {
  /* Font, spacing, base radii — unchanged */
  --font-sans: 'DM Sans', ...;
  --space-xs: 4px;
  /* ... */

  /* Accent palette swatches — all defined, selected by [data-accent] */
  --accent-teal:    #0d9488;
  --accent-teal-h:  #0f766e;
  --accent-amber:   #d97706;
  --accent-amber-h: #b45309;
  --accent-violet:  #7c3aed;
  --accent-violet-h: #6d28d9;
  --accent-rose:    #e11d48;
  --accent-rose-h:  #be123c;
  --accent-mono:    #1c1917;
  --accent-mono-h:  #000000;

  /* Radius scale — multiplied per-usage */
  --radius-sm: calc(6px  * var(--radius-scale, 1));
  --radius-md: calc(8px  * var(--radius-scale, 1));
  --radius-lg: calc(10px * var(--radius-scale, 1));
  --radius-xl: calc(12px * var(--radius-scale, 1));
  --radius-pill: 9999px;
}

html {
  /* Defaults applied before theme attribute loads */
  --radius-scale: 1;
}

/* Active accent resolution — same approach for all themes */
html[data-accent="teal"]   { --color-accent: var(--accent-teal);   --color-accent-hover: var(--accent-teal-h); }
html[data-accent="amber"]  { --color-accent: var(--accent-amber);  --color-accent-hover: var(--accent-amber-h); }
html[data-accent="violet"] { --color-accent: var(--accent-violet); --color-accent-hover: var(--accent-violet-h); }
html[data-accent="rose"]   { --color-accent: var(--accent-rose);   --color-accent-hover: var(--accent-rose-h); }
html[data-accent="mono"]   { --color-accent: var(--accent-mono);   --color-accent-hover: var(--accent-mono-h); }

/* Accent-subtle derivation — 8% color-mix over canvas */
html { --color-accent-subtle: color-mix(in oklch, var(--color-accent) 8%, var(--color-canvas)); }
html[data-accent="mono"] { --color-accent-subtle: var(--color-surface-hover); /* no tint for mono */ }
```

### 2.2 Theme palettes

```css
/* ─── LIGHT (cool neutral, Vercel-adjacent) ─── */
html[data-theme="light"] {
  --color-canvas:          #fafafa;
  --color-surface:         #ffffff;
  --color-surface-hover:   #f4f4f5;
  --color-surface-active:  #e4e4e7;
  --color-overlay:         rgba(15, 15, 18, 0.85);

  --color-text-primary:    #09090b;
  --color-text-secondary:  #52525b;
  --color-text-muted:      #a1a1aa;

  --color-border-custom:   #e4e4e7;
  --color-border-hover:    #d4d4d8;
  --color-border-subtle:   #c4c4c7;

  --color-toggle-off:      #d4d4d8;
}

/* ─── WARM (current — default) ─── */
html[data-theme="warm"] {
  --color-canvas:          #f0ece8;
  --color-surface:         #faf8f6;
  --color-surface-hover:   #ebe6df;
  --color-surface-active:  #e5e0d8;
  --color-overlay:         rgba(15, 15, 18, 0.85);

  --color-text-primary:    #1c1917;
  --color-text-secondary:  #6b6560;
  --color-text-muted:      #9c9590;

  --color-border-custom:   #e0dbd5;
  --color-border-hover:    #d1cbc3;
  --color-border-subtle:   #c4bdb4;

  --color-toggle-off:      #d6d1ca;
}

/* ─── DARK (warm dark, ~#18181b base with warm undertone) ─── */
html[data-theme="dark"] {
  --color-canvas:          #1a1918;
  --color-surface:         #242321;
  --color-surface-hover:   #2e2d2a;
  --color-surface-active:  #383734;
  --color-overlay:         rgba(0, 0, 0, 0.88);

  --color-text-primary:    #f5f2ef;
  --color-text-secondary:  #a8a29e;
  --color-text-muted:      #78716c;

  --color-border-custom:   #2e2d2a;
  --color-border-hover:    #3a3836;
  --color-border-subtle:   #4a4846;

  --color-toggle-off:      #3a3836;
}

/* ─── BLACK (true OLED — pure #000 canvas, minimal elevation) ─── */
html[data-theme="black"] {
  --color-canvas:          #000000;
  --color-surface:         #0a0a0a;
  --color-surface-hover:   #141414;
  --color-surface-active:  #1f1f1f;
  --color-overlay:         rgba(0, 0, 0, 0.92);

  --color-text-primary:    #fafafa;
  --color-text-secondary:  #9ca3af;
  --color-text-muted:      #6b7280;

  --color-border-custom:   #1f1f1f;
  --color-border-hover:    #2a2a2a;
  --color-border-subtle:   #3a3a3a;

  --color-toggle-off:      #2a2a2a;
}
```

### 2.3 Ambient background layer

Added as a `body::before` pseudo-element. Opacity low (~3–8%) so content remains readable.

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  transition: opacity 250ms ease;
}

html[data-ambient="none"] body::before { opacity: 0; }

html[data-ambient="grain"] body::before {
  opacity: 0.06;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

html[data-ambient="dots"] body::before {
  opacity: 0.06;
  background-image: radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px);
  background-size: 18px 18px;
}

html[data-ambient="sunset"] body::before {
  opacity: 0.35;
  background:
    radial-gradient(ellipse at top left,  #fda4af22 0%, transparent 60%),
    radial-gradient(ellipse at bottom right, #fbbf2422 0%, transparent 60%);
}

html[data-ambient="ocean"] body::before {
  opacity: 0.35;
  background:
    radial-gradient(ellipse at top right,    #60a5fa22 0%, transparent 60%),
    radial-gradient(ellipse at bottom left,  #5eead422 0%, transparent 60%);
}
```

### 2.4 Transition smoothing

When themes change, we don't want hard snaps. Add a global (brief) color transition on root:

```css
html {
  transition:
    background-color 220ms ease,
    color 220ms ease;
}

/* Surfaces inherit this through tokens; components using tokens auto-interpolate */
```

---

## 3. Appearance Page

### 3.1 Navigation entry

**File:** `src/renderer/src/views/Home.tsx`

Add `{ id: 'appearance', label: 'Appearance' }` to `pages` between `General` and `Model`.

**File:** `src/shared/types.ts`

Add `'appearance'` to the `HomePage` union.

### 3.2 New page component

**File:** `src/renderer/src/views/home/AppearancePage.tsx` (NEW)

Sections:

1. **Theme** — 4 swatch buttons (Light / Warm / Dark / Black). Each is a mini-preview tile showing that theme's canvas + surface + a sample accent line. Active swatch has 2px accent border.
2. **Follow system** — single toggle row: *"Follow system theme"*. When on, theme is `light` if `prefers-color-scheme: light`, else `dark` (not `black` — too aggressive as a default). User's manual theme selection is still saved but inactive.
3. **Accent color** — 5 circular swatches (24px), each filled with its accent color (Mono = small gradient black/white). Active has a ring.
4. **Corner radius** — labeled slider (Sharp ← → Round), range `0.85–1.2` step `0.05`. Live-previewed via a sample tile that changes radius as the user drags.
5. **Ambient background** — 5 radio-style tiles (None / Grain / Dots / Sunset / Ocean), each showing a mini preview of the texture.

All controls `onChange` → `updateSetting` → which calls a new `useAppearance()` hook to also write the corresponding `data-*` attribute and CSS var to `<html>`.

### 3.3 `useAppearance` hook

**File:** `src/renderer/src/hooks/useAppearance.ts` (NEW)

```ts
export function useAppearance(settings: Pick<AppSettings,
  'theme' | 'accent' | 'radiusScale' | 'ambient' | 'followSystemTheme'
>) {
  const effectiveTheme = useMemo(() => {
    if (!settings.followSystemTheme) return settings.theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }, [settings.theme, settings.followSystemTheme])

  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = effectiveTheme
    html.dataset.accent = settings.accent
    html.dataset.ambient = settings.ambient
    html.style.setProperty('--radius-scale', String(settings.radiusScale))
  }, [effectiveTheme, settings.accent, settings.ambient, settings.radiusScale])

  // Re-evaluate when system theme changes
  useEffect(() => {
    if (!settings.followSystemTheme) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { /* force re-render via state bump */ }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.followSystemTheme])
}
```

### 3.4 App-level wiring

**File:** `src/renderer/src/App.tsx`

- Load settings on mount (already done for various pages — centralize here or lift from `GeneralPage`)
- Call `useAppearance(appearanceSettings)` at the top level so every window reflects the chosen theme
- Overlay window inherits theme via its own `useAppearance` call in the overlay entry (main renderer has separate overlay mount)

### 3.5 Overlay considerations

The overlay pill (from overlay-border-beam plan) stays tuned for dark backgrounds regardless of theme — it sits over arbitrary desktop content and must read as a floating dark pill. However:

- **Beam accent color in `recording` state uses `var(--color-accent)`** — so a violet theme gets a violet beam during recording. Overrides the state default `#f87171` red? No — recording should stay red for semantic clarity. But **the beam while active on the Home window's test-overlay demo** (see onboarding plan) uses accent.
- Decision: **beam colors are state-semantic, not theme-tinted.** Theme accent appears in buttons, toggles, sidebar active state, model selection cards — not the overlay. Keeps states readable.

---

## 4. Component Updates for Dark Compatibility

All current components use token utilities. Most will auto-adapt. Spot-check list — only these need attention:

| Component | Issue | Fix |
|-----------|-------|-----|
| `ShortcutRecorder.tsx` | Hardcoded `bg-[#ebe6df]` active state, `border-[#c4bdb4]`, `hover:bg-[#ebe6df]` | Replace with `bg-surface-hover`, `border-border-subtle`, `hover:bg-surface-hover` tokens |
| `ToggleSwitch.tsx` | Hardcoded `bg-[#d6d1ca]` off state | Replace with `bg-toggle-off` utility |
| `Overlay.tsx` | Overlay intentionally theme-independent | No change |
| `Home.tsx` | Uses `bg-canvas` / `bg-surface` tokens | No change |
| `AIPage.tsx`, `GeneralPage.tsx`, etc. | Most use tokens; a handful of hardcoded colors from the settings redesign | Grep for `bg-[#` and `text-[#` and `border-[#` across `views/home/*` — replace each with nearest token |
| Alert banners (`bg-danger-subtle`, etc.) | Subtle bg color values are tuned for light — look flat on dark | Add dark-theme overrides where `--color-danger-subtle` etc. use `color-mix` with canvas |

### Semantic subtle colors (dark-mode fix)

Instead of hardcoded `#fef2f2` etc., derive all `-subtle` variants via `color-mix`:

```css
html { --color-success-subtle: color-mix(in oklch, var(--color-success) 10%, var(--color-canvas)); }
html { --color-warning-subtle: color-mix(in oklch, var(--color-warning) 10%, var(--color-canvas)); }
html { --color-danger-subtle:  color-mix(in oklch, var(--color-danger)  10%, var(--color-canvas)); }
html { --color-info-subtle:    color-mix(in oklch, var(--color-info)    10%, var(--color-canvas)); }
```

This eliminates the need for per-theme overrides — subtle variants become theme-aware automatically.

---

## 5. Persistence

Existing `electron-store` pipeline via `IPC.SET_SETTING` / `IPC.GET_SETTINGS` — no new IPC needed. Settings are serialized with the rest of `AppSettings`.

On first load of the renderer, the `useAppearance` hook fires once `settings` resolves. Brief flash of default (warm+teal) possible for ~50ms. To eliminate:

- Store theme in `localStorage` as well (write-through from `useAppearance`)
- Read `localStorage` synchronously in `main.tsx` *before* React mounts, set `data-theme` / `data-accent` immediately

```ts
// main.tsx, before createRoot
try {
  const cached = JSON.parse(localStorage.getItem('wd-appearance') || 'null')
  if (cached) {
    document.documentElement.dataset.theme = cached.theme ?? 'warm'
    document.documentElement.dataset.accent = cached.accent ?? 'teal'
    document.documentElement.dataset.ambient = cached.ambient ?? 'none'
    document.documentElement.style.setProperty('--radius-scale', String(cached.radiusScale ?? 1))
  }
} catch {}
```

---

## 6. Storybook

Storybook is load-bearing for catching token-site misses across 4 themes × 5 accents. Concrete implementation:

### 6.1 Theme decorator

**File:** `.storybook/preview.tsx`

Register a decorator that reads Storybook `globalTypes` and applies `data-theme` / `data-accent` to the Storybook iframe's `<html>` element:

```tsx
import type { Preview, Decorator } from '@storybook/react'
import '../src/renderer/src/styles/tokens.css'

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? 'warm'
  const accent = context.globals.accent ?? 'teal'
  const ambient = context.globals.ambient ?? 'none'
  const radiusScale = context.globals.radiusScale ?? 1

  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
    html.dataset.accent = accent
    html.dataset.ambient = ambient
    html.style.setProperty('--radius-scale', String(radiusScale))
  }, [theme, accent, ambient, radiusScale])

  return <Story />
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'warm', title: 'Warm' },
          { value: 'dark', title: 'Dark' },
          { value: 'black', title: 'Black' },
        ],
        showName: true,
      },
    },
    accent: {
      name: 'Accent',
      toolbar: {
        icon: 'circle',
        items: [
          { value: 'teal',   title: 'Teal' },
          { value: 'amber',  title: 'Amber' },
          { value: 'violet', title: 'Violet' },
          { value: 'rose',   title: 'Rose' },
          { value: 'mono',   title: 'Mono' },
        ],
      },
    },
    ambient: {
      name: 'Ambient',
      toolbar: {
        icon: 'photo',
        items: ['none', 'grain', 'dots', 'sunset', 'ocean'].map(v => ({ value: v, title: v })),
      },
    },
    radiusScale: {
      name: 'Radius',
      toolbar: {
        icon: 'cog',
        items: [
          { value: 0.85, title: 'Sharp (0.85)' },
          { value: 1.0,  title: 'Default (1.0)' },
          { value: 1.2,  title: 'Round (1.2)' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'warm', accent: 'teal', ambient: 'none', radiusScale: 1 },
  decorators: [withTheme],
}

export default preview
```

### 6.2 Per-page stories

- Add `AppearancePage.stories.tsx` with one default story. Users exercise it against different theme/accent combinations via the toolbar.

### 6.3 Verification story

Add a `TokenAudit.stories.tsx` that renders a grid of every token-using component (buttons, toggles, inputs, alert banners, shortcut recorder, model card). When switching themes in the toolbar, any component that still has hardcoded colors will "stick out." This is the primary mechanism for catching missed migration sites across the 4 themes × 5 accents.

### 6.4 CI

Chromatic (or snapshot suite) runs against all 4 theme snapshots. Regressions surface in PR review. Out of scope for v1 — add after the migration lands.

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types.ts` | `ThemeName`, `AccentName`, `AmbientName` unions; extend `AppSettings`; add `'appearance'` to `HomePage` |
| `src/shared/constants.ts` | Extend `DEFAULT_SETTINGS` with 5 new fields |
| `src/renderer/src/styles/tokens.css` | Major restructure: move palette into `[data-theme]` blocks; accent swatches; radius-scale; ambient layer; color-mix subtle variants |
| `src/renderer/src/views/Home.tsx` | Add Appearance nav entry |
| `src/renderer/src/views/home/AppearancePage.tsx` | **NEW.** Full page |
| `src/renderer/src/views/home/AppearancePage.stories.tsx` | **NEW.** |
| `src/renderer/src/hooks/useAppearance.ts` | **NEW.** Hook + system-theme listener |
| `src/renderer/src/App.tsx` | Top-level `useAppearance` wiring |
| `src/renderer/src/main.tsx` | Synchronous `localStorage` bootstrap for no-flash |
| `src/renderer/src/components/ShortcutRecorder.tsx` | Replace hardcoded colors with tokens |
| `src/renderer/src/components/ToggleSwitch.tsx` | Replace `bg-[#d6d1ca]` with `bg-toggle-off` |
| `src/renderer/src/views/home/*.tsx` | Grep + replace remaining hardcoded `bg-[#...]` / `text-[#...]` / `border-[#...]` |
| `.storybook/*` | Add theme decorator |

---

## 8. Verification

- [ ] All 4 themes legible (contrast ≥ AA on text/bg combos — tested in DevTools accessibility panel)
- [ ] Switching theme interpolates (~220ms) — no hard snap
- [ ] Accent swatch click updates every tokened component instantly
- [ ] Radius slider live-updates sidebar buttons, model cards, toggles, inputs
- [ ] Ambient backgrounds render correctly per theme, opacity feels right (subtle, not noisy)
- [ ] "Follow system theme" responds to OS appearance changes without app restart
- [ ] No flash of wrong theme on app open (localStorage bootstrap works)
- [ ] Overlay pill unchanged regardless of theme (sanity check)
- [ ] Alert banner subtle colors readable in dark/black themes
- [ ] Settings persist across restarts
- [ ] All Storybook stories render under each theme × accent combination (spot check)
- [ ] No regression in existing Playwright e2e suite
- [ ] `pnpm lint` clean

---

## Out of Scope

- Custom user accent (hex picker)
- Theme import/export sharing
- Per-window theme override (overlay always follows app theme baseline)
- Font family customization (covered in editorial-polish plan)
- Animating ambient backgrounds (e.g., slowly drifting sunset) — could be Phase 2.5
- Window chrome / traffic light customization
- High-contrast mode
