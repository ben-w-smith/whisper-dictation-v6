export type LocalModel = 'tiny.en' | 'base.en' | 'small.en' | 'medium.en' | 'large-v3'
export type RefinementIntensity = 'light' | 'medium' | 'heavy'
export type LlamaServerStatus = 'stopped' | 'starting' | 'ready' | 'error' | 'crashed'

// Main settings model
export interface AppSettings {
  // Transcription
  localModel: LocalModel

  // Hotkey
  keyboardShortcuts: string[]
  mouseButton: number | null

  // Audio input
  microphoneDeviceId: string

  // Output
  autoPaste: boolean
  copyToClipboard: boolean

  // AI Refinement
  refinementEnabled: boolean
  refinementModelPath: string
  refinementIntensity: RefinementIntensity

  // UI
  showOverlay: boolean
  playSounds: boolean

  // Onboarding
  onboardingComplete: boolean
}

// Transcription history entry
export interface TranscriptionEntry {
  id: string
  text: string
  rawText: string
  audioDurationMs: number
  transcriptionProvider: string
  refinedWith?: string
  timestamp: number
  wordCount: number
}

// Pipeline state machine context
export interface PipelineContext {
  audioBuffer: Float32Array | null
  audioDurationMs: number
  audioLevels: number[]
  transcriptionText: string
  rawTranscriptionText: string
  error: AppError | null
  elapsedMs: number
}

// Pipeline states
export type PipelineState = 'idle' | 'recording' | 'transcribing' | 'complete' | 'error'

// Pipeline events
export type PipelineEvent =
  | { type: 'HOTKEY_PRESSED' }
  | { type: 'STOP' }
  | { type: 'CANCEL' }
  | { type: 'AUDIO_DATA'; levels: number[]; durationMs: number }
  | { type: 'AUDIO_BUFFER_READY'; buffer: Float32Array }
  | { type: 'TRANSCRIPTION_SUCCESS'; text: string; rawText: string }
  | { type: 'TRANSCRIPTION_FAILURE'; error: AppError }
  | { type: 'COMPLETE_ACKNOWLEDGED' }
  | { type: 'ERROR_DISMISSED' }

// App error with recovery suggestion
export interface AppError {
  code: ErrorCode
  message: string
  suggestion: string
}

export type ErrorCode =
  | 'MICROPHONE_DENIED'
  | 'MICROPHONE_NOT_FOUND'
  | 'RECORDING_TOO_SHORT'
  | 'TRANSCRIPTION_FAILED'
  | 'REFINEMENT_FAILED'
  | 'AUTO_PASTE_FAILED'
  | 'MODEL_NOT_FOUND'

// Permission status
export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'prompt'
  accessibility: 'granted' | 'denied' | 'prompt'
}

// Whisper process result
export interface WhisperResult {
  text: string
  language?: string
  confidence?: number
}

// Home window page
export type HomePage = 'general' | 'model' | 'ai' | 'history' | 'about'

// Overlay display state
export interface OverlayState {
  visible: boolean
  state: PipelineState
  elapsedMs: number
  audioLevels: number[]
  transcriptionText: string
  errorMessage: string
}
