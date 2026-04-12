import { AUDIO_SAMPLE_RATE, AUDIO_CHANNELS, MIN_RECORDING_DURATION_MS } from '@shared/constants'
import { createError } from '@shared/errors'
import { IPC } from '@shared/ipc'

export interface AudioCaptureResult {
  /** PCM samples at exactly AUDIO_SAMPLE_RATE (16kHz) */
  samples: Float32Array
  /** Sample rate of the output (always AUDIO_SAMPLE_RATE) */
  sampleRate: number
  /** Peak RMS level during recording (0-1 range) */
  peakLevel: number
  /** Number of audio buffers captured */
  bufferCount: number
}

export class AudioCapture {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processorNode: ScriptProcessorNode | null = null
  private audioBuffers: Float32Array[] = []
  private startTime: number = 0
  private isRecording: boolean = false
  private currentLevels: number[] = []
  private levelBufferSize: number = 50
  private actualSampleRate: number = AUDIO_SAMPLE_RATE
  private mockInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Start audio capture from the microphone
   * @param deviceId - Optional specific microphone device ID to use
   * @throws AppError with MICROPHONE_DENIED or MICROPHONE_NOT_FOUND
   */
  async start(deviceId?: string): Promise<void> {
    if (this.isRecording) {
      return
    }

    // Test mock mode — generate silence buffers instead of capturing from mic
    if ((window as unknown as Record<string, unknown>).__testMockAudio) {
      this.actualSampleRate = AUDIO_SAMPLE_RATE
      this.startTime = Date.now()
      this.isRecording = true

      // Generate mock audio buffers with a small sine wave signal so that
      // peak-level detection doesn't reject the recording as silent.
      this.mockInterval = setInterval(() => {
        // 4096 samples with a small but detectable signal
        const mockBuffer = new Float32Array(4096)
        for (let i = 0; i < mockBuffer.length; i++) {
          mockBuffer[i] = 0.05 * Math.sin(2 * Math.PI * 440 * i / AUDIO_SAMPLE_RATE)
        }
        this.audioBuffers.push(mockBuffer)
        const rms = this.calculateRMS(mockBuffer)
        this.currentLevels.push(rms)
        if (this.currentLevels.length > this.levelBufferSize) {
          this.currentLevels.shift()
        }
      }, 256) // ~same cadence as real ScriptProcessorNode at 16kHz

      console.log('[Audio] Mock mode: generating silence buffers')
      return
    }

    // Ensure macOS TCC microphone permission is granted before calling getUserMedia.
    // On macOS 15, getUserMedia can succeed and return a live stream but deliver
    // all-zero audio until systemPreferences.askForMediaAccess() has been invoked.
    const micGranted = await window.api.invoke(IPC.REQUEST_MICROPHONE) as boolean
    if (!micGranted) {
      throw createError('MICROPHONE_DENIED')
    }

    try {
      // Build constraints — use specific device if provided, otherwise system default
      const audioConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId } }
        : {}

