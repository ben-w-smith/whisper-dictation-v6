# Feature: Whisper Dictation v6

## Meta
- ID: whisper-v6
- Status: active
- Created: 2026-04-09

## Task
Build macOS menu bar voice dictation app. Electron + React + TypeScript + Vite. Local whisper.cpp transcription. XState state machine. 7 phases.

## Spec
- Full spec: `docs/spec.md`
- Original: `/Users/bensmith/whisper-dictation-v4/docs/superpowers/specs/2026-04-09-whisper-dictation-v6-design.md`

## Build Roadmap

### Phase 1: Scaffold
- Status: in_progress
- Assignee: lead
- electron-vite + React + TypeScript + Tailwind, tray icon, clean quit

### Phase 2: Foundation
- Status: pending
- Depends on: Phase 1
- Assignee: lead
- shared/ types, IPC channels, constants, errors

### Phase 3: State Machine
- Status: pending
- Depends on: Phase 2
- Assignee: builder-state
- XState pipeline machine, tests first

### Phase 4: Core Pipeline
- Status: pending
- Depends on: Phase 3
- Assignee: builder-pipeline
- Audio capture, whisper.cpp, clipboard, store, IPC bridge

### Phase 5: Main Process Services
- Status: pending
- Depends on: Phase 2
- Assignee: builder-main
- Tray, hotkeys, permissions, IPC handlers

### Phase 6: UI
- Status: pending
- Depends on: Phase 4, Phase 5
- Assignee: builder-ui
- Overlay, Settings, History, Shortcut recorder, Onboarding

### Phase 7: Integration + Packaging
- Status: pending
- Depends on: Phase 6
- Assignee: lead
- E2E tests, electron-builder, full pipeline verification

## Parallel Execution Plan

```
Lead: Phase 1 → Phase 2
         ↓
    ┌─ builder-state: Phase 3 ───→ builder-pipeline: Phase 4 ─┐
    └─ builder-main: Phase 5 ─────────────────────────────────┤
                                                               ↓
                                                    builder-ui: Phase 6
                                                               ↓
                                                    Lead: Phase 7
```

## Progress Log
- 2026-04-09: Feature started
- 2026-04-09: Phase 1 scaffold begun (lead)
