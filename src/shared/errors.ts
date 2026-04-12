import type { AppError, ErrorCode } from './types'

const ERROR_DEFINITIONS: Record<ErrorCode, { message: string; suggestion: string }> = {
  MICROPHONE_DENIED: {
    message: 'Microphone access was denied',
    suggestion: 'Open System Settings > Privacy & Security > Microphone and enable Whisper Dictation.',
  },
  MICROPHONE_NOT_FOUND: {
    message: 'No microphone found',
    suggestion: 'Connect a microphone and try again.',
  },
  RECORDING_TOO_SHORT: {
    message: 'Recording was too short',
    suggestion: 'Hold the hotkey longer or speak for at least half a second.',
  },
  TRANSCRIPTION_FAILED: {
    message: 'Transcription failed',
    suggestion: 'Make sure the whisper model is downloaded. Try a smaller model or check the model settings.',
  },
  REFINEMENT_FAILED: {
    message: 'AI refinement failed',
    suggestion: 'llama-server is not running or the refinement model is not loaded. Raw transcription used instead.',
  },
  AUTO_PASTE_FAILED: {
    message: 'Auto-paste failed',
    suggestion: 'Grant Accessibility permission in System Settings > Privacy & Security. Text was copied to clipboard.',
  },
  MODEL_NOT_FOUND: {
    message: 'Whisper model not found',
    suggestion: 'Download a model in Settings > Model.',
  },
}

export function createError(code: ErrorCode, overrides?: Partial<Pick<AppError, 'message' | 'suggestion'>>): AppError {
  const def = ERROR_DEFINITIONS[code]
  return {
    code,
    message: overrides?.message ?? def.message,
    suggestion: overrides?.suggestion ?? def.suggestion,
  }
}

export function getErrorDefinition(code: ErrorCode) {
  return ERROR_DEFINITIONS[code]
}
