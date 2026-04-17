import type { AppSettings } from './types'

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  localModel: 'base.en',
  keyboardShortcuts: ['Command+Shift+D'],
  mouseButton: null,
  microphoneDeviceId: '',
  autoPaste: true,
  copyToClipboard: true,
  refinementEnabled: false,
  refinementModelPath: '',
  refinementModelSource: 'downloaded',
  refinementIntensity: 'medium',
  showOverlay: true,
  playSounds: true,
  onboardingComplete: false,
  dictionary: [],
  theme: 'warm',
  accent: 'teal',
  radiusScale: 1.0,
  ambient: 'none',
  followSystemTheme: false,
}

// Audio
export const AUDIO_SAMPLE_RATE = 16000
export const AUDIO_CHANNELS = 1
export const MIN_RECORDING_DURATION_MS = 500
export const WARNING_RECORDING_DURATION_MS = 300000 // 5 min

// Whisper
export const WHISPER_BIN_PATH = 'bin/whisper-cpp'
export const MODEL_DIR = 'models'

// Llama
export const LLAMA_BIN_PATH = 'bin/llama-server'
export const LLAMA_SERVER_PORT = 8081
export const LLAMA_CTX_SIZE = 4096

// GGUF model storage
export const GGUF_MODEL_DIR = 'models/gguf'
export const GGUF_META_FILE = 'gguf-meta.json'

// UI timing
export const COMPLETE_DISPLAY_MS = 500
export const ERROR_DISPLAY_MS = 8000

// Overlay waveform gradient colors (left to right across 16 bars)
export const WAVEFORM_GRADIENT = [
  '#14b8a6', '#2dd4bf', '#5eead4', '#6ee7b7',
  '#a78bfa', '#8b5cf6', '#7c3aed', '#a855f7',
  '#c084fc', '#d946ef', '#e879f9', '#ec4899',
  '#f472b6', '#fb7185', '#fda4af', '#fecdd3',
] as const

export const WAVEFORM_BAR_COUNT = 16

// Design tokens
export const DESIGN_TOKENS = {
  color: {
    bgCanvas: '#fafaf9',
    bgSurface: '#ffffff',
    bgOverlay: 'rgba(15, 15, 18, 0.85)',
    textPrimary: '#1c1917',
    textSecondary: '#78716c',
    textMuted: '#a8a29e',
    accent: '#0d9488',
    accentHover: '#0f766e',
    accentSubtle: '#f0fdfa',
    border: '#e7e5e4',
    recording: '#ef4444',
    transcribing: '#3b82f6',
    complete: '#22c55e',
    error: '#f97316',
  },
  radius: '12px',
  spacing: '24px',
} as const

// Storage paths
export const APP_NAME = 'WhisperDictation'
export const CONFIG_FILE = 'config.json'
export const HISTORY_FILE = 'history.json'

// Refinement prompts by intensity
export const REFINEMENT_PROMPTS: Record<string, string> = {
  light: 'You are a transcription proofreader. Fix only obvious typos and punctuation errors. Preserve the original wording and style exactly. Output ONLY the corrected text. Do not explain, do not offer options, do not add commentary.',
  medium: 'You are a transcription proofreader. Fix typos, punctuation, and obvious grammar errors. Improve sentence structure while keeping the original meaning and tone. Output ONLY the corrected text. Do not explain, do not offer options, do not add commentary.',
  heavy: 'You are a transcription proofreader. Fix all errors, improve grammar, restructure sentences for clarity and flow. Make the text professional and polished while preserving the original meaning. Output ONLY the corrected text. Do not explain, do not offer options, do not add commentary.',
}