      const constraints: MediaStreamConstraints = {
        audio: {
          ...audioConstraints,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Log which device we're actually capturing from
      const track = this.mediaStream.getAudioTracks()[0]
      if (track) {
        console.log('[Audio] Capturing from:', track.label, 'settings:', track.getSettings())
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw createError('MICROPHONE_DENIED')
        }
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw createError('MICROPHONE_NOT_FOUND')
        }
      }
      throw createError('MICROPHONE_NOT_FOUND')
    }

    // Create audio context at the hardware's native rate (44100 or 48000 Hz on macOS).
    // Do NOT force 16kHz here — Chromium's internal resampler conflicts with
    // ScriptProcessorNode, causing onaudioprocess to fire with silent data.
    // The manual resampleAudio() call below handles the 16kHz conversion for whisper.
    this.audioContext = new AudioContext()

    this.actualSampleRate = this.audioContext.sampleRate
    console.log('[Audio] AudioContext sample rate:', this.actualSampleRate, 'state:', this.audioContext.state)

    // Ensure the context is running — it can start suspended when created
    // outside a user gesture (e.g., triggered by global hotkey via IPC)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
      console.log('[Audio] Resumed suspended AudioContext, state:', this.audioContext.state)
    }

    // Verify the context is actually running
    if (this.audioContext.state !== 'running') {
      console.error('[Audio] AudioContext is NOT running after resume! State:', this.audioContext.state)
      this.cleanup()
      throw createError('MICROPHONE_DENIED')
    }

    // Get the audio track
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)

    // Create script processor node (simpler than AudioWorklet for inline usage)
    // Using 4096 buffer size for good balance between latency and performance
    this.processorNode = this.audioContext.createScriptProcessor(4096, AUDIO_CHANNELS, AUDIO_CHANNELS)

    this.processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)

      // Store the audio data
      this.audioBuffers.push(new Float32Array(inputData))

      // Calculate RMS level for visualization
      const rms = this.calculateRMS(inputData)
      this.currentLevels.push(rms)

      // Keep only recent levels
      if (this.currentLevels.length > this.levelBufferSize) {
        this.currentLevels.shift()
      }
    }

    // Connect the graph — route through a zero-gain node to prevent
    // mic audio from playing through speakers, while keeping the
    // ScriptProcessorNode active (it won't fire without a destination connection)
    const silentGain = this.audioContext.createGain()
    silentGain.gain.value = 0
    source.connect(this.processorNode)
    this.processorNode.connect(silentGain)
    silentGain.connect(this.audioContext.destination)

    this.startTime = Date.now()
    this.isRecording = true

    console.log('[Audio] Recording started. AudioContext running at', this.actualSampleRate, 'Hz')
  }

  /**
   * Stop audio capture and return the complete audio buffer resampled to 16kHz
   * @returns AudioCaptureResult with PCM samples, sample rate, and diagnostics
   * @throws AppError if recording was too short
   */
  async stop(): Promise<AudioCaptureResult> {
    if (!this.isRecording) {
      throw new Error('Not recording')
    }

    // Clean up mock interval if in mock mode
    if (this.mockInterval) {
      clearInterval(this.mockInterval)
      this.mockInterval = null
    }

    const durationMs = this.getDurationMs()

    // Stop the audio processing
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }

    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    // Stop all media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    this.isRecording = false

    // Calculate peak level before clearing buffers
    const peakLevel = this.currentLevels.length > 0
      ? Math.max(...this.currentLevels)
      : 0

    // Log audio capture diagnostics
    const totalSamples = this.audioBuffers.reduce((sum, b) => sum + b.length, 0)
    console.log(`[Audio] Capture complete: ${this.audioBuffers.length} buffers, ${totalSamples} samples, ${durationMs}ms, peak RMS: ${peakLevel.toFixed(4)}`)

    // Check minimum duration
    if (durationMs < MIN_RECORDING_DURATION_MS) {
      this.audioBuffers = []
      this.currentLevels = []
      throw createError('RECORDING_TOO_SHORT')
    }

    // Concatenate all buffers into a single Float32Array
    const rawSamples = this.concatBuffers()

    // Resample to exactly 16kHz if the AudioContext used a different rate
    const samples = this.actualSampleRate !== AUDIO_SAMPLE_RATE
      ? resampleAudio(rawSamples, this.actualSampleRate, AUDIO_SAMPLE_RATE)
      : rawSamples

    const bufferCount = this.audioBuffers.length

    // Clear buffers
    this.audioBuffers = []
    this.currentLevels = []

    return {
      samples,
      sampleRate: AUDIO_SAMPLE_RATE,
      peakLevel,
      bufferCount,
    }
  }

  /**
   * Get current audio levels for visualization
   * @returns Array of RMS values (0-1 range)
   */
  getLevels(): number[] {
    return [...this.currentLevels]
  }

  /**
   * Get the AudioContext's actual sample rate (may differ from requested 16kHz)
   */
  getSampleRate(): number {
    return this.actualSampleRate
  }

  /**
   * Get elapsed recording time in milliseconds
   * @returns Duration in milliseconds
   */
  getDurationMs(): number {
    if (!this.isRecording) {
      return 0
    }
    return Date.now() - this.startTime
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.mockInterval) {
      clearInterval(this.mockInterval)
      this.mockInterval = null
    }
    if (this.isRecording) {
      this.stop().catch(() => {
        // Ignore errors during dispose
      })
    }
    this.audioBuffers = []
    this.currentLevels = []
  }

  /**
   * Internal cleanup for error cases during start()
   */
  private cleanup(): void {
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }
    this.audioBuffers = []
    this.currentLevels = []
  }

  /**
   * Concatenate all captured buffers into a single Float32Array
   */
  private concatBuffers(): Float32Array {
    const totalLength = this.audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const buffer of this.audioBuffers) {
      result.set(buffer, offset)
      offset += buffer.length
    }
    return result
  }

  /**
   * Calculate RMS (root mean square) of audio samples
   * Used for audio level visualization
   */
  private calculateRMS(samples: Float32Array): number {
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i]
    }
    return Math.sqrt(sum / samples.length)
  }
}

/**
 * Resample audio data from one sample rate to another using linear interpolation.
 * This ensures whisper.cpp always receives 16kHz audio regardless of the
 * AudioContext's actual sample rate (which may be 48kHz on macOS).
 */
function resampleAudio(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples

  const ratio = fromRate / toRate
  const newLength = Math.round(samples.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const floor = Math.floor(srcIndex)
    const ceil = Math.min(floor + 1, samples.length - 1)
    const t = srcIndex - floor
    result[i] = samples[floor] * (1 - t) + samples[ceil] * t
  }

  console.log(`[Audio] Resampled ${samples.length} samples from ${fromRate}Hz to ${toRate}Hz (${newLength} samples)`)
  return result
}

// Singleton instance
let captureInstance: AudioCapture | null = null

export function getAudioCapture(): AudioCapture {
  if (!captureInstance) {
    captureInstance = new AudioCapture()
  }
  return captureInstance
}
