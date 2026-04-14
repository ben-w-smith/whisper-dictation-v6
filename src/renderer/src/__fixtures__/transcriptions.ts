import type { TranscriptionEntry } from '@shared/types'

export const emptyHistory: TranscriptionEntry[] = []

export const populatedHistory: TranscriptionEntry[] = [
  {
    id: '1',
    text: 'The quick brown fox jumps over the lazy dog. This is a sample transcription that demonstrates how the history list looks with a longer text entry.',
    rawText: 'the quick brown fox jumps over the lazy dog this is a sample transcription that demonstrates how the history list looks with a longer text entry',
    audioDurationMs: 4500,
    transcriptionProvider: 'local',
    timestamp: Date.now() - 300000,
    wordCount: 27,
  },
  {
    id: '2',
    text: 'Hello world, this is a test transcription.',
    rawText: 'hello world this is a test transcription',
    audioDurationMs: 2000,
    transcriptionProvider: 'local',
    refinedWith: 'gemma-4-E2B',
    timestamp: Date.now() - 3600000,
    wordCount: 8,
  },
  {
    id: '3',
    text: 'Meeting notes: discuss the project timeline and deliverables for next quarter.',
    rawText: 'meeting notes discuss the project timeline and deliverables for next quarter',
    audioDurationMs: 3200,
    transcriptionProvider: 'local',
    timestamp: Date.now() - 86400000,
    wordCount: 11,
  },
  {
    id: '4',
    text: 'Remind me to buy groceries on the way home.',
    rawText: 'remind me to buy groceries on the way home',
    audioDurationMs: 1800,
    transcriptionProvider: 'local',
    timestamp: Date.now() - 172800000,
    wordCount: 9,
  },
  {
    id: '5',
    text: "The implementation plan looks solid. Let's schedule a review session with the team to go over the architecture decisions before we start coding.",
    rawText: 'the implementation plan looks solid lets schedule a review session with the team to go over the architecture decisions before we start coding',
    audioDurationMs: 6100,
    transcriptionProvider: 'local',
    refinedWith: 'gemma-4-E2B',
    timestamp: Date.now() - 259200000,
    wordCount: 26,
  },
]
