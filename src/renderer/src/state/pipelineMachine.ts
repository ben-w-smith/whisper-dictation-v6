import { setup, assign, fromPromise } from 'xstate'
import type { PipelineContext, PipelineEvent } from '@shared/types'
import {
  MIN_RECORDING_DURATION_MS,
  COMPLETE_DISPLAY_MS,
  ERROR_DISPLAY_MS
} from '@shared/constants'

const initialContext: PipelineContext = {
  audioBuffer: null,
  audioDurationMs: 0,
  audioLevels: [],
  transcriptionText: '',
  rawTranscriptionText: '',
  error: null,
  elapsedMs: 0
}

export const createPipelineMachine = () => {
  return setup({
    types: {
      context: {} as PipelineContext,
      events: {} as PipelineEvent
    },
    guards: {
      recordingTooShort: ({ context }) => {
        return context.audioDurationMs < MIN_RECORDING_DURATION_MS
      }
    },
    actions: {
      setAudioBuffer: assign({
        audioBuffer: ({ event }) => {
          if (event.type === 'AUDIO_BUFFER_READY') {
            return event.buffer
          }
          return null
        }
      }),
      updateAudioData: assign({
        audioLevels: ({ event }) => {
          if (event.type === 'AUDIO_DATA') {
            return event.levels
          }
          return []
        },
        audioDurationMs: ({ context, event }) => {
          if (event.type === 'AUDIO_DATA') {
            return event.durationMs
          }
          return context.audioDurationMs
        }
      }),
      setTranscriptionResult: assign({
        transcriptionText: ({ event }) => {
          if (event.type === 'TRANSCRIPTION_SUCCESS') {
            return event.text
          }
          return ''
        },
        rawTranscriptionText: ({ event }) => {
          if (event.type === 'TRANSCRIPTION_SUCCESS') {
            return event.rawText
          }
          return ''
        }
      }),
      setError: assign({
        error: ({ event }) => {
          if (event.type === 'TRANSCRIPTION_FAILURE') {
            return event.error
          }
          return null
        }
      }),
      clearContext: assign(() => initialContext)
    }
  }).createMachine({
    id: 'pipeline',
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {
        entry: [{ type: 'clearContext' }],
        on: {
          HOTKEY_PRESSED: 'recording'
        }
      },
      recording: {
        on: {
          AUDIO_DATA: {
            actions: [{ type: 'updateAudioData' }]
          },
          CANCEL: 'idle',
          HOTKEY_PRESSED: [
            {
              guard: 'recordingTooShort',
              target: 'idle'
            },
            {
              target: 'transcribing'
            }
          ],
          STOP: [
            {
              guard: 'recordingTooShort',
              target: 'idle'
            },
            {
              target: 'transcribing'
            }
          ],
          TRANSCRIPTION_FAILURE: {
            target: 'error',
            actions: [{ type: 'setError' }]
          }
        }
      },
      transcribing: {
        on: {
          AUDIO_BUFFER_READY: {
            actions: [{ type: 'setAudioBuffer' }]
          },
          TRANSCRIPTION_SUCCESS: {
            target: 'complete',
            actions: [{ type: 'setTranscriptionResult' }]
          },
          TRANSCRIPTION_FAILURE: {
            target: 'error',
            actions: [{ type: 'setError' }]
          }
        }
      },
      complete: {
        after: {
          [COMPLETE_DISPLAY_MS]: 'idle'
        },
        on: {
          COMPLETE_ACKNOWLEDGED: 'idle'
        }
      },
      error: {
        after: {
          [ERROR_DISPLAY_MS]: 'idle'
        },
        on: {
          ERROR_DISMISSED: 'idle',
          HOTKEY_PRESSED: 'idle',
          COMPLETE_ACKNOWLEDGED: 'idle'
        }
      }
    }
  })
}

export type PipelineMachine = ReturnType<typeof createPipelineMachine>
