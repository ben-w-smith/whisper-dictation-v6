# Onboarding Redesign

**Date:** 2026-04-16
**Status:** Draft — depends on `themeable-foundation` Phase 1–2 and `editorial-polish` Phase 1 (tokens, motion, copy rubric). Do not execute until those are in place.
**Scope:** Rebuild `Onboarding.tsx` as a two-panel, choreographed experience with live demos. Split out from `editorial-polish.md` §6 because this is a feature, not polish.

---

## Problem

Current onboarding is a single-column list of permission prompts + model picker. Functional, but the user's first 60 seconds with the app are the moment we can set expectations for quality and tone — and right now that moment is forgettable. No demonstration of the overlay, no preview of what the app feels like, no emotional hook.

## Goals

- First-run should demonstrate, not describe. Users see the overlay in motion before they've recorded anything.
- A theme-picker step that re-themes the onboarding window itself on selection — sets the expectation that the app is yours to shape.
- Clear progress indication and reversibility on every step.
- Functional completeness: no regression on the permissions/model/shortcut setup the current onboarding already does.

## Non-Goals

- **No telemetry, analytics, or remote theme previews.** Everything renders locally.
- **No onboarding A/B variants.** Single flow.
- **No video or animated illustration files.** Demos are built from real components.
- **No step skipping for power users** in v1 — can revisit later.

---

## Dependencies

This plan assumes these are in place before Phase 1 starts:

| From plan | Needed artifact |
|-----------|-----------------|
| `themeable-foundation` Phase 1–2 | `data-theme` / `data-accent` wiring, all 4 themes in tokens.css, `useAppearance` hook |
| `editorial-polish` Phase 1 | Font loading, type scale, page-transition primitive |
| `editorial-polish` Phase 2 | Ease curves (`ease-spring-soft`), reduced-motion globals |
| `editorial-polish` §3.0 | Copy voice rubric |
| `overlay-border-beam` Phase 1–2 | (Preferred but not strictly required) `BeamPill` component — see Phase 3 fallback |

---

## Phases

### Phase 1 — Two-Panel Layout (MVP)

Rebuild `Onboarding.tsx` with the two-panel structure. Keep existing step logic (permissions, model, shortcut), but route each step through the new layout. Right panel is a static placeholder per step — no animation yet.

**Exit criteria:**
- Existing onboarding functionality preserved (permissions granted → model selectable → shortcut recordable → onboarding dismisses).
- All copy passes §3.0 rubric.
- Content animates between steps with a 400ms fade + 8px slide.
- Progress indicator visible at top.
- `pnpm lint`, `pnpm typecheck` clean.

### Phase 2 — Step-Specific Previews

Add the right-panel demos one by one. Each is its own commit and independently shippable.

1. **Welcome** — mini `BeamPill` on loop (recording → transcribing → complete, ~4s cycle).
2. **Permissions** — menu bar icon illustration with pulse + checkmark on grant.
3. **Shortcut** — live `ShortcutRecorder` mirror showing the captured combo rendered as keyboard keys.
4. **Theme** — four theme tiles. Hover re-themes the onboarding window (via `useAppearance.setTheme` on hover, reverts on leave if no selection).
5. **Ready** — serif "Done." with a one-shot beam pulse around the viewport edge.

**Exit criteria:**
- Each preview runs at 60fps on baseline hardware (Intel MacBook Air from 2020).
- Theme hover revert doesn't cause layout shift.
- Reduced-motion mode shows static previews (no loops, no pulses).

### Phase 3 — Polish & Edge Cases

- Back-navigation restores prior step's state (model selection, shortcut capture).
- Escape key on any step doesn't dismiss onboarding mid-flow (accidental dismissal protection).
- First-launch detection: onboarding appears once, not on every cold start.
- Deep-link to Appearance page works after onboarding completes.
- If `BeamPill` is not yet available, Welcome step falls back to a looping static overlay screenshot + subtle opacity pulse — ship Phase 1+2 without blocking on overlay plan.

**Exit criteria:**
- Acceptance criteria below all pass.

---

## Layout

