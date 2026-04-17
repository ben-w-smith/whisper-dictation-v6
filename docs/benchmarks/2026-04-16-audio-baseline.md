# Audio Pipeline Baseline Benchmarks

**Date:** 2026-04-16
**Hardware:** MacBook Pro (Apple Silicon)
**Branch:** audio-capture-modernization
**Phase:** 0 (pre-AudioWorklet baseline)

## How to collect

1. Build and open the app: `npm_config_python=/opt/homebrew/bin/python3.11 pnpm run app`
2. Open DevTools on the background window (via tray → Debug → Background Window)
3. Record at each duration (1s, 3s, 10s), 3 runs each
4. After each run, query the DebugBus in the DevTools console:
   ```js
   window.__debugBus.query({ source: 'audio', event: 'timing' })
   ```
5. Record the `deltaMs` and payload sizes below

## Metrics

| Metric | Description |
|--------|-------------|
| `tStart` | Hotkey press to first audio sample captured (ms) |
| `tStop` | Hotkey release to `stop()` completing — includes resample + concat (ms) |
| `tIPC` | Renderer `invoke(START_WHISPER)` to main process receiving (approximate) |
| `tWhisper` | whisper-cli runtime (ms) — logged in main process console |
| `wavKB` | WAV payload size before base64 |
| `base64KB` | Size after base64 encoding |
| `overlayFPS` | Audio level updates per second sent to overlay |

## Baseline Results

### 1-second recordings

| Run | tStart (ms) | tStop (ms) | tWhisper (ms) | wavKB | base64KB | overlayFPS |
|-----|-------------|------------|---------------|-------|----------|------------|
| 1   |             |            |               |       |          |            |
| 2   |             |            |               |       |          |            |
| 3   |             |            |               |       |          |            |

### 3-second recordings

| Run | tStart (ms) | tStop (ms) | tWhisper (ms) | wavKB | base64KB | overlayFPS |
|-----|-------------|------------|---------------|-------|----------|------------|
| 1   |             |            |               |       |          |            |
| 2   |             |            |               |       |          |            |
| 3   |             |            |               |       |          |            |

### 10-second recordings

| Run | tStart (ms) | tStop (ms) | tWhisper (ms) | wavKB | base64KB | overlayFPS |
|-----|-------------|------------|---------------|-------|----------|------------|
| 1   |             |            |               |       |          |            |
| 2   |             |            |               |       |          |            |
| 3   |             |            |               |       |          |            |

## Notes

- AudioContext sample rate: 48000 Hz (hardware native)
- Resample target: 16000 Hz (whisper.cpp requirement)
- Expected base64 overhead: ~33% larger than raw WAV
- tWhisper is measured in main process via `Date.now()` around `transcribeAudio()`
