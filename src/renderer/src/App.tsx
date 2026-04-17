import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useActorRef, useSelector } from '@xstate/react'
import { createPipelineMachine } from './state/pipelineMachine'
import { Overlay } from './components/Overlay'
import { Onboarding } from './components/Onboarding'
import { Home } from './views/Home'
import { getAudioCapture, type AudioCaptureResult } from './audio/capture'
import { IPC } from '@shared/ipc'
import { getDebugBus } from '@shared/debug'
import type { AppSettings, AppError } from '@shared/types'
import { DEFAULT_SETTINGS, WAVEFORM_GRADIENT, WAVEFORM_BAR_COUNT } from '@shared/constants'

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const handler = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return hash
}

function App(): React.ReactElement {
  const hash = useHash()
  const route = hash.replace(/^#\/?/, '') // "#settings" → "settings", "#/" → ""

  // Standalone pages (opened in their own windows)
  if (route === 'home' || route === 'settings') {
    return <Home />
  }
  if (route === 'about') {
    return <Home initialPage="about" />
  }
  if (route === 'onboarding') {
    return <OnboardingWindow />
  }
  if (route === 'overlay') {
    return <OverlayWindow />
  }

  // Hidden background window — runs the state machine and IPC listeners
  return <DictationApp />
}

/**
 * Onboarding page — runs in its own window, completes onboarding then closes
 */
function OnboardingWindow(): React.ReactElement {
  const [done, setDone] = useState(false)

  const handleComplete = useCallback(async () => {
    await window.api.invoke(IPC.SET_SETTING, 'onboardingComplete', true)
    setDone(true)
    // Close this window after a brief delay
    setTimeout(() => window.close(), 300)
  }, [])

  if (done) {
    return <div className="flex items-center justify-center h-screen text-text-secondary">Setup complete! You can close this window.</div>
  }

  return <Onboarding onComplete={handleComplete} />
}

/**
 * Overlay page — a tiny floating pill that shows recording status.
 * Receives state updates from the background window via IPC relay.
 * Uses rAF for waveform bars to bypass React rendering overhead.
 *
 * States:
 *   recording    → gradient waveform bars, click pill to stop
 *   transcribing → pulsing blue dot
 *   complete     → green checkmark, auto-dismisses after 500ms
 *   error        → orange warning dot, click to dismiss
 */
function OverlayWindow(): React.ReactElement {
  const [overlayState, setOverlayState] = useState<string>('idle')
  // Ref-based audio levels — updated directly, bypassing React state for zero-lag bars
  const audioLevelsRef = useRef<number[]>([])
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number>(0)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // rAF loop — scrolling equalizer: rightmost = newest, leftmost = oldest
  // Each bar gets a static gradient color; height updates from audio levels
  useEffect(() => {
    const tick = () => {
      const levels = audioLevelsRef.current
      const bars = barsRef.current
      for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
        const bar = bars[i]
        if (!bar) continue
        // Bar 0 = oldest, bar N-1 = newest (scrolling right)
        const levelIndex = levels.length - WAVEFORM_BAR_COUNT + i
        const level = levelIndex >= 0 ? (levels[levelIndex] ?? 0) : 0
        const height = Math.max(2, Math.min(16, level * 160))
        bar.style.height = `${height}px`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const unsubState = window.api.on('overlay:state-update', (data: unknown) => {
      const d = data as { state: string; audioLevels: number[]; elapsedMs: number; text: string; error: string; errorSuggestion?: string; errorCode?: string; refinementSkipped?: boolean }
      setOverlayState(d.state)
      // Write directly to ref for rAF — no React state update for audio levels
      audioLevelsRef.current = d.audioLevels

      // Auto-dismiss complete state after a brief display
      if (d.state === 'complete') {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = setTimeout(() => {
          window.api.send(IPC.OVERLAY_DISMISS, { action: 'COMPLETE_ACKNOWLEDGED' })
        }, 500)
      } else {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current)
          dismissTimerRef.current = null
        }
      }
    })

    // Signal to the background window that we're ready to receive state
    window.api.send(IPC.OVERLAY_READY)

    return () => {
      unsubState()
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [])

  const handleCancel = useCallback(() => {
    window.api.send(IPC.OVERLAY_CANCEL)
  }, [])

  const handleStop = useCallback(() => {
    window.api.send(IPC.OVERLAY_DISMISS, { action: 'STOP_RECORDING' })
  }, [])

  const handleClick = useCallback(() => {
    if (overlayState === 'complete') {
      window.api.send(IPC.OVERLAY_DISMISS, { action: 'COMPLETE_ACKNOWLEDGED' })
    } else if (overlayState === 'error') {
      window.api.send(IPC.OVERLAY_DISMISS, { action: 'ERROR_DISMISSED' })
    }
  }, [overlayState])

  if (overlayState === 'idle') return <></>

  return (
    <div
      className={`h-full flex items-center justify-center ${
        overlayState === 'complete' || overlayState === 'error' ? 'cursor-pointer' : ''
      }`}
      onClick={handleClick}
    >
      <div className="bg-stone-900/85 backdrop-blur-xl rounded-full shadow-2xl border border-gray-400/50 h-[32px] flex items-center justify-center">
        {overlayState === 'recording' && (
          <div className="flex items-center justify-between gap-2 px-1.5 h-full">
            {/* Cancel button (X) — gray matching border */}
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel() }}
              className="shrink-0 w-6 h-6 rounded-full bg-transparent hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Waveform bars */}
            <div className="flex items-center justify-center gap-[2px] flex-1 h-full">
              {[...Array(WAVEFORM_BAR_COUNT)].map((_, i) => (
                <div
                  key={i}
                  ref={(el) => { barsRef.current[i] = el }}
                  className="w-[2px] rounded-full transition-none"
                  style={{
                    backgroundColor: WAVEFORM_GRADIENT[i],
                    height: '2px',
                  }}
                />
              ))}
            </div>

            {/* Stop button — red with square */}
            <button
              onClick={(e) => { e.stopPropagation(); handleStop() }}
              className="shrink-0 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            >
              <div className="w-2 h-2 rounded-[1px] bg-white" />
            </button>
          </div>
        )}

        {overlayState === 'transcribing' && (
          <div className="flex items-center justify-center px-4 h-full">
            <div className="w-[6px] h-[6px] rounded-full bg-blue-400 animate-pulse" />
          </div>
        )}

        {overlayState === 'complete' && (
          <div className="flex items-center justify-center px-4 h-full">
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {overlayState === 'error' && (
          <div className="flex items-center justify-center px-4 h-full">
            <div className="w-[6px] h-[6px] rounded-full bg-orange-400" />
          </div>
        )}
      </div>
    </div>
  )
}

const pipelineMachine = createPipelineMachine()

function DictationApp(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [refinementSkipped, setRefinementSkipped] = useState(false)
  const actorRef = useActorRef(pipelineMachine)
  const state = useSelector(actorRef, (s) => s)
  const send = actorRef.send
  const audioCaptureRef = useRef(getAudioCapture())
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overlayAudioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const overlayStateRef = useRef<object | null>(null)
  const debugBus = useRef(getDebugBus())
  // Fast-path ref for audio levels - bypasses state machine to reduce overlay lag
  const latestAudioLevelsRef = useRef<number[]>([])
  const overlayModeRef = useRef<string>('hidden')
  // Phase 0 benchmark: overlay FPS counter
  const overlayFrameCountRef = useRef<number>(0)
  const overlayFpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Expose debug bus on window for MCP tool / DevTools access
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__debugBus = debugBus.current
  }, [])

  // Subscribe to state machine transitions and log to DebugBus
  useEffect(() => {
    const unsub = actorRef.subscribe((snapshot) => {
      debugBus.current.push('pipeline', 'state_change', {
        state: snapshot.value,
        context: {
          audioDurationMs: snapshot.context.audioDurationMs,
          audioLevels: snapshot.context.audioLevels.length,
          hasTranscription: !!snapshot.context.transcriptionText,
          error: snapshot.context.error?.code ?? null,
        },
      })
    })
    return unsub
  }, [actorRef])

  // Load settings and listen for IPC events
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await window.api.invoke(IPC.GET_SETTINGS) as AppSettings
        if (loaded) setSettings(loaded)
        setSettingsLoaded(true)
      } catch {
        setSettingsLoaded(true)
      }
    }
    loadSettings()

    const unsubSettings = window.api.on(IPC.SETTINGS_UPDATED, () => {
      loadSettings()
    })

    // Note: Both 'toggle' and 'push-to-talk' modes use the same behavior in MVP.
    // The HOTKEY_PRESSED event toggles recording state for both modes because
    // Electron's globalShortcut doesn't support key-up detection needed for true
    // push-to-talk. Future implementation with iohook would enable distinct behaviors.
    const unsubHotkey = window.api.on(IPC.HOTKEY_TRIGGERED, () => {
      debugBus.current.push('ipc', 'receive', { channel: IPC.HOTKEY_TRIGGERED })
      send({ type: 'HOTKEY_PRESSED' })
    })

    // Test-only hotkey: direct DOM event bypasses the main process IPC round-trip.
    // This lets E2E tests trigger recording from page.evaluate() without
    // needing the main process to relay the event back.
    const testHotkeyHandler = () => {
      debugBus.current.push('test', 'hotkey', {})
      send({ type: 'HOTKEY_PRESSED' })
    }
    window.addEventListener('__test_hotkey', testHotkeyHandler)

    // Force start from tray — only starts recording if idle, never stops an active recording
    const unsubForceStart = window.api.on(IPC.FORCE_START_RECORDING, () => {
      if (actorRef.getSnapshot().matches('idle')) {
        send({ type: 'HOTKEY_PRESSED' })
      }
    })

    const unsubResult = window.api.on(IPC.WHISPER_RESULT, (result: unknown) => {
      const r = result as { text: string; rawText?: string; transcriptionModel?: string; transcriptionDurationMs?: number; refinementModel?: string; refinementDurationMs?: number }
      console.log('[DictationApp] WHISPER_RESULT received:', {
        text: r.text?.substring(0, 60),
        rawText: r.rawText?.substring(0, 60),
        areDifferent: r.text !== r.rawText,
        transcriptionModel: r.transcriptionModel,
        transcriptionDurationMs: r.transcriptionDurationMs,
        refinementModel: r.refinementModel,
        refinementDurationMs: r.refinementDurationMs,
      })
      debugBus.current.push('whisper', 'result', { text: r.text, rawText: r.rawText })
      send({
        type: 'TRANSCRIPTION_SUCCESS',
        text: r.text,
        rawText: r.rawText ?? r.text,
        transcriptionModel: r.transcriptionModel,
        transcriptionDurationMs: r.transcriptionDurationMs,
        refinementModel: r.refinementModel,
        refinementDurationMs: r.refinementDurationMs,
      })
    })

    const unsubError = window.api.on(IPC.WHISPER_ERROR, (error: unknown) => {
      debugBus.current.push('whisper', 'error', error)
      send({
        type: 'TRANSCRIPTION_FAILURE',
        error: error as AppError,
      })
    })

    // Relay overlay dismiss events (click on complete/error) to the state machine
    const unsubDismiss = window.api.on(IPC.OVERLAY_DISMISS, (data: unknown) => {
      const d = data as { action: string }
      if (d.action === 'STOP_RECORDING') {
        send({ type: 'HOTKEY_PRESSED' })
      } else {
        send({ type: d.action as 'COMPLETE_ACKNOWLEDGED' | 'ERROR_DISMISSED' })
      }
    })

    // Relay overlay cancel (X button) to the state machine
    const unsubCancel = window.api.on(IPC.OVERLAY_CANCEL, () => {
      send({ type: 'CANCEL' })
    })

    // Show indicator when AI refinement was skipped due to failure
    const unsubRefinementSkipped = window.api.on(IPC.REFINEMENT_SKIPPED, () => {
      setRefinementSkipped(true)
      // Auto-clear after a few seconds
      setTimeout(() => setRefinementSkipped(false), 4000)
    })

    // When the overlay window mounts, push current state so it doesn't start blank
    const unsubOverlayReady = window.api.on(IPC.OVERLAY_READY, () => {
      if (overlayStateRef.current) {
        window.api.send('overlay:state-update', overlayStateRef.current)
      }
    })

    return () => {
      unsubSettings()
      unsubHotkey()
      unsubForceStart()
      unsubResult()
      unsubError()
      unsubDismiss()
      unsubCancel()
      unsubRefinementSkipped()
      unsubOverlayReady()
      window.removeEventListener('__test_hotkey', testHotkeyHandler)
    }
  }, [send])

  // Handle state machine transitions for audio capture
  useEffect(() => {
    const capture = audioCaptureRef.current

    if (state.matches('recording')) {
      capture.start(settings.microphoneDeviceId || undefined).then(() => {
        debugBus.current.push('audio', 'capture_start', {
          sampleRate: capture.getSampleRate(),
          deviceId: settings.microphoneDeviceId || 'default',
        })
        console.log('[DictationApp] Audio capture started successfully')
      }).catch((error: AppError) => {
        debugBus.current.push('audio', 'capture_error', { code: error.code, message: error.message })
        console.error('[DictationApp] Audio capture failed:', error.code, error.message)
        send({ type: 'TRANSCRIPTION_FAILURE', error })
      })

      if (settings.playSounds) {
        playTone(880, 150)
      }

      audioIntervalRef.current = setInterval(() => {
        const levels = capture.getLevels()
        const durationMs = capture.getDurationMs()
        // Update fast-path ref for overlay
        latestAudioLevelsRef.current = levels
        send({ type: 'AUDIO_DATA', levels, durationMs })
      }, 100)

      timerRef.current = setInterval(() => {
        setElapsedMs(capture.getDurationMs())
      }, 100)

      // Fast-path: send audio levels directly to overlay every 16ms (~60fps)
      // This bypasses the state machine's React batching for responsive waveform bars
      overlayFrameCountRef.current = 0
      overlayAudioIntervalRef.current = setInterval(() => {
        if (overlayModeRef.current === 'overlay') {
          overlayFrameCountRef.current++
          const levels = latestAudioLevelsRef.current
          const currentElapsed = capture.getDurationMs()
          // Send minimal update to overlay - only audio levels and elapsed time change during recording
          window.api.send('overlay:state-update', {
            state: 'recording',
            audioLevels: levels,
            elapsedMs: currentElapsed,
            text: '',
            error: '',
            errorSuggestion: '',
            errorCode: '',
            refinementSkipped: false,
          })
        }
      }, 16)

      // Phase 0 benchmark: report overlay FPS every 1 second
      overlayFpsIntervalRef.current = setInterval(() => {
        const fps = overlayFrameCountRef.current
        overlayFrameCountRef.current = 0
        debugBus.current.push('audio', 'timing', { event: 'overlay_fps', fps })
      }, 1000)
    } else if (state.matches('transcribing')) {
      // Play stop sound when recording ends
      if (settings.playSounds) {
        playDescendingTone(660, 440, 150)
      }

      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current)
        audioIntervalRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (overlayAudioIntervalRef.current) {
        clearInterval(overlayAudioIntervalRef.current)
        overlayAudioIntervalRef.current = null
      }
      if (overlayFpsIntervalRef.current) {
        clearInterval(overlayFpsIntervalRef.current)
        overlayFpsIntervalRef.current = null
      }

      capture.stop().then((result: AudioCaptureResult) => {
        send({ type: 'AUDIO_BUFFER_READY', buffer: result.samples })

        // Detect silent audio before sending to whisper
        if (result.peakLevel < 0.005) {
          console.warn('[DictationApp] Silent audio detected, peak RMS:', result.peakLevel.toFixed(4))
          debugBus.current.push('audio', 'silent_detected', { peakLevel: result.peakLevel, bufferCount: result.bufferCount })
          send({
            type: 'TRANSCRIPTION_FAILURE',
            error: {
              code: 'MICROPHONE_DENIED' as const,
              message: 'No audio detected',
              suggestion: 'Your microphone may not be working. Check that the correct device is selected in Settings → General and that microphone access is granted in System Settings.',
            } as AppError,
          })
          return
        }

        // Encode the resampled 16kHz audio as WAV
        const wavBuffer = float32ToWav(result.samples, result.sampleRate)
        const base64 = arrayBufferToBase64(wavBuffer)

        debugBus.current.push('audio', 'capture_stop', {
          samples: result.samples.length,
          sampleRate: result.sampleRate,
          durationSec: (result.samples.length / result.sampleRate).toFixed(1),
          wavSizeKB: (wavBuffer.byteLength / 1024).toFixed(0),
          base64KB: (base64.length / 1024).toFixed(0),
          peakLevel: result.peakLevel.toFixed(4),
          bufferCount: result.bufferCount,
        })

        console.log(`[DictationApp] WAV: ${result.samples.length} samples at ${result.sampleRate}Hz = ${(result.samples.length / result.sampleRate).toFixed(1)}s, ${(wavBuffer.byteLength / 1024).toFixed(0)}KB, peak: ${result.peakLevel.toFixed(4)}`)

        debugBus.current.push('ipc', 'send', { channel: IPC.START_WHISPER, model: settings.localModel, wavSizeKB: (wavBuffer.byteLength / 1024).toFixed(0) })

        // Phase 0 benchmark: emit IPC send timing with payload sizes
        debugBus.current.push('audio', 'timing', {
          event: 'ipc_sent',
          wavKB: (wavBuffer.byteLength / 1024).toFixed(0),
          base64KB: (base64.length / 1024).toFixed(0),
        })

        window.api.invoke(IPC.START_WHISPER, base64, settings.localModel).catch((error: unknown) => {
          send({ type: 'TRANSCRIPTION_FAILURE', error: error as AppError })
        })
      }).catch((error: unknown) => {
        send({ type: 'TRANSCRIPTION_FAILURE', error: error as AppError })
      })
    } else if (state.matches('complete')) {
      // Play completion chime when transcription finishes
      if (settings.playSounds) {
        playAscendingTone(880, 1100, 180)
      }

      const text = state.context.transcriptionText
      console.log('[DictationApp] Complete state:', {
        text: text?.substring(0, 60),
        rawText: state.context.rawTranscriptionText?.substring(0, 60),
        areDifferent: text !== state.context.rawTranscriptionText,
      })
      if (text) {
        if (settings.copyToClipboard) {
          window.api.invoke(IPC.WRITE_CLIPBOARD, text).catch(console.error)
        }

        if (settings.copyToClipboard && settings.autoPaste) {
          window.api.invoke(IPC.AUTO_PASTE).catch(console.error)
        }

        const entry = {
          id: crypto.randomUUID(),
          text,
          rawText: state.context.rawTranscriptionText,
          refinedWith: text !== state.context.rawTranscriptionText ? 'local-llm' : undefined,
          audioDurationMs: state.context.audioDurationMs,
          transcriptionProvider: 'local',
          timestamp: Date.now(),
          wordCount: text.split(/\s+/).filter(Boolean).length,
          transcriptionModel: state.context.transcriptionModel,
          transcriptionDurationMs: state.context.transcriptionDurationMs,
          refinementModel: state.context.refinementModel,
          refinementDurationMs: state.context.refinementDurationMs,
        }
        window.api.invoke(IPC.SAVE_HISTORY, entry).catch(console.error)
      }
    } else if (state.matches('idle') || state.matches('error')) {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current)
        audioIntervalRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (overlayAudioIntervalRef.current) {
        clearInterval(overlayAudioIntervalRef.current)
        overlayAudioIntervalRef.current = null
      }
      if (overlayFpsIntervalRef.current) {
        clearInterval(overlayFpsIntervalRef.current)
        overlayFpsIntervalRef.current = null
      }
      // Stop capture if it was left running (e.g. recording cancelled before
      // capture.start() resolved, or recordingTooShort guard fired to idle)
      if (capture.isActive()) {
        capture.stop().catch(() => {})
      }
      if (state.matches('idle')) {
        setElapsedMs(0)
        setRefinementSkipped(false)
      }
    }
  }, [state.value, send, settings.autoPaste, settings.copyToClipboard, settings.localModel, settings.playSounds])

  // Relay state to overlay window and manage overlay visibility
  const prevModeRef = useRef<string>('hidden')
  useEffect(() => {
    // Don't set window mode until settings are loaded
    if (!settingsLoaded) return

    let mode: string
    if (!settings.onboardingComplete) {
      mode = 'onboarding'
    } else if (state.matches('idle')) {
      mode = 'hidden'
    } else if (settings.showOverlay) {
      mode = 'overlay'
    } else {
      mode = 'hidden'
    }

    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode
      overlayModeRef.current = mode
      window.api.invoke(IPC.SET_WINDOW_MODE, mode).catch(() => {})
    }

    // Send state to overlay window via main process relay
    const overlayData = {
      state: state.value,
      audioLevels: state.context.audioLevels,
      elapsedMs,
      text: state.context.transcriptionText,
      error: state.context.error?.message ?? '',
      errorSuggestion: state.context.error?.suggestion ?? '',
      errorCode: state.context.error?.code ?? '',
      refinementSkipped,
    }
    overlayStateRef.current = overlayData
    // During recording, the fast-path interval (16ms) already sends audio levels.
    // Only send from here for state transitions (transcribing, complete, error).
    if (mode === 'overlay' && !state.matches('recording')) {
      window.api.send('overlay:state-update', overlayData)
    }

    // Update tray icon/tooltip to reflect current pipeline state
    window.api.send(IPC.UPDATE_TRAY_STATE, state.value)
  }, [settingsLoaded, settings.onboardingComplete, settings.showOverlay, state.value, state.context.transcriptionText, state.context.error, elapsedMs, refinementSkipped])

  if (!settings.onboardingComplete) {
    // Onboarding is handled by the dedicated OnboardingWindow (hash route)
    // Don't render Onboarding here — this is the hidden background window
    return null
  }

  return (
    <Overlay state={state} send={send} elapsedMs={elapsedMs} />
  )
}

