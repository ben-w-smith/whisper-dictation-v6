# Whisper Dictation v6 — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Approach:** Electron + React + TypeScript + Vite

## Overview

macOS menu bar voice dictation app. Press a hotkey, speak, get text in your active app. Local transcription via bundled whisper.cpp by default. Optional cloud APIs for transcription and AI text refinement. Free, open source, no subscription, no account, no data leaves your Mac unless you explicitly enable cloud features.

This is v6. Versions 1-5 were built in Swift/SwiftUI and hit consistent walls: no runtime observability for AI assistants, deprecated Swift APIs, macOS permission complexity, and no automated testing capability. v6 uses Electron to unlock Playwright + Vitest for full AI-assisted development velocity.

## Design Principles

1. **Local-first**: On-device whisper.cpp transcription by default. Cloud features are optional, never required.
2. **Observable**: Playwright can interact with Electron renderers. Vitest tests the state machine. AI assistants can see and verify their work.
3. **Single state machine**: One XState `PipelineState`. No scattered booleans. No impossible states.
4. **Every setting works**: Every toggle wires to behavior. No dead controls ship.
5. **Errors are visible**: Every error shown to user with recovery suggestion. Graceful degradation — refinement and auto-paste failures are non-fatal.
6. **Single source of truth**: One settings model, one state machine, one history store, one tray UI.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Electron 41+ (Chromium 146, Node 24) | Desktop app shell |
| Renderer | React 19 + TypeScript 5 | UI framework |
| Build | electron-vite + Vite | HMR, bundling, TypeScript |
| State | XState v5 | Pipeline state machine |
| Styling | Tailwind CSS 4 | Design tokens, rapid iteration |
| Audio | Web Audio API + AudioWorklet | 16kHz PCM capture |
| Transcription | whisper.cpp (bundled binary) | Local speech-to-text |
| Auto-paste | nut.js | Cmd+V simulation |
| Storage | electron-store | Settings + history (JSON) |
| Keys | keytar | macOS Keychain for API keys |
| Testing | Vitest + Playwright | Unit + E2E |
| Packaging | electron-builder | .app bundle, auto-update |

## Architecture

```
Main Process (Node.js)          Renderer (React)
+---------------------------+   +---------------------------+
| index.ts  - App lifecycle |   | App.tsx  - Router/layout  |
| ipc.ts    - IPC handlers  |   | state/pipeline.ts - XState|
| tray.ts   - System tray   |   | audio/capture.ts - Web API|
| hotkeys.ts - globalShortcut|  | ipc/bridge.ts - IPC client|
| whisper.ts - child_process|   | views/ - Overlay, Settings|
| clipboard.ts - paste sim  |   | components/ - UI pieces   |
| store.ts  - electron-store|   | styles/ - Tailwind tokens |
| permissions.ts - macOS TCC|   +---------------------------+
+---------------------------+
            |                          |
            +---- IPC bridge ----------+
                   (typed channels)

shared/ - Types, IPC channels, constants (used by both)
bin/    - Bundled whisper.cpp binary (arm64)
```

### Data Flow

```
1. Hotkey pressed
   Main: globalShortcut detects key
   Main->Renderer: IPC HOTKEY_TRIGGERED

2. XState enters 'recording'
   Renderer: Web Audio API captures 16kHz PCM
   Renderer: Overlay shows levels + timer

3. Hotkey pressed again
   Main->Renderer: IPC HOTKEY_TRIGGERED
   XState exits 'recording', enters 'transcribing'
   Renderer->Main: IPC START_WHISPER (audio buffer)

4. Transcription
   Main: child_process.spawn('./bin/whisper-cpp', [...args])
   Main: Parse JSON stdout

5. Result
   Main->Renderer: IPC WHISPER_RESULT (text)

6. XState enters 'complete'
   Renderer->Main: IPC WRITE_CLIPBOARD
   Renderer->Main: IPC AUTO_PASTE (if enabled)
   Renderer->Main: IPC SAVE_HISTORY
   XState -> 'idle'
```

## State Machine

```typescript
// States: idle | recording | transcribing | error | complete
// Context: audioBuffer, audioDurationMs, audioLevels, transcriptionText, error, elapsedMs

idle --(HOTKEY_PRESSED)--> recording
recording --(HOTKEY_PRESSED / STOP)--> [audio < 0.5s ? idle : transcribing]
transcribing --(SUCCESS)--> complete
transcribing --(FAILURE)--> error
complete --(after 500ms)--> idle
error --(after 3000ms)--> idle
```

| State | Overlay | Tray | Transitions |
|-------|---------|------|-------------|
| `idle` | Hidden | Mic icon, gray | -> recording on hotkey |
| `recording` | Red dot, timer, audio bars | Mic icon, red | -> transcribing on stop, -> idle if < 0.5s |
| `transcribing` | Whimsical message, spinner | Spinner icon | -> complete on success, -> error on failure |
| `error` | Error + suggestion | Warning icon | -> idle after 3s |
| `complete` | Brief checkmark | Normal icon | -> idle after 0.5s |

