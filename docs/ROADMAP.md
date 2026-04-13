# Whisper Dictation v6 — Roadmap

## Up Next

### ~~Custom Title Bar (Flush Design)~~ — Done

**Goal:** Replace the default macOS title bar with a custom frameless design where the close/minimize/maximize traffic lights integrate flush with the app's UI, similar to Wispr Flow.

**Why:** The default macOS chrome breaks the visual continuity of the settings/home window. A frameless window with inset traffic lights creates a polished, native-but-branded feel.

**Approach:**
- Use `titleBarStyle: 'hiddenInset'` on the settings BrowserWindow — this hides the title bar but keeps native traffic lights positioned with inset padding
- Alternatively, use `frame: false` with a custom draggable region (`-webkit-app-region: drag`) for full control over traffic light placement via `setWindowButtonPosition()`
- The sidebar and content area would extend into the title bar space, with traffic lights overlaying the top-left of the sidebar
- Requires adjusting the Home layout to account for the traffic light area (~70px from left, ~30px from top)

**Files:** `src/main/tray.ts` (window creation), `src/renderer/src/views/Home.tsx` (layout), `src/renderer/src/styles/` (drag regions)

**Reference:** Wispr Flow uses a frameless window with traffic lights flush against the app's own UI elements

---

### Specific Mouse Button Support

**Goal:** Allow users to bind individual mouse buttons (e.g., side button 1 vs side button 2) instead of treating all non-left/right clicks identically.

**Why:** Users with multi-button mice want granular control. The current iohook-macos addon maps all extra buttons to a single `otherMouseDown` event.

**Approach:**
- Fork `iohook-macos` native addon to expose `CGEventGetIntegerValueField(event, kCGMouseEventButtonNumber)` in the event payload
- Add a `button` field to the mouse event data (already has `x`, `y`, `type`)
- Update `src/main/hotkeys.ts` to filter events by specific button number
- Add UI in General settings for mouse button selection (show button number, not just "Side Button")

**Blocker:** Requires forking and maintaining a native Node.js addon (C++/Objective-C)

**Research:** Documented in `docs/mouse-shortcuts-implementation-brief.md`

---

---

### AI Refinement Performance (Qwen 3.5 0.8B)

**Goal:** Investigate and fix the ~13s refinement latency with the Qwen3.5-0.8B-Q4_K_M model.

**Why:** 13 seconds to refine a short transcription is too slow for real-time dictation. Suspicion: the llama.cpp server may be starting up fresh for each request instead of staying warm, or the model is being reloaded on each transcription.

**Investigate:**
- Check if llama-server is restarting between transcriptions (look at server lifecycle in `src/main/llama.ts`)
- Verify the server stays running after the first request completes
- Check if there's a keep-alive or idle timeout causing the server to shut down
- Benchmark a direct curl request to the llama-server to isolate network vs startup latency
- Consider switching to a smaller/faster model or quantization for refinement

**Files:** `src/main/llama.ts`, `src/main/ipc.ts` (refinement flow)

---

## Future Considerations

- **Streaming real-time transcription** — Show partial results as the user speaks
- **Voice commands** — "new paragraph", "comma", "period" auto-punctuation
- **Wake word detection** — Start recording on a spoken trigger phrase
- **Per-app formatting profiles** — Different post-processing for code editors vs messaging apps
- **Auto-update** — Sparkle or electron-updater integration
- **Code signing / notarization** — App Store distribution readiness
- **Cross-platform** — Windows and Linux support
