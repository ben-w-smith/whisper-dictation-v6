# Implementation Plans

Phased, actionable plans for significant refactors and features. Unlike `spec.md` (what we're building) or `ROADMAP.md` (what's next), a plan here answers **how** we'll execute a specific change.

## Conventions

- **Filename:** `YYYY-MM-DD-<short-slug>.md` — date prefix keeps plans ordered chronologically.
- **Status:** Every plan opens with a `**Status:**` line (`Draft` → `Approved` → `In Progress` → `Done` → `Superseded`).
- **Phases:** Each plan is broken into phases that can ship independently. MVP first, polish later.
- **Tool-agnostic:** Plans live here (not in `.claude/` or `.cursor/`) so any agent or human can follow them.
- **Acceptance criteria:** Every plan ends with measurable exit conditions.

## Active Plans

### Track A — Platform / Architecture

| File | Status | One-liner |
|------|--------|-----------|
| [2026-04-16-window-id-addressing.md](./2026-04-16-window-id-addressing.md) | Done | Replace title-based IPC routing with a window registry keyed by role. |
| [2026-04-16-shortcut-unification.md](./2026-04-16-shortcut-unification.md) | Draft | Collapse `globalShortcut` + `iohook-macos` into one CGEventTap-backed state machine; add real push-to-talk. |
| [2026-04-16-audio-capture-modernization.md](./2026-04-16-audio-capture-modernization.md) | Draft | Move to `AudioWorkletNode`, drop base64 IPC, delete Chromium hidden-window workarounds. |

### Track B — Design / UX

| File | Status | One-liner |
|------|--------|-----------|
| [2026-04-16-themeable-foundation.md](./2026-04-16-themeable-foundation.md) | Draft | Introduce themes (Light / Warm / Dark / Black), accent swatches, radius slider, ambient background. |
| [2026-04-16-overlay-border-beam.md](./2026-04-16-overlay-border-beam.md) | Draft | Replace the overlay's internal waveform bars with an audio-reactive border beam. |
| [2026-04-16-editorial-polish.md](./2026-04-16-editorial-polish.md) | Draft | Typography, motion, copy voice, and onboarding moment polish. |

---

## Tandem Execution Model

The two tracks can run in parallel with explicit sync points. Neither track is blocked on the other overall — only specific files need coordination.

### Track A order

1. **`window-id-addressing`** — foundational, ~1 day, no deps. Do first.
2. **`shortcut-unification`** — depends on #1 for clean `sendTo('home', ...)`. ~2 weeks gated on Phase 0 spike.
3. **`audio-capture-modernization`** — independent of #1 and #2; can run in parallel from any point.

### Track B order

1. **`themeable-foundation`** — establishes new tokens; other design work depends on them.
2. **`overlay-border-beam`** — overlay is theme-independent, can start in parallel with #1.
3. **`editorial-polish`** — ship last; touches the most files and benefits most from the other two landing first.

### Cross-track sync points

Files that appear in multiple plans need a coordinated ordering so edits don't stomp on each other.

| File | Plans touching it | Recommended order |
|------|-------------------|-------------------|
| `src/renderer/src/components/ShortcutRecorder.tsx` | shortcut-unification (Phase 5: new capture API) · themeable-foundation (§4: hardcoded color fixup) · editorial-polish (§7: per-key pill rendering) | shortcut-unification first (functional change), then themeable (tokens), then editorial (pills) |
| `src/renderer/src/components/ToggleSwitch.tsx` | themeable-foundation (§4: `bg-toggle-off` token) · editorial-polish (§2.2: spring-bouncy thumb) | Do both in one commit — non-conflicting edits |
| `src/renderer/src/views/Home.tsx` | themeable-foundation (§3.1: Appearance nav entry) · editorial-polish (§1.4: serif header, §2.3 page transitions, §2.4 sliding indicator) | themeable first, editorial layers on top |
| `src/main/ipc.ts` | window-id-addressing (registry migration) · shortcut-unification (SET_SETTING handler simplification) · overlay-border-beam (§3: 240×32 → 260×44 window size) | window-id-addressing first, then overlay (small change), then shortcut-unification |
| `src/shared/constants.ts` | overlay-border-beam (remove `WAVEFORM_*`) · themeable-foundation (extend `DEFAULT_SETTINGS`) | Independent edits — coordinate per commit, no ordering constraint |
| `src/renderer/src/styles/tokens.css` | themeable-foundation (major restructure) · editorial-polish (type/motion/focus tokens) | themeable first, editorial adds on top |

---

## Review Status

A cross-plan review was performed 2026-04-16. Each plan has a **Pre-execution Review** section at the top with follow-ups to resolve before moving from `Draft` → `Approved`. Open the plan directly to see its checklist.

At-a-glance status:

| Plan | Status | Review items |
|------|--------|--------------|
| [window-id-addressing](./2026-04-16-window-id-addressing.md) | Draft — ready to execute | none |
| [shortcut-unification](./2026-04-16-shortcut-unification.md) | Draft — Phase 0 spike gates Phase 1 | none |
| [audio-capture-modernization](./2026-04-16-audio-capture-modernization.md) | Draft — Phase 0 baseline first | none |
| [themeable-foundation](./2026-04-16-themeable-foundation.md) | Draft — address review | 6 items |
| [overlay-border-beam](./2026-04-16-overlay-border-beam.md) | Draft — address review | 4 items |
| [editorial-polish](./2026-04-16-editorial-polish.md) | Draft — address review (esp. scope split) | 6 items |

---

## Agent Handoff

See [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) for the execution protocol, verification commands, commit conventions, and a reusable prompt template to hand any plan off to a coding agent.

---

## Relationship to Other Docs

- [`spec.md`](../spec.md) — product spec
- [`ROADMAP.md`](../ROADMAP.md) — priorities + future ideas
- [`shortcut-architecture.md`](../shortcut-architecture.md) — current hotkey system reference (to be updated by shortcut-unification)
- [`superpowers/specs/`](../superpowers/) — agent-workflow design artifacts (specs that predate this plans directory)
