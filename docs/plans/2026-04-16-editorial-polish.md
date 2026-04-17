# Editorial Polish

**Date:** 2026-04-16
**Status:** Approved — review items resolved 2026-04-16. Ready for execution.
**Note:** The onboarding redesign has been split into its own plan: [`2026-04-16-onboarding-redesign.md`](./2026-04-16-onboarding-redesign.md). This plan now covers tokens, motion, copy, and component polish only.
**Scope:** Typography system refinement, motion design (springs + choreography), humane copy pass, component micro-detail polish. (Onboarding is split into its own plan — see note above.)
**Approach:** Additive. Builds on overlay-border-beam and themeable-foundation plans — does not depend on them but shines brightest when all three land together.
**Design inspiration:** [dona.ai](https://dona.ai/) copy voice, [jakubantalik.com](https://jakubantalik.com/) type pairing, Linear/Vercel motion polish.

## Pre-execution Review (resolved 2026-04-16)

- [x] **Copy tone** — rubric codified in §3.0 below; §3 copy table rewritten against it.
- [x] **Cards vs. whitespace** — editorial-polish wins. `docs/superpowers/specs/2026-04-14-settings-ui-redesign-design.md` is marked as superseded.
- [x] **Onboarding scope** — split into its own plan ([`2026-04-16-onboarding-redesign.md`](./2026-04-16-onboarding-redesign.md)). §6 in this plan is now removed.
- [x] **Scrollbar auto-hide** — dropped for v1. Ship styled scrollbar only (see §7).
- [x] **Font payload budget** — added as §1.5 with preload + subsetting specifics.
- [ ] **Sidebar indicator motion test** — verifiable only at build time per §2.4. Left as a tune-on-implementation item; the plan flags the risk so the implementer watches for competing motion.

## Problem

Even with the overlay beam and theme customization in place, several details still feel un-designed:

1. **One-note typography.** DM Sans across every surface. No serif for emotional weight, no mono for shortcuts/paths, no tracking contrast between display and body type.
2. **Default motion.** Linear `transition-colors`, `animate-pulse`. No spring physics, no choreographed page transitions, toggles feel rigid.
3. **Clinical copy.** "Copy transcribed text to clipboard" is correct but forgettable. The voice should feel like a person wrote it.
4. **Card-heavy settings.** After the Wispr Flow redesign, everything sits in `surface` cards with borders. Whitespace-as-separator is more editorial.
5. **Onboarding is functional but unexciting.** At 13k, it has space for a big moment we're not using — no live overlay demo, no theme preview, no emotional hook.
6. **Focus states are invisible.** Subtle `ring-accent/30` is often washed out; keyboard users can't see where they are.

This plan fixes all of the above.

---

## 1. Typography System

### 1.1 New font additions

Add two families alongside DM Sans:

**Display serif: Instrument Serif** (Google Fonts, free, variable italic)
- Purpose: page titles, empty-state headlines, onboarding hero
- Italic variant is the signature — *subtle, editorial, warm*
- Weight: 400 only (it's a display face)

**Mono: JetBrains Mono** (Google Fonts, free, variable)
- Purpose: shortcut key badges, file paths, the overlay timer, model names/hashes in AIPage
- Weight: 400–600 range

Load locally (matching the DM Sans pattern) — download woff2 files to `src/renderer/src/assets/fonts/`:

```css
@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url('../assets/fonts/InstrumentSerif-Italic.woff2') format('woff2');
}
@font-face {
  font-family: 'Instrument Serif';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('../assets/fonts/InstrumentSerif-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url('../assets/fonts/JetBrainsMono-Variable.woff2') format('woff2');
}
```

### 1.2 Token additions

**File:** `src/renderer/src/styles/tokens.css`

```css
@theme {
  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, 'Times New Roman', serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Type scale with tracking built in */
  --text-display: 32px;      /* onboarding hero, About title */
  --text-display-tracking: -0.025em;
  --text-display-leading: 1.1;

  --text-title: 22px;        /* page titles (serif italic) */
  --text-title-tracking: -0.015em;
  --text-title-leading: 1.2;

  --text-heading: 14px;      /* section headings (sans, uppercase, wide) */
  --text-heading-tracking: 0.08em;
  --text-heading-leading: 1.3;

  --text-body: 14px;
  --text-body-tracking: 0;
  --text-body-leading: 1.5;

  --text-caption: 12px;
  --text-caption-tracking: 0.01em;
  --text-caption-leading: 1.4;

  --text-label: 11px;
  --text-label-tracking: 0.1em;  /* uppercase labels */
  --text-label-leading: 1.2;
}

/* Utility classes */
@utility font-serif { font-family: var(--font-serif); }
@utility font-mono  { font-family: var(--font-mono); }

@utility text-display {
  font-size: var(--text-display);
  letter-spacing: var(--text-display-tracking);
  line-height: var(--text-display-leading);
}
/* ... repeat for title, heading, body, caption, label ... */
```

### 1.3 Application rules

**Where serif is used:**
- Onboarding hero headline: *"Your voice, transcribed."* (italic serif)
- About page app name: *"Whisper Dictation"* (italic serif, large)
- Settings page titles appearing in the header (replace the centered text-muted "Whisper Dictation" label with left-aligned page-title serif)
- Empty states (History page "No transcriptions yet", Dictionary "No entries")

**Where mono is used:**
- Shortcut recorder badge text (keys like `Cmd+Shift+D`)
- Overlay elapsed timer (already planned)
- File path inputs (refinement model path)
- Model names with hashes/tags in AIPage
- About page version number

**Where tracking changes apply:**
- Section headings: keep their current uppercase + tight-spaced → formalize via `text-label` / `text-heading` tokens
- Body copy: baseline `text-body`, no change
- Display/title: negative tracking for optical tightness

### 1.4 Header restructure

**File:** `src/renderer/src/views/Home.tsx`

Current header is centered, muted, says "Whisper Dictation" regardless of page. Replace with:

```tsx
<header className="titlebar-drag flex items-center justify-between px-6 py-4 border-b border-border-custom bg-surface">
  <h1 className="text-title font-serif italic text-text-primary">
    {pageMeta[activePage].title}
  </h1>
  <button onClick={handleClose} className="titlebar-no-drag ...">
    {/* existing close icon */}
  </button>
</header>
```

`pageMeta` provides `title` per page: *General* → *"General"*, *AI* → *"Artificial Intelligence"* (expanded for a touch of personality), etc. Small but signature.

### 1.5 Font-loading budget

Variable woff2 files land in `src/renderer/src/assets/fonts/`:

- `InstrumentSerif-Regular.woff2` — ~14KB (Latin subset, regular only — no italic file needed; italic is rendered via CSS `font-style: italic` against the regular face with synthetic italic disabled by using the italic variant listed below)
- `InstrumentSerif-Italic.woff2` — ~14KB (Latin subset, italic only — our primary display usage)
- `JetBrainsMono-VariableLatin.woff2` — ~70KB (variable axis `wght 100..800`, Latin subset only — strip Cyrillic and extended ranges)

**Total estimate: ~100KB.** Acceptable for a desktop Electron app where first paint isn't over the network, but still worth optimizing since the renderer loads these on every window open.

**Loading strategy:**

1. **`@font-face` in `tokens.css`** with `font-display: swap` — we tolerate a brief system-font flash to avoid blocking paint.
2. **`<link rel="preload" as="font" crossorigin>`** in `src/renderer/index.html` for:
   - `InstrumentSerif-Italic.woff2` (the primary display face)
   - `JetBrainsMono-VariableLatin.woff2` (used in shortcut badges, timer, code elements — visible above the fold on most pages)
   - Skip preloading `InstrumentSerif-Regular.woff2` — not used on-load anywhere critical.
3. **Subsetting confirmation.** Before adding fonts, run each woff2 through `fonttools` (`pyftsubset --unicodes="U+0000-00FF,U+2018-201F,U+2026,U+2014"`) to strip to Latin + common punctuation. Measure before/after.
4. **FOUT measurement.** During Phase 4 verification, open DevTools Performance tab on cold start. Expected: system font for ~50–150ms, then swap to Instrument Serif on page title. If swap is visually jarring, fall back to `font-display: optional` (drops the font rather than showing unstyled text — feels better than a jump for occasional readers).

---

## 2. Motion Design

### 2.1 Ease tokens

Tailwind v4 + CSS `linear()` lets us build near-spring curves natively. Add to tokens:

```css
@theme {
  /* Standard eases */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);

  /* Spring approximations via linear() (Chromium 114+, Safari 17.4+) */
  --ease-spring-soft: linear(
    0, 0.005 1.4%, 0.022 2.7%, 0.082 5.5%, 0.313 11.5%, 0.428, 0.532,
    0.626, 0.71, 0.785, 0.85, 0.905, 0.95, 0.983, 1.002, 1.012, 1.015,
    1.012, 1.004, 1
  );
  --ease-spring-bouncy: linear(
    0, 0.01 1%, 0.04, 0.16, 0.37 12%, 0.61, 0.86, 1.08, 1.21, 1.25,
    1.21, 1.09, 0.98 45%, 0.93, 0.93, 0.98, 1.03, 1.04 76%, 1, 1
  );

  /* Durations */
  --dur-fast: 140ms;
  --dur-base: 220ms;
  --dur-slow: 360ms;
}

@utility ease-spring-soft { transition-timing-function: var(--ease-spring-soft); }
@utility ease-spring-bouncy { transition-timing-function: var(--ease-spring-bouncy); }
```

### 2.2 ToggleSwitch upgrade

**File:** `src/renderer/src/components/ToggleSwitch.tsx`

Current: `translate-x-5` with linear `duration-200`. Upgrade:

```tsx
<span className={`
  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
  transition-transform duration-[360ms] ease-spring-bouncy
  ${checked ? 'translate-x-5' : 'translate-x-0'}
`} />
```

The thumb now overshoots slightly when toggling on, settles back. Background color keeps the faster 200ms linear transition (color interpolation doesn't need springs).

### 2.3 Page transitions in Home

When `activePage` changes:
- Outgoing content fades out + translateY(-4px) over 140ms
- Incoming content fades in + translateY(4px → 0) over 220ms with `ease-spring-soft`
- Implement via `AnimatePresence`-style pattern or a small custom `<AnimatedSwitch>` wrapper that tracks `activePage` and animates based on key change

Use CSS transitions (not Framer Motion) — smaller bundle, sufficient for this use case.

### 2.4 Sidebar active state transition

Today the active sidebar item toggles classes instantly. Add:
- Background color interpolates via standard 200ms
- The `border-l-2 border-accent` indicator should *slide* between items, not snap

Pattern: absolutely-position a single `<span>` "indicator" element in the sidebar; animate its `top` and `height` with `ease-spring-soft` as `activePage` changes. Existing nav buttons drop their individual border-l.

```tsx
const navRef = useRef<HTMLElement>(null)
const [indicator, setIndicator] = useState({ top: 0, height: 0, opacity: 0 })

useEffect(() => {
  const btn = navRef.current?.querySelector(`[data-page="${activePage}"]`)
  if (btn instanceof HTMLElement) {
    setIndicator({ top: btn.offsetTop, height: btn.offsetHeight, opacity: 1 })
  }
}, [activePage])

// Indicator span:
<span
  aria-hidden
  className="absolute left-2 w-[2px] bg-accent rounded-full transition-all duration-[300ms] ease-spring-soft"
  style={{ top: indicator.top + 8, height: indicator.height - 16, opacity: indicator.opacity }}
/>
```

### 2.5 Checkmark reveal (overlay complete state + dona-style task completion)

For the overlay `complete` state (and potentially elsewhere):

```tsx
<svg viewBox="0 0 24 24" className="check-reveal">
  <path
    d="M5 13l4 4L19 7"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
</svg>

<style>
.check-reveal path {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: check-draw 340ms var(--ease-out-quart) forwards;
}
@keyframes check-draw {
  to { stroke-dashoffset: 0; }
}
</style>
```

Drop-in replacement for the current `<svg>` in the overlay complete state — meshes with the beam complete flash from the overlay plan.

### 2.6 Reduced motion

All new animations gated behind:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Applied as a global rule in `tokens.css`. Exception: the overlay beam handles its own reduced-motion logic (see overlay plan).

---

## 3. Copy Pass

### 3.0 Voice rubric

Every rewrite below follows these rules. If a line can't pass the rubric, fall back to plain functional copy — forced warmth is worse than none.

1. **"You/your" always. Never "we".** This is a local-only, single-user app. "We" is corporate. Exception: onboarding Ready screen may use "Done." (no pronoun) for finality.
2. **Utility copy is short.** Row labels, toggle helper text, button labels: prefer ≤8 words, no adjectives unless they add information. "Paste automatically" beats "Automatically paste whenever you finish dictating".
3. **Warmth is reserved for moments-of-truth.** Onboarding hero, empty states, success/error on a user's first attempt. Everywhere else, functional wins.
4. **No metaphors for mechanical actions.** "Drop text" = drag-and-drop interaction. "Put text" = mechanical. Prefer the mechanical verb in toggle descriptions; save metaphor for empty-state prose.
5. **Be accurate about system state.** Don't say "a couple of permissions" if macOS may need 2–4. Say "a few".
6. **Serif italic is for emotional beats, not UI chrome.** Page titles, onboarding hero, empty-state first line. Never toggle labels.

### 3.1 Rewrites (applied against rubric)

All functional meaning preserved. Before → After.

| Location | Before | After | Rubric reason |
|----------|--------|-------|---------------|
| GeneralPage — Shortcuts description | "Press your shortcut to start recording, press again to stop." | "Press to start. Press again to stop." | R2 (utility, short) |
| GeneralPage — Copy to clipboard label | "Copy to clipboard" | "Copy to clipboard" (unchanged) | R2, R3 (no warmth needed on toggle label) |
| GeneralPage — Copy to clipboard description | "Copy transcribed text to clipboard" | "Put your transcription on the clipboard." | R2, R4 |
| GeneralPage — Auto-paste label | "Auto-paste" | "Paste automatically" | R2 |
| GeneralPage — Auto-paste description | "Automatically paste transcribed text" | "Paste your transcription into the active app." | R2, R4 (no "drop") |
| GeneralPage — Play sounds description | "Play sound effects when recording" | "A soft click when you start and stop." | R2, R3 (warmth earned — rare audio cue) |
| GeneralPage — Show overlay label | "Show overlay" | "Show the recording pill" | R2 (specific) |
| GeneralPage — Show overlay description | "Show floating recording indicator" | "A small floating indicator while you speak." | R2, R3 |
| GeneralPage — Mic denied heading | "Microphone access denied" | "No microphone access" | R1, R2 |
| GeneralPage — Mic denied body | "Enable access in System Settings to use dictation." | "Open System Settings to grant access." | R1, R2 |
| GeneralPage — Mic prompt heading | "Microphone permission required" | "One more permission" | R1, R2 (not "a couple of") |
| GeneralPage — Mic prompt body | "Grant access so the app can record your voice." | "Whisper Dictation needs your microphone." | R1, R2 |
| History empty state — first line | — | *"Nothing to see yet."* (serif italic, display size) | R3, R6 |
| History empty state — body | — | "Your transcriptions will show up here." | R2 |
| Dictionary empty state — first line | — | *"A place for the words that matter."* (serif italic) | R3, R6 |
| Dictionary empty state — body | — | "Add names, jargon, or initials you want remembered exactly." | R2 |
| Overlay error (no message) | (generic) | "That didn't work. Try again?" | R3 (rare, earned) |
| Onboarding welcome | (current) | *"Your voice, transcribed."* (serif italic, display size) | R3, R6 |

**File:** `src/renderer/src/views/home/GeneralPage.tsx` + all other pages with strings. Extract into `src/renderer/src/copy.ts` if it grows beyond ~30 entries. Onboarding copy lives in the onboarding plan and follows the same rubric.

---

## 4. Card → Whitespace Separation

Current settings pages: every section gets a `surface` card with `border rounded-xl p-4`. Remove card chrome for toggle-heavy sections; retain for rich content (model selection, shortcut recorder list).

### 4.1 Rules

- **Use a card when:** the section contains a form, a grid of choices, a list of items with their own structure, or an alert banner.
- **Skip the card when:** the section is a simple list of toggle rows. Use only: section heading (uppercase label) + `divide-y divide-border-custom` between rows.

### 4.2 Example: GeneralPage "Output" section

Before (conceptually — cards):
```tsx
<section className="bg-surface border border-border-custom rounded-xl p-4">
  <h3>Output</h3>
  <div className="space-y-4">{/* 4 toggle rows */}</div>
</section>
```

After (whitespace-only):
```tsx
<section className="pt-2">
  <h3 className="text-label uppercase text-text-muted mb-3">Output</h3>
  <div className="divide-y divide-border-custom">
    {/* 4 toggle rows, each py-3.5 */}
  </div>
</section>
```

Apply same pattern to GeneralPage sections: Shortcuts (list of shortcut recorders keeps card), Audio Input (keep card — complex), Output (strip to whitespace), and equivalents across other pages.

---

## 5. Focus States

Current: `focus:ring-2 focus:ring-accent/30` — often washed out on warm canvas.

Upgrade to a **two-layer focus ring** that's visible on any background:

```css
@utility focus-ring {
  &:focus-visible {
    outline: 2px solid var(--color-surface);
    outline-offset: 0;
    box-shadow: 0 0 0 4px var(--color-accent);
  }
}
```

This creates a white gap + solid accent ring — visible on light, warm, dark, and black themes alike. Replace `focus:ring-*` usages throughout interactive elements with `focus-ring` utility.

---

## 6. Onboarding Redesign

**Split out — see [`2026-04-16-onboarding-redesign.md`](./2026-04-16-onboarding-redesign.md).** This is a full feature (live theme preview, overlay demo, right-panel choreography) rather than polish, and deserves its own phased plan, risk assessment, and acceptance criteria.

The onboarding plan consumes tokens, copy rubric, and motion primitives produced by this plan — so it must run **after** (or explicitly behind) this plan's Phase 1 & 2. See `README.md` tandem execution matrix.

---

## 7. Small Polish Items

- **Section heading treatment.** Change `text-sm font-semibold text-text-primary` → `text-label uppercase text-text-muted` for all `<h3>` section headings across settings pages. More editorial, less shouting.
- **Button hierarchy refinement.** Primary buttons gain a subtle `shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]` for a slight concave sheen (Vercel/Linear style). Ghost buttons get a 120ms background-color transition.
- **Close button on settings header.** Add hover background `bg-surface-hover` with 140ms fade.
- **Scrollbars.** Add a webkit scrollbar style: 6px wide, transparent track, `bg-border-subtle` thumb (renamed from `bg-border-custom` per themeable-foundation §2), `bg-border-hover` on hover. **No auto-hide for v1** — always-visible styled scrollbar ships first. Auto-hide was considered and deferred: the hook would need to be per-container, properly debounced, and cleaned up across four windows, which is more complexity than the visual win warrants. Revisit post-launch if users ask for it.
- **Model cards (AIPage) selected state.** Current: `border-2 border-accent`. Add a faint `shadow-[0_0_0_4px_var(--color-accent-subtle)]` glow so selection is visible even without the border weight change.
- **Shortcut recorder badge.** When displaying `Cmd+Shift+D`, render each key as its own small pill (`bg-surface-hover px-1.5 py-0.5 rounded-md font-mono text-[11px]`) separated by literal `+` text, rather than a flat string. Much more tactile.

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/assets/fonts/` | Add Instrument Serif + JetBrains Mono woff2 files |
| `src/renderer/src/styles/tokens.css` | Font-face declarations, type scale tokens, ease tokens, focus-ring utility, reduced-motion global, scrollbar styles |
| `src/renderer/src/views/Home.tsx` | Serif page-title header, animated sliding sidebar indicator, page transition wrapper |
| `src/renderer/src/views/home/*.tsx` | Section heading style updates, copy pass, card → whitespace conversions |
| `src/renderer/src/views/home/AboutPage.tsx` | Serif app name treatment |
| `src/renderer/src/views/home/HistoryPage.tsx` | Serif empty state |
| `src/renderer/src/views/home/DictionaryPage.tsx` | Serif empty state |
| `src/renderer/src/views/home/AIPage.tsx` | Mono on model names, enhanced selected model glow |
| `src/renderer/src/components/ToggleSwitch.tsx` | Spring-bouncy ease on thumb |
| `src/renderer/src/components/ShortcutRecorder.tsx` | Per-key pill rendering, mono token |
| `src/renderer/src/components/Overlay.tsx` | Mono timer (relies on fonts loaded), animated check-reveal (if not already done in overlay plan) |
| `src/renderer/index.html` | Font preload `<link>` tags per §1.5 |
| `src/renderer/src/components/Onboarding.tsx` | **Out of scope** — handled by onboarding-redesign plan |
| `src/renderer/src/copy.ts` | **NEW** (optional) — centralized strings |
| `src/renderer/src/hooks/useAnimatedSwitch.ts` | **NEW** — small wrapper for page transitions |

---

## 9. Verification

- [ ] Fonts load correctly, no FOUT beyond acceptable
- [ ] Serif italic renders on all page titles and onboarding hero
- [ ] Mono on shortcut keys, file paths, overlay timer, model names
- [ ] Toggle thumb has a satisfying bounce (feel-check, not measurable)
- [ ] Sidebar indicator slides smoothly between pages
- [ ] Page content cross-fades without layout jank
- [ ] Focus rings visible on every theme (Light / Warm / Dark / Black)
- [ ] All copy updates land correctly, no missed "Copy transcribed text to clipboard"-era strings
- [ ] Card → whitespace conversions don't break visual grouping (sections still feel distinct)
- [ ] Checkmark reveal animates on overlay complete
- [ ] Custom scrollbars visible (always on; no auto-hide)
- [ ] `prefers-reduced-motion: reduce` disables non-essential animation globally
- [ ] Per-key shortcut badges render `Cmd+Shift+D` as three pills + two `+`s
- [ ] `pnpm lint` clean
- [ ] Existing Playwright suite passes (copy changes may require test string updates — address as encountered)

---

## Out of Scope

- New animations in the overlay beyond what's in the overlay plan
- Additional theme variants beyond the four in the foundation plan
- Custom font upload
- Variable type-scale slider (one scale fits all)
- Sound design / haptic feedback (would be Phase 4)
- Animating the ambient backgrounds (drifting sunset, etc.)
- Dark onboarding screenshots embedded in the theme preview (use live-themed preview instead — cheaper to maintain)