## Settings (18 total)

```typescript
interface AppSettings {
  // Transcription
  transcriptionProvider: 'local' | 'openai' | 'google';
  localModel: 'tiny.en' | 'base.en' | 'small.en' | 'medium.en' | 'large-v3';
  openaiApiKey: string;           // Keychain
  googleApiKey: string;           // Keychain

  // Hotkey
  recordingMode: 'push-to-talk' | 'toggle';
  keyboardShortcut: string;       // Electron accelerator, e.g. 'Alt+Space'
  mouseButton: number | null;     // 3=back, 4=forward, null=disabled

  // Output
  autoPaste: boolean;
  copyToClipboard: boolean;

  // AI Refinement
  refinementEnabled: boolean;
  refinementProvider: 'openai' | 'anthropic' | 'google';
  refinementModel: string;
  refinementIntensity: 'light' | 'medium' | 'heavy';
  anthropicApiKey: string;        // Keychain

  // UI
  showOverlay: boolean;
  playSounds: boolean;

  // Onboarding
  onboardingComplete: boolean;
}
```

**Defaults:** local transcription, base.en model, toggle mode, Alt+Space shortcut, auto-paste enabled, overlay on, sounds on, refinement disabled.

## Data Models

```typescript
interface TranscriptionEntry {
  id: string;
  text: string;
  rawText: string;
  audioDurationMs: number;
  transcriptionProvider: string;
  refinedWith?: string;
  timestamp: number;
  wordCount: number;
}

interface AppError {
  code: ErrorCode;
  message: string;
  suggestion: string;
}

type ErrorCode =
  | 'MICROPHONE_DENIED'
  | 'MICROPHONE_NOT_FOUND'
  | 'RECORDING_TOO_SHORT'
  | 'TRANSCRIPTION_FAILED'
  | 'REFINEMENT_FAILED'
  | 'AUTO_PASTE_FAILED'
  | 'MODEL_NOT_FOUND'
  | 'API_KEY_MISSING'
  | 'API_REQUEST_FAILED';
```

## UI

### Windows

- **Tray icon**: Always present. Status dot color reflects state. Context menu with Start/Stop, Copy Last, Settings, Quit.
- **Overlay**: Floating BrowserWindow, top-center, ~420x48px pill shape. Semi-transparent with backdrop blur. Visible on all spaces including fullscreen. Ignores mouse events.
- **Settings**: Single BrowserWindow with sidebar navigation (General, Model, AI, History, About).

### Overlay States

- **Recording**: Red pulsing dot, elapsed timer (0:04), animated audio level bars
- **Transcribing**: Blue spinner, whimsical rotating messages ("Percolating your phonemes...", "Consulting the whispering void...", "Alphabetizing your utterances...")
- **Complete**: Green checkmark, "Copied" text, brief flash then hide
- **Error**: Orange warning, error message, auto-dismiss after 3s

### Settings Pages

| Page | Contents |
|------|----------|
| General | Auto-paste toggle, sounds toggle, overlay toggle, recording mode selector, shortcut recorder |
| Model | Local model picker (tiny/base/small/medium/large), download button + progress bar, cloud provider toggles with API key inputs |
| AI | Refinement toggle, provider picker (OpenAI/Anthropic/Google), model field, intensity selector, API key input |
| History | Search bar, transcription cards (text preview, timestamp, provider badge), clear all |
| About | Version, links, credits |

### Omni Shortcut Recorder

Single input field that captures keyboard combos AND/OR mouse buttons:
- Click to enter listening mode (accent border, pulsing glow)
- Press key combo -> captures, shows keycap display ("Option Space")
- Press mouse button -> captures, shows mouse icon ("Side Button 1")
- Click X or Escape -> clears binding
- Only one active at a time (keyboard XOR mouse)

### Onboarding (3 steps)

1. **Welcome**: App name, tagline, "Get Started" button
2. **Permissions + Shortcut**: Mic permission grant, Accessibility permission grant, shortcut recorder
3. **Model + Done**: Model picker (tiny/base/small), download progress, "Start Dictating" button

### Design Language

```css
--bg-canvas:     #fafaf9;        /* Warm off-white */
--bg-surface:    #ffffff;
--bg-overlay:    rgba(15,15,18, 0.85);  /* Dark glass */

--text-primary:  #1c1917;        /* Warm black */
--text-secondary:#78716c;
--text-muted:    #a8a29e;

--accent:        #0d9488;        /* Teal */
--accent-hover:  #0f766e;
--accent-subtle: #f0fdfa;

--border:        #e7e5e4;
--radius:        12px;
--spacing:       24px;
```

