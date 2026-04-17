import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useActorRef, useSelector } from '@xstate/react'
import { createPipelineMachine } from './state/pipelineMachine'
import { Overlay } from './components/Overlay'
import { Onboarding } from './components/Onboarding'
import { Home } from './views/Home'
import { BeamPill } from './components/BeamPill'
import { OverlayInterior } from './components/OverlayInterior'
import { getAudioCapture, type AudioCaptureResult } from './audio/capture'
import { IPC } from '@shared/ipc'
import { getDebugBus } from '@shared/debug'
import type { AppSettings, AppError } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { useAppearance } from './hooks/useAppearance'

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const handler = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return hash
}

/**
 * Loads appearance settings and applies them via useAppearance.
 * No-ops when `enabled` is false (i.e. the overlay window) to avoid
 * unnecessary IPC traffic — the overlay is theme-independent per plan §3.5.
 */
function useAppearanceBridge(enabled: boolean) {
  const [appearanceSettings, setAppearanceSettings] = useState<AppSettings | null>(null)
  useEffect(() => {
    if (!enabled) return
    window.api.invoke(IPC.GET_SETTINGS).then((s) => {
      if (s) setAppearanceSettings(s as AppSettings)
    }).catch(() => {})
    const unsub = window.api.on(IPC.SETTINGS_UPDATED, () => {
      window.api.invoke(IPC.GET_SETTINGS).then((s) => {
        if (s) setAppearanceSettings(s as AppSettings)
      }).catch(() => {})
    })
    return unsub
  }, [enabled])
  useAppearance(enabled ? appearanceSettings : null)
}

function App(): React.ReactElement {
  const hash = useHash()
  const route = hash.replace(/^#\/?/, '') // "#settings" → "settings", "#/" → ""
  const isOverlay = route === 'overlay'

  // Overlay is theme-independent — skip all appearance IPC
  useAppearanceBridge(!isOverlay)

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
  const audioLevelsRef = useRef<number[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable ref-getter for BeamPill's rAF loop — reads from ref, no React re-renders
  const getAudioLevel = useCallback(() => {
    const levels = audioLevelsRef.current
    if (levels.length === 0) return 0
    return levels.reduce((a, b) => a + b, 0) / levels.length
  }, [])

  useEffect(() => {
    const unsubState = window.api.on('overlay:state-update', (data: unknown) => {
      const d = data as { state: string; audioLevels: number[]; elapsedMs: number; text: string; error: string; errorSuggestion?: string; errorCode?: string; refinementSkipped?: boolean }
      setOverlayState(d.state)
      audioLevelsRef.current = d.audioLevels
      if (d.elapsedMs !== undefined) setElapsedMs(d.elapsedMs)

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

  const beamState = overlayState as 'recording' | 'transcribing' | 'complete' | 'error'

  const timerSeconds = Math.floor(elapsedMs / 1000)
  const timerMinutes = Math.floor(timerSeconds / 60)
  const timerDisplay = `${timerMinutes}:${(timerSeconds % 60).toString().padStart(2, '0')}`

  return (
    <div
      className={`h-full flex items-center justify-center ${
        overlayState === 'complete' || overlayState === 'error' ? 'cursor-pointer' : ''
      }`}
      onClick={handleClick}
    >
      <BeamPill state={beamState} getAudioLevel={getAudioLevel}>
        <OverlayInterior
          beamState={beamState}
          timerDisplay={timerDisplay}
          timerMinutes={timerMinutes}
          timerSeconds={timerSeconds}
          onCancel={handleCancel}
          onStop={handleStop}
        />
      </BeamPill>
    </div>
  )
}

const pipelineMachine = createPipelineMachine()

function DictationApp(): React.ReactElement | null {
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
    const subscription = actorRef.subscribe((snapshot) => {
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
    // xstate .subscribe returns a Subscription object; React expects a void
    // cleanup function.
    return () => subscription.unsubscribe()
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

        // Send raw PCM via structured clone — no base64 encoding
        const pcmBytesKB = (result.samples.byteLength / 1024).toFixed(0)
        const estimatedWavKB = ((result.samples.byteLength + 44) / 1024).toFixed(0)

        debugBus.current.push('audio', 'capture_stop', {
          samples: result.samples.length,
          sampleRate: result.sampleRate,
          durationSec: (result.samples.length / result.sampleRate).toFixed(1),
          pcmSizeKB: pcmBytesKB,
          estimatedWavKB,
          peakLevel: result.peakLevel.toFixed(4),
          bufferCount: result.bufferCount,
        })

        console.log(`[DictationApp] PCM: ${result.samples.length} samples at ${result.sampleRate}Hz = ${(result.samples.length / result.sampleRate).toFixed(1)}s, ${pcmBytesKB}KB, peak: ${result.peakLevel.toFixed(4)}`)

        debugBus.current.push('ipc', 'send', { channel: IPC.START_WHISPER, model: settings.localModel, pcmSizeKB: pcmBytesKB })

        // Phase 0 benchmark: emit IPC send timing with payload sizes
        debugBus.current.push('audio', 'timing', {
          event: 'ipc_sent',
          pcmKB: pcmBytesKB,
        })

        window.api.invoke(IPC.START_WHISPER, {
          samples: result.samples.buffer,
          sampleRate: result.sampleRate,
          model: settings.localModel,
        }).catch((error: unknown) => {
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

export default App