/**
 * Play a macOS system sound for recording start feedback.
 * Uses "Tink" — a light, crisp ping. Feels like "I'm listening."
 */
function playTone(_frequency: number, _durationMs: number): void {
  playSystemSound('Tink')
}

/**
 * Play a macOS system sound for recording stop feedback.
 * Uses "Pop" — a soft pop. Feels like "got it."
 */
function playDescendingTone(_startFreq: number, _endFreq: number, _durationMs: number): void {
  playSystemSound('Pop')
}

/**
 * Play a macOS system sound for transcription complete feedback.
 * Uses "Glass" — a pleasant ding. Feels satisfying, like "done!"
 */
function playAscendingTone(_startFreq: number, _endFreq: number, _durationMs: number): void {
  playSystemSound('Glass')
}

/**
 * Play a macOS system sound by name.
 * System sounds are located at /System/Library/Sounds/ as AIFF files.
 * Uses HTMLAudioElement with a file:// URL — works in hidden Electron windows.
 */
function playSystemSound(name: string): void {
  try {
    const audio = new Audio(`file:///System/Library/Sounds/${name}.aiff`)
    audio.volume = 0.5
    audio.play().catch(() => {})
  } catch {
    // Silently fail — non-critical UI feedback
  }
}

function float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataSize = samples.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return buffer
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  const chunkSize = 0x8000 // 32KB chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)))
  }
  return btoa(chunks.join(''))
}

export default App