Typography: System font stack. Page titles 20px/600, body 14px/400, labels 12px/500 uppercase tracking. Line-height 1.6.

## Error Handling

Every error shown to user with recovery suggestion. Graceful degradation:

```
Full: record -> transcribe(local) -> refine(AI) -> auto-paste -> history
Degraded 1 (refinement fails): record -> transcribe -> [skip refine] -> auto-paste -> history
Degraded 2 (auto-paste fails): record -> transcribe -> refine -> [clipboard only] -> history
Degraded 3 (local unavailable): record -> transcribe(cloud) -> refine -> auto-paste -> history
Degraded 4 (nothing available): record -> error with guidance
```

Refinement and auto-paste failures are non-fatal. Only record+transcribe is a blocking path.

## Edge Cases

| Case | Behavior |
|------|----------|
| Recording < 0.5s | Silent discard, return to idle |
| Hotkey during transcription | Queue, start new recording after complete |
| No mic permission | Error overlay with Settings guidance |
| whisper.cpp binary missing | Error on transcription, download instructions |
| Recording > 5 min | No hard limit, warning at 5 min |
| System sleep during recording | Stop recording, discard, return to idle |
| Multiple monitors | Overlay on primary screen |

## Testing

- **Unit (Vitest)**: State machine transitions, whisper args, settings defaults, error mapping
- **E2E (Playwright for Electron)**: App lifecycle, overlay states, settings persistence, history, shortcut recorder, onboarding flow
- **Manual**: Audio recording + transcription, global hotkey from other apps, auto-paste in real apps, overlay above fullscreen

## IPC Channels

```typescript
export const IPC = {
  // Renderer -> Main
  START_WHISPER: 'whisper:start',
  WRITE_CLIPBOARD: 'clipboard:write',
  AUTO_PASTE: 'clipboard:paste',
  SAVE_HISTORY: 'history:save',
  GET_SETTINGS: 'settings:get',
  SET_SETTING: 'settings:set',
  GET_HISTORY: 'history:get',
  CHECK_PERMISSIONS: 'permissions:check',

  // Main -> Renderer
  WHISPER_RESULT: 'whisper:result',
  WHISPER_ERROR: 'whisper:error',
  HOTKEY_TRIGGERED: 'hotkey:triggered',
  SETTINGS_UPDATED: 'settings:updated',
} as const;
```

## Storage

| Data | Storage | Location |
|------|---------|----------|
| Settings | electron-store | ~/Library/Application Support/WhisperDictation/config.json |
| History | electron-store | ~/Library/Application Support/WhisperDictation/history.json |
| API keys | macOS Keychain | Via keytar |
| Audio temp | File system | /tmp/whisper-dictation/ (cleaned after 24h) |
| Models | File system | ~/Library/Application Support/WhisperDictation/models/ |

## Out of Scope for MVP

- Custom dictionary / auto-learn vocabulary
- Snippet expansion / voice shortcuts
- Context-aware per-app formatting
- Obsidian integration
- Statistics / achievements
- Voice commands ("new paragraph", "comma")
- Wake word detection
- Streaming real-time transcription
- Cross-platform (Windows/Linux)
- Code signing / notarization / App Store
- Auto-update
- Silero VAD for voice-activated recording

## Key Decisions Log

| Decision | Choice | Why |
|----------|--------|-----|
| Framework | Electron + React | AI velocity + observability (Playwright) |
| State | XState v5 | Visualizable state machine, no impossible states |
| Bundler | Vite (electron-vite) | HMR, fast builds, no SSR overhead |
| Transcription | whisper.cpp binary | Proven, fast, M3 Ultra < 1s for 5s audio |
| Hotkeys | Electron globalShortcut | Accept QWERTY-only for MVP simplicity |
| Auto-paste | nut.js | Requires Accessibility permission, proven library |
| Styling | Tailwind CSS | Fast iteration, consistent tokens |
| Storage | electron-store + keytar | JSON for data, Keychain for secrets |

## Lessons from v1-v5

- **v1 (Swift+Python)**: Subprocess communication is fragile. PyAudio install broken on Apple Silicon. No tests.
- **v2 (Swift)**: Tests disabled. 5 dead settings. Overlay state desync. 640+ lines dead code.
- **v3 (Swift)**: 75+ settings, god object AppState. Only 4/39 tests passing. Platform gaps in hotkeys and permissions.
- **v4/swiftscript (Swift)**: Lean but uncommitted fixes. Mouse shortcut recorder non-functional.
- **v5 (Swift)**: E2E blocked by model download. No runtime observability for AI assistants. Deprecated Swift APIs used by AI.

**Root cause across all versions**: Swift/SwiftUI lacks runtime observability for AI assistants. No way to programmatically verify UI state, test interactions, or course-correct during development. Electron + Playwright solves this.
