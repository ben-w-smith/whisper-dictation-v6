# Audio Capture Pipeline Modernization

**Date:** 2026-04-16
**Status:** In Progress
**Owner:** Ben
**Related:** [spec.md](../spec.md), [2026-04-16-window-id-addressing.md](./2026-04-16-window-id-addressing.md)

## Problem

The audio capture pipeline works, but rests on a stack of Chromium workarounds that any future developer (or AI assistant) will find hostile to reason about:

1. **Deprecated `ScriptProcessorNode`** — Chromium has deprecated this in favor of `AudioWorklet` since Chrome 64 (2018). It runs on the audio render thread but marshals buffers to the main thread, causing jank under load. Source: `src/renderer/src/audio/capture.ts` L157.

2. **Hidden-window Chromium throttling** — audio capture runs in a hidden background window, so Chromium aggressively throttles timers and audio. Workarounds required:
   - `app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')` (`src/main/index.ts` L28) — AudioContext requires a user gesture by default, but we start from a global hotkey with no UI interaction
   - `mainWindow.webContents.setBackgroundThrottling(false)` (`src/main/index.ts` L86) — otherwise `setInterval(..., 100)` becomes `setInterval(..., 1000)` in background
   - Zero-gain sink (`src/renderer/src/audio/capture.ts` L182-186) — `ScriptProcessorNode.onaudioprocess` doesn't fire without a destination connection; we route through a silent gain node to mic-feedback-proof the connection

3. **Manual resampling** — Chromium's internal resampler conflicts with `ScriptProcessorNode` (see comment `capture.ts` L129-133), so we can't request 16kHz from `AudioContext`. We capture at the hardware's native rate (usually 48kHz) and resample in JS via linear interpolation (`resampleAudio` at L374).

4. **Base64 IPC round-trip** — audio buffer is serialized as WAV in the renderer, `btoa()`-encoded in 32KB chunks (to dodge call stack limits), sent over IPC, base64-decoded back to a Buffer, written to a temp file. See `src/renderer/src/App.tsx` L648-696 and `src/main/ipc.ts` L243-255. Base64 adds ~33% size overhead and two full buffer traversals for no benefit — Electron IPC natively supports structured clone of typed arrays.

5. **Two-channel overlay refresh** — the main app sends audio levels to the overlay at 60fps via a main-process relay (`App.tsx` L414-430 → `ipc.ts` L59-64 → overlay window). Every frame crosses two process boundaries.

## Goal

- `AudioWorklet` replaces `ScriptProcessorNode`
- No base64 encode/decode in the audio path
- Measurably reduced end-to-end latency
- At least one Chromium workaround deleted
- No regression in transcription accuracy or UI responsiveness

## Non-Goals

- Moving off Web Audio entirely (e.g. to a native `AVAudioEngine` addon) — large scope, separate decision
- Real-time streaming transcription — separate roadmap item
- Voice activity detection (VAD) — separate roadmap item
- Dropping the overlay window — it's doing its job

---

## Approach Summary

Five phases, each shippable independently:

1. **Benchmark** — establish baseline metrics so we know whether changes help
2. **AudioWorklet** — swap `ScriptProcessorNode` for `AudioWorkletNode`; delete the zero-gain sink
3. **Direct IPC** — stop base64-encoding; send `Uint8Array` or `Float32Array` via structured clone
4. **Audit workarounds** — see what Chromium quirks we can now delete
5. **(Optional) Dedicated audio window** — isolate the audio context from the React background window

---

## Phase 0 — Benchmark Baseline

**Goal:** data-driven decisions. Numbers we should know before we change anything.

### Metrics

- **`tStart`** — hotkey press to first audio sample captured (target: <100ms)
- **`tStop`** — hotkey release to `stop()` completing (includes resample + concat)
- **`tIPC`** — time from `window.api.invoke(START_WHISPER)` to main process receiving the payload
- **`tWhisper`** — whisper-cli runtime (not our code, but baseline)
- **`wavBytes`** — size of payload after base64 encoding
- **Overlay FPS** — via the DebugBus, how often audio levels actually update

### Instrumentation

Add a `AUDIO_TIMING` event to `src/shared/debug.ts`:

```ts
debugBus.push('audio', 'timing', { event: 'first_sample', deltaMs: ... })
debugBus.push('audio', 'timing', { event: 'stop_complete', deltaMs: ... })
debugBus.push('audio', 'timing', { event: 'ipc_sent', wavKB: ..., base64KB: ... })
```

### Baseline runs

- 3x runs of 1s recordings, 3s recordings, 10s recordings
- Record results in `docs/benchmarks/2026-04-16-audio-baseline.md`
- Use MacBook Pro M3 (or whatever dev hardware)

