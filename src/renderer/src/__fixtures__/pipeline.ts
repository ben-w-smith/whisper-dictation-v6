import type { AppError } from '@shared/types'

interface MockSnapshot {
  value: string
  context: {
    audioLevels: number[]
    elapsedMs: number
    transcriptionText: string
    rawTranscriptionText: string
    error: AppError | null
    audioDurationMs: number
  }
  matches: (state: string) => boolean
}

function createMockSnapshot(
  value: string,
  overrides: Partial<MockSnapshot['context']> = {}
): MockSnapshot {
  return {
    value,
    context: {
      audioLevels: [0.3, 0.5, 0.7, 0.4, 0.6],
      elapsedMs: 5000,
      transcriptionText: '',
      rawTranscriptionText: '',
      error: null,
      audioDurationMs: 5000,
      ...overrides,
    },
    matches(state: string) {
      return this.value === state
    },
  }
}

export const recordingState = createMockSnapshot('recording', {
  audioLevels: [0.3, 0.5, 0.7, 0.4, 0.6],
  elapsedMs: 5000,
})

export const transcribingState = createMockSnapshot('transcribing', {
  audioLevels: [],
  elapsedMs: 5200,
})

export const completeState = createMockSnapshot('complete', {
  audioLevels: [],
  elapsedMs: 0,
  transcriptionText: 'Hello, this is a test transcription that was just completed.',
  rawTranscriptionText: 'hello this is a test transcription that was just completed',
})

export const errorState = createMockSnapshot('error', {
  audioLevels: [],
  elapsedMs: 0,
  error: {
    code: 'MICROPHONE_DENIED',
    message: 'Microphone access denied',
    suggestion: 'Enable access in System Settings to use dictation.',
  },
})

export const recordingSilentState = createMockSnapshot('recording', {
  audioLevels: [0.05, 0.02, 0.03, 0.01, 0.04],
  elapsedMs: 12000,
})

export const recordingLoudState = createMockSnapshot('recording', {
  audioLevels: [0.8, 0.9, 0.95, 0.85, 0.92],
  elapsedMs: 3000,
})
