# Agent Handoff Protocol

How to hand a plan from `docs/plans/` off to a coding agent (GLM 5, Claude Code, Cursor, Aider, etc.) so it executes faithfully, stays within scope, and leaves a clean commit history.

---

## Protocol (what any agent must follow)

1. **Read the plan file end-to-end first.** Including its `Pre-execution Review` section. Do not start writing code before confirming the plan's review items are resolved.
2. **Read the repo orientation.** At minimum: `CLAUDE.md` (build instructions), `docs/spec.md`, `docs/shortcut-architecture.md` (if touching shortcuts), `docs/plans/README.md` (sync points), and the plan's "Related" links.
3. **Post an execution outline before coding.** Summarize the phases, the files to be touched, and flag any cross-plan sync points (see [README § Cross-track sync points](./README.md#cross-track-sync-points)). Wait for human confirmation before starting Phase 1.
4. **Phase-by-phase execution.** For each phase: make the smallest set of changes that implements that phase only. Run verification commands. Commit.
5. **One commit per phase.** Subject: `[plan:<slug>] phase N: <summary>` (e.g. `[plan:window-id-addressing] phase 1: add window registry module`). Body: bullet list of changed files + rationale.
6. **Stop on blockers.** If the plan is ambiguous, missing a detail, or a change is riskier than expected — ask, don't improvise.
7. **Respect sync points.** Do not edit files listed in another plan's sync-point column without explicit approval.
8. **Verify before claiming done.** Run the acceptance checklist at the bottom of the plan. Post results.

---

## Verification commands

| Purpose | Command |
|---------|---------|
| Type-check | `pnpm run typecheck` |
| Unit tests (Vitest) | `pnpm test` |
| Lint | `pnpm lint` |
| Build (prod) | `pnpm build` |
| Run built app (with shortcuts + permissions) | `pnpm run app` |
| Dev mode (no global shortcuts / accessibility) | `pnpm dev` |
| E2E (Playwright for Electron) | `pnpm test:e2e` |
| Storybook | `pnpm storybook` |

**Important:** `pnpm dev` does **not** support global shortcuts or macOS accessibility permissions. Any plan touching hotkeys, accessibility-gated APIs, or system-level capture must verify via `pnpm run app`.

---

## Commit & safety rules

- Personal repo → use the `gcp` alias (personal commit/push) per user's git alias convention.
- **NEVER** force-push.
- **NEVER** `git commit --amend` a pushed commit.
- If tests fail after a phase commit, fix forward with a follow-up commit — don't rewrite history.
- **NEVER** update `git config`.
- **NEVER** commit `.env`, `.zshrc_api_keys`, or any credentials file. Warn the user if they ask.
- Don't run Codacy CLI on this project (per the user's preference).

---

## Reusable prompt template

Paste this into the agent. Replace `{{PLAN_FILE}}` and `{{PLAN_SLUG}}` with the target plan.

```
# Task

You are a senior TypeScript / Electron engineer working in the `whisper-dictation-v6`
repository at `/Users/bensmith/personal/whisper-dictation-v6`.

Your job is to execute the implementation plan at:

  docs/plans/{{PLAN_FILE}}

Slug for commits: `{{PLAN_SLUG}}`

# Repo at a glance

- macOS menu-bar voice-dictation app
- Electron 41 (Chromium 146, Node 24) + React 19 + TypeScript 5 + XState v5
- Package manager: pnpm (via Volta-managed Node)
- Native addons: iohook-macos (forked), nut.js, keytar, electron-store
- Transcription: bundled whisper.cpp binary; AI refinement via bundled llama-server
- Testing: Vitest (unit), Playwright for Electron (e2e), Storybook (UI dev)

# Required reading before you touch code

1. `docs/plans/{{PLAN_FILE}}` — your plan. Read ENTIRELY, including the
   "Pre-execution Review" section at the top.
2. `docs/plans/README.md` — especially the "Cross-track sync points" table.
   If your plan touches a file listed there, coordinate before editing.
3. `docs/plans/AGENT-HANDOFF.md` — execution protocol (this document).
4. `CLAUDE.md` — build and dev commands. Note: `pnpm dev` does NOT support
   global shortcuts or accessibility permissions; use `pnpm run app` for
   those tests.
5. `docs/spec.md` — product-level spec.
6. `docs/shortcut-architecture.md` — ONLY if your plan touches shortcuts.

# Rules of engagement

1. **Read first, outline second, code third.** After reading the plan and
   linked docs, POST an execution outline:
   - List the phases from the plan
   - For each phase, list the files you'll touch and the key changes
   - Flag any cross-plan sync-point files involved
   - Note any questions about ambiguous parts of the plan
   Then STOP and wait for confirmation before starting Phase 1.

2. **One phase at a time.** Complete Phase N fully — including tests —
   before starting Phase N+1.

3. **Smallest change that works.** Don't refactor unrelated code. Don't
   "improve" things outside the plan's scope. If you see something that
   should change, note it for a follow-up — don't do it now.

4. **Verification after each phase:**
     pnpm run typecheck
     pnpm test
   For phases that touch UI, also run:
     pnpm lint
   For phases that touch Electron main/renderer boundaries, also run:
     pnpm build
   For phases that touch hotkeys/audio/permissions, verify in a real app
   launch (tell the human to run `pnpm run app` — you can't launch it
   yourself for interactive verification).

5. **Commit per phase.** Format:
     [plan:{{PLAN_SLUG}}] phase N: short summary

     - file-a.ts: what changed + why
     - file-b.ts: what changed + why

6. **Stop on blockers.** If the plan is ambiguous, a dependency is missing,
   or a change is riskier than the plan suggests — STOP and ask. Do not
   improvise. Do not expand scope.

7. **Respect sync points.** If you need to touch a file listed in another
   plan's sync-point column (see `docs/plans/README.md`), STOP and ask.

8. **Never touch these:** `.env`, `.zshrc_api_keys`, any credentials file,
   git config. Never force-push. Never amend a pushed commit.

9. **Do not run Codacy CLI** (not installed; the user has opted out).

# Definition of done

- All phases in the plan are complete
- The plan's "Acceptance Criteria" checklist passes
- `pnpm run typecheck && pnpm test && pnpm lint` all green
- One commit per phase, clean subject lines
- Final status report posted with:
  - What landed (summary of each commit)
  - Any deviations from the plan and why
  - Any remaining follow-ups or deferred items

# Begin

Read the plan file, the README, and the handoff doc. Then post your
execution outline. Do not write any code yet.
```

---

## Starter prompt: `window-id-addressing`

The recommended first plan to execute. Ready to paste directly into the agent:

```
# Task

You are a senior TypeScript / Electron engineer working in the `whisper-dictation-v6`
repository at `/Users/bensmith/personal/whisper-dictation-v6`.

Your job is to execute the implementation plan at:

  docs/plans/2026-04-16-window-id-addressing.md

Slug for commits: `window-id-addressing`

# Repo at a glance

- macOS menu-bar voice-dictation app
- Electron 41 (Chromium 146, Node 24) + React 19 + TypeScript 5 + XState v5
- Package manager: pnpm (via Volta-managed Node)
- Native addons: iohook-macos (forked), nut.js, keytar, electron-store
- Transcription: bundled whisper.cpp binary; AI refinement via bundled llama-server
- Testing: Vitest (unit), Playwright for Electron (e2e), Storybook (UI dev)

# Required reading before you touch code

1. `docs/plans/2026-04-16-window-id-addressing.md` — your plan. Read ENTIRELY.
2. `docs/plans/README.md` — especially the "Cross-track sync points" table.
   `ipc.ts` is listed there; coordinate with other plans touching it.
3. `docs/plans/AGENT-HANDOFF.md` — execution protocol.
4. `CLAUDE.md` — build commands.
5. `src/main/ipc.ts`, `src/main/index.ts`, `src/main/tray.ts` — the files
   your plan primarily touches; read them before outlining.

# Rules of engagement

1. **Read first, outline second, code third.** After reading the plan and
   linked docs, POST an execution outline:
   - List the phases from the plan
   - For each phase, list the files you'll touch and the key changes
   - Call out every site in `ipc.ts` and `tray.ts` you plan to migrate
     (the plan has a table — confirm it's still accurate)
   - Note any questions about ambiguous parts of the plan
   Then STOP and wait for confirmation before starting Phase 1.

2. **One phase at a time.** Complete Phase N fully — including tests —
   before starting Phase N+1.

3. **Smallest change that works.** This plan is mechanical: create the
   registry, register windows at creation sites, replace title-based
   lookups, delete `page-title-updated` guards. Do not refactor unrelated
   code.

4. **Verification after each phase:**
     pnpm run typecheck
     pnpm test
   After Phase 3 and Phase 5 also:
     pnpm lint
     pnpm build

5. **Commit per phase.** Format:
     [plan:window-id-addressing] phase N: short summary

     - file-a.ts: what changed + why
     - file-b.ts: what changed + why

6. **Stop on blockers.** If the plan is ambiguous or a window-creation
   site doesn't match what the plan describes, STOP and ask.

7. **Do not touch** files that belong to Track B (design) plans:
   `ToggleSwitch.tsx`, `Home.tsx` (beyond what this plan needs),
   `tokens.css`, `ShortcutRecorder.tsx`, `Overlay.tsx`.

8. **Never touch:** `.env`, credentials files, git config. Never
   force-push. Never amend a pushed commit.

9. **Do not run Codacy CLI.**

# Definition of done

- `src/main/windows.ts` exists and has unit tests in `windows.test.ts`
- Zero usages of `BrowserWindow.getAllWindows().find(w => w.getTitle() === ...)`
  in `src/main/`
- Zero `page-title-updated` handlers in `src/main/`
- All `BrowserWindow.getAllWindows().forEach(...)` broadcasts replaced with
  `broadcast()` or `sendTo()`
- `pnpm run typecheck && pnpm test && pnpm lint && pnpm build` all green
- One commit per phase (5 phases total — see plan)
- Final status report posted

# Begin

Read the plan, README, and handoff doc. Then post your execution outline.
Do not write any code yet.
```

---

## Adapting to other agents

The template above is deliberately agent-agnostic. Notes for specific agents:

- **GLM 5 / GLM-4.6 (Z.ai)** — tends to drift on long tasks. The "outline then wait" gate is especially important. Consider running one phase per prompt turn rather than the full plan in one go.
- **Claude Code** — works well with the full template. Skills it ships with (TDD, systematic debugging) complement the plan's per-phase testing.
- **Cursor Agent** — paste the prompt into a new chat; the agent has file access by default.
- **Aider** — use `--read` for the plan file and `--file` for the files in the plan's Files-to-Modify table; the prompt goes in the initial message.

---

## After a plan lands

1. Flip the plan's **Status** from `Draft` → `Done`.
2. Update the at-a-glance table in `docs/plans/README.md`.
3. If the plan updated architecture docs (e.g. shortcut-unification updating `shortcut-architecture.md`), confirm those are landed too.
4. Note any deferred follow-ups in `docs/ROADMAP.md` or a new plan.