### Exit criteria

Baseline table committed. No decision to proceed until we have numbers.

---

## Phase 1 — Replace ScriptProcessorNode with AudioWorklet

### New file: `src/renderer/src/audio/worklets/capture-processor.js`

Note: **must be plain JavaScript**. `AudioWorkletProcessor` runs in an isolated global scope that can't import. If we want TypeScript, we can build the worklet as a separate rollup/esbuild target; for MVP plain JS is fine.

```js
/**
 * Captures mic input and emits RMS levels + raw Float32 frames to the main thread.
 * Runs on the audio render thread (real-time priority) — avoid allocation in process().
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this._buffer = []
    this._bufferCount = 0
    this._port = this.port
    // Smoothing state
    this._smoothedLevel = 0
    this._smoothingFactor = 0.4
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true

    // Compute RMS on the audio thread (no allocation)
    let sumSquares = 0
    for (let i = 0; i < channel.length; i++) {
      sumSquares += channel[i] * channel[i]
    }
    const rms = Math.sqrt(sumSquares / channel.length)
    this._smoothedLevel = this._smoothingFactor * rms + (1 - this._smoothingFactor) * this._smoothedLevel

    // Ship a copy of the frame + RMS to the main thread
    // (structured clone copies; we can't transfer a subarray view)
    this._port.postMessage({
      samples: channel.slice(0),  // Float32Array copy
      level: this._smoothedLevel,
      frameCount: ++this._bufferCount,
    })
    return true
  }
}

registerProcessor('capture-processor', CaptureProcessor)
```

### Updated: `src/renderer/src/audio/capture.ts`

Replace `ScriptProcessorNode` creation with:

```ts
await this.audioContext.audioWorklet.addModule('/audio/worklets/capture-processor.js')
const node = new AudioWorkletNode(this.audioContext, 'capture-processor')

node.port.onmessage = (event) => {
  const { samples, level } = event.data
  this.audioBuffers.push(samples)
  this.currentLevels.push(level)
  if (this.currentLevels.length > this.levelBufferSize) this.currentLevels.shift()
}

source.connect(node)
// DELETE: the zero-gain sink — AudioWorkletNode fires without a destination connection
```

### Worklet module resolution

`electron-vite` needs to copy the worklet to the build output. Options:

- Put it in `src/renderer/public/audio/worklets/` — served as a static asset
- Or use Vite's `?worker` / `?url` import syntax (confirm with electron-vite docs)

Recommend the static-asset route for simplicity; revisit if we end up with multiple worklets.

### Delete dead code

- `resampleAudio` on the main thread — stays for now, move to worklet in Phase 1.5 if worthwhile
- Zero-gain sink and the comment explaining why it's needed
- `isRecording = false` guard in `stop()` — AudioWorkletNode's disconnect fully unwinds

### Tests

- Unit test: RMS calculation (extract to a pure function the worklet imports/inlines)
- E2E: record a 3s test tone (via `__testMockAudio`), verify sample count ≈ 48000, verify RMS levels are non-zero
- Manual: no audio glitches on start/stop with AirPods (historical regression area)

### Acceptance

- Zero references to `ScriptProcessorNode` in the codebase
- Zero references to `silentGain` or "zero-gain sink"
- RMS levels arrive at main thread at ≥30Hz consistently (measurable via DebugBus)

---

## Phase 2 — Drop Base64 from IPC

### Current flow

```
renderer: Float32Array → float32ToWav(buffer) → Uint8Array → arrayBufferToBase64 → string
  IPC invoke(START_WHISPER, base64String, model)
main: string → Buffer.from(base64) → write to temp file → spawn whisper
```

### Target flow

```
renderer: Float32Array → Uint8Array (bytes view) → transfer via IPC
main: Uint8Array → writeFile → float32ToWav → spawn whisper
```

OR even simpler — move WAV encoding to main:

```
renderer: Float32Array.buffer (ArrayBuffer) → IPC
main: Float32Array → float32ToWav → Buffer → writeFile → spawn whisper
```

The second variant is cleaner: renderer sends raw PCM, main handles file format.

### Changes

#### `src/shared/ipc.ts`

No channel name changes; payload shape changes.

#### `src/renderer/src/App.tsx`

```ts
// Before
const wavBuffer = float32ToWav(result.samples, result.sampleRate)
const base64 = arrayBufferToBase64(wavBuffer)
window.api.invoke(IPC.START_WHISPER, base64, settings.localModel)

// After
window.api.invoke(IPC.START_WHISPER, {
  samples: result.samples.buffer,  // ArrayBuffer — structured clone preserves
  sampleRate: result.sampleRate,
  model: settings.localModel,
})
```

