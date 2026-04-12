# Visual Observability Infrastructure

**Date:** 2026-04-12
**Status:** Draft

## Goal

Enable autonomous AI-driven visual iteration: provide design mockup screenshots, let an AI agent work overnight to match them via a tight screenshot-diff-edit loop.

## Scope

- Rename "Settings" view to "Home" (file names, types, navigation labels, component names)
- Set up Storybook for isolated component iteration
- Add stories with realistic mock fixtures for all visual components
- Create `design/` directory with naming convention for mockup PNGs
- Add `pnpm screenshot` script for full-app Playwright captures

**Out of scope:** Popover/overlay automation, CI integration, cloud visual regression services.

## Architecture

### Storybook as the Primary Iteration Surface

Storybook runs as a plain browser tab — no Electron, no IPC, just React + Tailwind. This gives the fastest possible feedback loop:

```
Edit component → Storybook HMR (~instant) → screenshot → compare to mockup → repeat
```

Each visual component gets stories covering its key states. Stories hardcode props — no IPC plumbing needed.

### Component Coverage

| Component | Key Stories |
|-----------|-------------|
| Home (formerly Settings) | Each sub-page: general, model, ai, history, about |
| GeneralPage | Default state, custom shortcut configured, various recording modes |
| ModelPage | Model selected, model downloading, no models available |
| AIPage | Refinement enabled/disabled, intensity levels, server status states |
| HistoryPage | Empty state, populated list, single entry |
| AboutPage | Default |
| Overlay | idle, recording, transcribing, complete, error |
| Onboarding | Each step |
| ToggleSwitch | On, off, disabled |
| ShortcutRecorder | Idle, recording, recorded |

### Mock Fixtures

Stories import from a shared `src/renderer/src/__fixtures__/` directory containing realistic data:

- `settings.ts` — fully populated `AppSettings` object
- `transcriptions.ts` — array of `TranscriptionEntry` objects with varied content
- `pipeline.ts` — context objects for each pipeline state

### Design Mockup Convention

```
design/
  home-general.png
  home-model.png
  home-ai.png
  home-history.png
  home-about.png
  overlay-idle.png
  overlay-recording.png
  overlay-transcribing.png
  overlay-complete.png
  onboarding-step-1.png
  onboarding-step-2.png
  onboarding-step-3.png
```

Naming: `{component}-{state}.png`. AI pairs `design/overlay-recording.png` against the `Overlay--Recording` Storybook story.

### Full-App Screenshot Script

`pnpm screenshot` runs Playwright against the full Electron app to capture states that need real context (permissions, actual window chrome). Outputs to `screenshots/current/`. This is secondary to Storybook — only needed for integration-level visual checks.

## Rename Plan: Settings → Home

- `Settings.tsx` → `Home.tsx`, component `Settings` → `Home`
- `src/renderer/src/views/settings/` → `src/renderer/src/views/home/`
- `SettingsPage` type → `HomePage` type (in shared/types.ts)
- All navigation labels, imports, IPC channels updated
- User-facing header text: "Settings" → "Home"

## Technical Details

- **Storybook:** `@storybook/react-vite` with `@storybook/addon-essentials`
- **Vite integration:** Storybook reuses the renderer Vite config (React plugin, Tailwind, path aliases)
- **Tailwind v4:** Works with `@tailwindcss/vite` — Storybook's Vite builder picks it up automatically
- **No decorator complexity:** Stories are plain React components with hardcoded props

## Success Criteria

- `pnpm storybook` launches and shows all component stories
- Each story renders correctly with realistic mock data
- `design/` directory exists with naming convention documented
- `pnpm screenshot` captures full-app screenshots
- An AI agent can: open a story, screenshot it, compare to a mockup in `design/`, edit the component, and see the result via HMR
