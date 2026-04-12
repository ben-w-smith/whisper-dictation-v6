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
import { DEFAULT_SETTINGS } from '@shared/constants'

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
 * Overlay page — runs in a small frameless window, shows recording status
 * Receives state updates from the background window via IPC relay
 */
function OverlayWindow(): React.ReactElement {
  const [overlayState, setOverlayState] = useState<string>('idle')
  const [audioLevels, setAudioLevels] = useState<number[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [transcriptionText, setTranscriptionText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [errorSuggestion, setErrorSuggestion] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [refinementSkipped, setRefinementSkipped] = useState(false)

  useEffect(() => {
    const unsubState = window.api.on('overlay:state-update', (data: unknown) => {
      const d = data as { state: string; audioLevels: number[]; elapsedMs: number; text: string; error: string; errorSuggestion?: string; errorCode?: string; refinementSkipped?: boolean }
      setOverlayState(d.state)
      setAudioLevels(d.audioLevels)
      setElapsedMs(d.elapsedMs)
      setTranscriptionText(d.text)
      setErrorMessage(d.error)
      setErrorSuggestion(d.errorSuggestion ?? '')
      setErrorCode(d.errorCode ?? '')
      if (d.refinementSkipped !== undefined) {
        setRefinementSkipped(d.refinementSkipped)
      }
    })

    // Signal to the background window that we're ready to receive state
    window.api.send(IPC.OVERLAY_READY)

    return () => { unsubState() }
  }, [])

  const handleOverlayClick = useCallback(() => {
    if (overlayState === 'complete') {
      window.api.send(IPC.OVERLAY_DISMISS, { action: 'COMPLETE_ACKNOWLEDGED' })
    } else if (overlayState === 'error') {
      window.api.send(IPC.OVERLAY_DISMISS, { action: 'ERROR_DISMISSED' })
    }
  }, [overlayState])

  const handleOpenSettings = useCallback((pane: 'microphone' | 'accessibility') => {
    window.api.invoke(IPC.OPEN_SYSTEM_SETTINGS, pane).catch(console.error)
    window.api.send(IPC.OVERLAY_DISMISS, { action: 'ERROR_DISMISSED' })
  }, [])

  // Minimal overlay rendering
  if (overlayState === 'idle') return <></>

  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const elapsedFormatted = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`

  return (
    <div
      className={`h-full flex items-center justify-center ${
        overlayState === 'complete' || overlayState === 'error' ? 'cursor-pointer' : 'pointer-events-none'
      }`}
      onClick={handleOverlayClick}
    >
      <div className="bg-stone-900/85 backdrop-blur-xl rounded-full px-5 py-3 shadow-2xl border border-white/10 w-full">
        <div className="flex items-center justify-between">
          {overlayState === 'recording' && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative w-3 h-3">
                  <div className="absolute inset-0 bg-red-500 rounded-full animate-ping" />
                  <div className="absolute inset-0 bg-red-500 rounded-full" />
                </div>
                <span className="text-white/90 font-medium tabular-nums">{elapsedFormatted}</span>
              </div>
              <div className="flex items-end gap-0.5 h-4">
                {[...Array(5)].map((_, i) => {
                  const level = audioLevels[i] ?? 0
                  const height = Math.max(4, Math.min(16, level * 160))
                  return <div key={i} className="w-1 bg-red-400 rounded-full transition-all duration-75" style={{ height: `${height}px` }} />
                })}
              </div>
            </>
          )}
          {overlayState === 'transcribing' && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-white/90 text-sm">Transcribing...</span>
            </div>
          )}
          {overlayState === 'complete' && (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-white/90 font-medium">Copied</span>
              {refinementSkipped && (
                <span className="text-amber-400/80 text-xs ml-1" title="AI refinement was skipped due to an error">
                  (unrefined)
                </span>
              )}
            </div>
          )}
          {overlayState === 'error' && (
            <div className="flex items-start gap-2 w-full">
              <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-white/90 text-sm font-medium">{errorMessage || 'Error'}</div>
                {errorSuggestion && (
                  <div className="text-white/60 text-xs mt-0.5 leading-snug">{errorSuggestion}</div>
                )}
                {(errorCode === 'MICROPHONE_DENIED') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenSettings('microphone') }}
                    className="mt-1.5 text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2"
                  >
                    Open System Settings →
                  </button>
                )}
                {(errorCode === 'AUTO_PASTE_FAILED') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenSettings('accessibility') }}
                    className="mt-1.5 text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2"
                  >
                    Open System Settings →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
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
      const r = result as { text: string; rawText?: string }
      debugBus.current.push('whisper', 'result', { text: r.text, rawText: r.rawText })
      send({
        type: 'TRANSCRIPTION_SUCCESS',
        text: r.text,
        rawText: r.rawText ?? r.text,
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
      const d = data as { action: 'COMPLETE_ACKNOWLEDGED' | 'ERROR_DISMISSED' }
      send({ type: d.action })
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
        console.error('[DictationApp] Audio capture failed:', error)
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

      // Fast-path: send audio levels directly to overlay every 50ms (twice as fast)
      // This bypasses the state machine's React batching to reduce the 2-3 second lag
      overlayAudioIntervalRef.current = setInterval(() => {
        if (overlayModeRef.current === 'overlay') {
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
      }, 50)
    } else if (state.matches('transcribing')) {
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
          peakLevel: result.peakLevel.toFixed(4),
          bufferCount: result.bufferCount,
        })

        console.log(`[DictationApp] WAV: ${result.samples.length} samples at ${result.sampleRate}Hz = ${(result.samples.length / result.sampleRate).toFixed(1)}s, ${(wavBuffer.byteLength / 1024).toFixed(0)}KB, peak: ${result.peakLevel.toFixed(4)}`)

        debugBus.current.push('ipc', 'send', { channel: IPC.START_WHISPER, model: settings.localModel, wavSizeKB: (wavBuffer.byteLength / 1024).toFixed(0) })

        window.api.invoke(IPC.START_WHISPER, base64, settings.localModel).catch((error: unknown) => {
          send({ type: 'TRANSCRIPTION_FAILURE', error: error as AppError })
        })
      }).catch((error: unknown) => {
        send({ type: 'TRANSCRIPTION_FAILURE', error: error as AppError })
      })
    } else if (state.matches('complete')) {
      const text = state.context.transcriptionText
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
          audioDurationMs: state.context.audioDurationMs,
          transcriptionProvider: 'local',
          timestamp: Date.now(),
          wordCount: text.split(/\s+/).filter(Boolean).length,
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
    if (mode === 'overlay') {
      window.api.send('overlay:state-update', overlayData)
    }

    // Update tray icon/tooltip to reflect current pipeline state
    window.api.send(IPC.UPDATE_TRAY_STATE, state.value)
  }, [settingsLoaded, settings.onboardingComplete, settings.showOverlay, state.value, state.context.audioLevels, state.context.transcriptionText, state.context.error, elapsedMs, refinementSkipped])

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
 * Play a short beep tone for recording start/stop feedback.
 * Uses HTMLAudioElement with a WAV data URI instead of Web Audio API
 * because hidden windows don't produce audio output with AudioContext.
 */
function playTone(frequency: number, durationMs: number): void {
  try {
    // Generate a simple WAV beep as a data URI (880Hz for ~150ms)
    const sampleRate = 44100
    const numSamples = (sampleRate * durationMs) / 1000
    const wavData = generateWavData(frequency, numSamples, sampleRate)
    const audio = new Audio(`data:audio/wav;base64,${wavData}`)
    audio.volume = 0.3
    audio.play().catch(() => {
      // Silently fail — non-critical UI feedback
    })
  } catch {
    // Silently fail — non-critical UI feedback
  }
}

/**
 * Generate a WAV file as base64 data URI for a simple beep tone.
 * This works more reliably in hidden background windows than Web Audio API.
 */
function generateWavData(frequency: number, numSamples: number, sampleRate: number): string {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataSize = numSamples * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // WAV header
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

  // Generate sine wave samples with fade envelope to prevent clicking
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const phase = 2 * Math.PI * frequency * t
    // Fade in/out smoothly (10ms fade) to prevent clicking
    let envelope = 1
    const fadeSamples = sampleRate * 0.01
    if (i < fadeSamples) {
      envelope = i / fadeSamples
    } else if (i > numSamples - fadeSamples) {
      envelope = (numSamples - i) / fadeSamples
    }
    const sample = Math.sin(phase) * 0.5 * envelope
    const s16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
    view.setInt16(offset, Math.max(-32768, Math.min(32767, s16)), true)
    offset += 2
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)))
  }
  return btoa(chunks.join(''))
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