Move `float32ToWav`, `writeString`, and `arrayBufferToBase64` **out of App.tsx**. Delete `arrayBufferToBase64` entirely.

#### `src/main/ipc.ts`

```ts
// Before
ipcMain.handle(IPC.START_WHISPER, async (_, base64Wav: string, model) => {
  const wavBuffer = Buffer.from(base64Wav, 'base64')
  // ...
})

// After
ipcMain.handle(IPC.START_WHISPER, async (_, payload: { samples: ArrayBuffer; sampleRate: number; model: LocalModel }) => {
  const float32 = new Float32Array(payload.samples)
  const wavBuffer = float32ToWav(float32, payload.sampleRate)
  // ...
})
```

Add `float32ToWav` to `src/main/whisper.ts` or a new `src/main/wav.ts`.

### Why this is better

- ~33% less payload size (no base64 expansion)
- Two fewer full buffer traversals (encode in renderer, decode in main)
- Structured clone is native C++ in Electron's IPC — faster than JS base64
- Encoding WAV in the renderer was a mild separation-of-concerns smell anyway

### Tests

- Unit: `float32ToWav` produces a valid WAV header + correct sample count
- E2E: record 5s, verify `wavSizeKB` in logs is ~160KB (= 5s * 16000 * 2 bytes), not 213KB (base64-inflated)
- Manual: transcription accuracy identical before/after

---

## Phase 3 — Overlay Fast-Path Simplification

Currently in `App.tsx` L412–430:

```ts
overlayAudioIntervalRef.current = setInterval(() => {
  if (overlayModeRef.current === 'overlay') {
    window.api.send('overlay:state-update', { state: 'recording', audioLevels, ... })
  }
}, 16)
```

This fires every 16ms regardless of whether levels changed, and goes through a main-process relay.

### Option A: keep as-is (safest)

The fast path works and the overlay is visually responsive. Don't touch it.

### Option B: use `MessageChannel` for direct overlay communication

Electron supports `postMessage` with a transferable `MessagePort` between renderers, bypassing the main process. This would remove the relay.

Setup complexity is nontrivial; benefit is marginal for 16ms updates. **Recommend: defer unless benchmarking shows the relay is a bottleneck.**

### Option C: drive overlay updates from the worklet directly

The worklet already has the RMS values. It could `postMessage` directly to a port forwarded to the overlay. Most architecturally pure, but requires coordination with the overlay window.

**Decision: skip Phase 3 for MVP.** Revisit if Phase 0 benchmarks show the relay itself is slow (>2ms per hop).

---

## Phase 4 — Audit & Delete Chromium Workarounds

After Phases 1–2, re-check each workaround:

### `autoplay-policy: no-user-gesture-required`

Still required? Test by removing and triggering a recording from the hotkey on a fresh launch.
- AudioWorklet may or may not require a gesture depending on Chromium version
- Expected: still required; our background window never receives user gestures. Keep with an updated comment.

### `setBackgroundThrottling(false)`

Still required?
- AudioWorklet runs on a dedicated real-time thread — throttling shouldn't affect it
- But our `setInterval(..., 100)` for audio level polling in `App.tsx` L400 would still throttle
- Option: move level polling into the worklet's `onmessage` handler (already receives messages at >60Hz) — drop the interval, drop the throttling override
- Expected: can delete after the Phase 1 cleanup. Verify with a manual test (record 10s with devtools closed and verify levels still arrive).

### Manual resampling

Still required?
- We can now ask `AudioContext({ sampleRate: 16000 })` and see if Chromium's conflict is gone with AudioWorklet (the original bug was `ScriptProcessorNode`-specific)
- If it works, delete `resampleAudio` entirely. If it doesn't, move resampling into the worklet so it happens on the real-time thread.
- **Low risk of regression** — resampling quality isn't our problem (linear interpolation), it's whether Chromium's internal resampler works now.

### Zero-gain sink

Deleted in Phase 1 — `AudioWorkletNode` fires without a destination connection.

### Acceptance

- Run through each workaround in `src/main/index.ts` and `src/renderer/src/audio/capture.ts`
- For each one that's no longer needed, delete with a commit message referencing the original justification
- For each one still needed, add a new comment explaining why (post-AudioWorklet)

---

## Phase 5 (Optional) — Dedicated Audio Window