```tsx
<div className="flex h-screen">
  {/* Left: content, padded generously */}
  <div className="flex-1 flex flex-col justify-center px-12 max-w-[520px]">
    <div className="text-label uppercase text-text-muted mb-3">
      Step {n} of {total}
    </div>
    <h1 className="text-display font-serif italic text-text-primary mb-5">
      {stepTitle}
    </h1>
    <p className="text-body text-text-secondary mb-8 leading-relaxed">
      {stepDescription}
    </p>
    <div className="mb-10">{stepContent}</div>
    <div className="flex items-center gap-3">
      <button className="ghost">Back</button>
      <button className="primary">Continue</button>
    </div>
  </div>

  {/* Right: live demo panel */}
  <div className="flex-1 bg-canvas flex items-center justify-center relative">
    {stepPreview}
  </div>
</div>
```

---

## Copy (against §3.0 rubric)

| Step | Title (serif italic, display) | Body |
|------|-------------------------------|------|
| Welcome | *"Your voice, transcribed."* | "Press a shortcut, speak, and your words land wherever you are typing. Local. Private. Fast." |
| Permissions | *"A few permissions."* | "macOS will ask for microphone and accessibility access. You'll need both to dictate into other apps." |
| Shortcut | *"Pick your shortcut."* | "A key combo, a mouse button, or both. You can change it later in General." |
| Theme | *"Make it yours."* | "Pick a look. You can fine-tune accents and radius later in Appearance." |
| Ready | *"Done."* | "Try it now — open any app and press your shortcut." |

Note R1 ("you/your never we") is followed throughout except the title "Done." which intentionally drops the pronoun for finality (R3).

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/src/components/Onboarding.tsx` | Full rewrite around two-panel layout and step router. |
| `src/renderer/src/components/onboarding/WelcomePreview.tsx` | **NEW.** Looping `BeamPill` demo. |
| `src/renderer/src/components/onboarding/PermissionsPreview.tsx` | **NEW.** Menu bar illustration + pulse animation. |
| `src/renderer/src/components/onboarding/ShortcutPreview.tsx` | **NEW.** Key-combo mirror of the user's captured shortcut. |
| `src/renderer/src/components/onboarding/ThemePreview.tsx` | **NEW.** Four theme tiles with hover re-theming. |
| `src/renderer/src/components/onboarding/ReadyPreview.tsx` | **NEW.** Serif heading + one-shot viewport beam pulse. |
| `src/renderer/src/components/Onboarding.stories.tsx` | Add stories per step. |
| `src/renderer/src/hooks/useAppearance.ts` | May need a `previewTheme(name)` escape hatch that doesn't persist — used by ThemePreview on hover. |

---

## Risks

- **Theme-hover re-themeing can feel janky if layout shifts between themes.** Audit themes for any padding/radius differences that would cause layout to reflow on swap. Tokens plan has constant spacing per theme, so this should be safe — verify before Phase 2.4 ships.
- **Mini BeamPill in WelcomePreview depends on BeamPill existing.** If overlay plan isn't landed, Phase 3 fallback (static screenshot + opacity pulse) keeps the ship unblocked.
- **First-launch detection logic.** Current code may already set a flag in `electron-store`. Audit and preserve it — a regression here would loop onboarding on every launch.
- **Accessibility.** Decorative previews must have `aria-hidden="true"`. All interactive content stays in the left panel with proper focus order.

---

## Acceptance Criteria

- [ ] Cold launch on a fresh profile lands on Welcome step.
- [ ] Welcome BeamPill (or fallback) loops smoothly; no visible frame drops.
- [ ] Permissions step detects mic + accessibility grant state and updates checkmark live.
- [ ] Shortcut step records a combo and the right-panel preview renders it as keys.
- [ ] Theme step: hovering a tile re-themes the window; releasing hover reverts; clicking persists.
- [ ] Ready step's viewport pulse runs once and onboarding dismisses.
- [ ] Completing onboarding sets the first-run flag; relaunching does not re-open it.
- [ ] Back button on every step restores the prior step's state.
- [ ] `prefers-reduced-motion: reduce`: static previews, no loops, no pulses.
- [ ] All copy passes §3.0 rubric (reviewed manually).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm run storybook` clean.