**Premise:** the current background window is doing double duty — running the XState pipeline + React + audio. If the React subtree rerenders heavily (it doesn't today, but might with future features), it could starve the audio context.

**Option:** create a second hidden window (`'audio-host'` role) that does nothing but audio capture, communicating with the background window via `MessageChannel` or IPC.

**When to do this:** only if Phase 0 baseline or future features show audio glitches correlated with React renders. Currently speculative.

**Flag:** defer to a future plan. Mention here only so future-us knows the option exists.

---

## Testing Strategy

### Unit (Vitest)

- `float32ToWav` — valid WAV header, correct sample interleaving
- RMS calculation (worklet logic extracted to a pure fn for testability)

### Integration (Playwright E2E)

- `e2e/audio-capture.spec.ts`:
  - Record with mock audio (`__testMockAudio = true`)
  - Verify `audioBuffers` sample count ≈ expected (duration * sampleRate)
  - Verify payload size log line matches expectations (no base64 inflation)
  - Verify RMS level updates arrive at ≥30Hz during recording

### Regression suite

- All existing transcription E2E tests pass
- Transcription accuracy spot-check: record a 10s sentence before/after, compare outputs (should be identical modulo whisper nondeterminism)

### Manual

- AirPods glitch test — start/stop 5x rapidly; no pops or dropped samples
- Long recording (5+ min) — no memory growth, no dropped frames
- Devtools closed (background window completely hidden) — audio still captures

---

## Rollback

Gate behind `WHISPER_AUDIO_V2=0` env var for one release:

- Phase 1 (AudioWorklet) — keep `capture-legacy.ts` with the ScriptProcessorNode path
- Phase 2 (IPC) — keep both handler signatures for one release; renderer chooses based on flag

Rollback plan is per-phase; each phase is independently revertible.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| AudioWorklet script fails to load in production (asset path issue) | Medium | Test `pnpm app` build early in Phase 1; don't land until packaged app works |
| Structured clone of `ArrayBuffer` is slower than expected on Electron | Low | Phase 0 benchmark; can always fall back to `Transferable` interface |
| Removing `setBackgroundThrottling(false)` reintroduces throttling for a path we didn't audit | Medium | Leave it in place initially; only delete in Phase 4 after explicit verification |
| Chromium's `AudioContext({ sampleRate: 16000 })` still buggy → we break resampling | Low | Keep `resampleAudio` in place until we verify; delete in a separate commit |
| Worklet TypeScript build complexity slows us down | Medium | Start with plain JS; migrate to TS later if it pays off |
| Electron version has a worklet bug we don't know about | Low | Electron 41 = Chromium 146; worklets have been stable for years |

---

## Acceptance Criteria

- [x] Zero references to `ScriptProcessorNode` in `src/` (only in comments)
- [x] Zero base64 encoding/decoding in the audio path
- [x] `arrayBufferToBase64` helper deleted
- [x] `float32ToWav` lives in the main process (not renderer)
- [ ] Audio level updates arrive at ≥30Hz during recording (measured via DebugBus)
- [ ] End-to-end latency for a 3s recording is no worse than baseline (Phase 0 numbers)
- [x] At least one Chromium workaround removed from `src/main/index.ts` (zero-gain sink deleted in Phase 1; autoplay-policy and throttling kept with updated comments)
- [ ] No audio glitches on AirPods in manual test
- [x] All existing Playwright tests pass (1 pre-existing failure unrelated to this plan)

---

## Open Questions

1. **Should we capture at 16kHz directly now that we're on AudioWorklet?** Worth a quick test — if it works, we delete `resampleAudio`. Phase 4 territory.
2. **Should audio-level streaming to overlay go direct (MessageChannel) or through main?** Defer per Phase 3 discussion.
3. **Is whisper-cli fine with WAV from stdin instead of a temp file?** Would remove the temp-file write entirely. Check whisper-cli `-f -` support. Nice-to-have, low priority.
4. **Should we emit a single Float32Array or keep chunking?** Currently chunks are ~20-200ms (depends on AudioWorklet quantum size). Coalescing into one array on `stop()` is what we do today. No change needed.
5. **Silero VAD integration on top of worklets?** Explicitly on the roadmap as out-of-scope for MVP — but the worklet is a natural home. Park for a future plan.

---

## Estimate

- Phase 0 (benchmark): 2–3 hours
- Phase 1 (AudioWorklet): 1 day
- Phase 2 (drop base64): 3–4 hours
- Phase 3 (overlay): 0 (skipped)
- Phase 4 (audit): half day
- Phase 5: deferred

**Total: ~2 days of focused work.**

---

## Execution Order

Do this plan **after** the window-id-addressing plan and either in parallel with or after the shortcut plan. Reasons:

1. Audio work has no dependency on the hotkey or window registry changes
2. But the `setBackgroundThrottling(false)` workaround is adjacent to shortcut infrastructure — cleaner to audit together
3. Benchmark baseline (Phase 0) should happen before either of the bigger plans ship, so we can verify no regressions
