import { describe, it, expect } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { createPipelineMachine } from './pipelineMachine'
import type { PipelineContext, PipelineEvent } from '@shared/types'
import { MIN_RECORDING_DURATION_MS, COMPLETE_DISPLAY_MS, ERROR_DISPLAY_MS } from '@shared/constants'

describe('pipelineMachine', () => {
  describe('idle state', () => {
    it('should transition to recording on HOTKEY_PRESSED', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      expect(actor.getSnapshot().value).toBe('idle')

      actor.send({ type: 'HOTKEY_PRESSED' })

      expect(actor.getSnapshot().value).toBe('recording')
    })

    it('should have cleared context on entry', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      const context = actor.getSnapshot().context as PipelineContext

      expect(context.audioBuffer).toBeNull()
      expect(context.audioDurationMs).toBe(0)
      expect(context.audioLevels).toEqual([])
      expect(context.transcriptionText).toBe('')
      expect(context.rawTranscriptionText).toBe('')
      expect(context.error).toBeNull()
      expect(context.elapsedMs).toBe(0)
    })
  })

  describe('recording state', () => {
    it('should transition to transcribing when STOP is sent with duration > MIN_RECORDING_DURATION_MS', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })
      expect(actor.getSnapshot().value).toBe('recording')

      // Simulate recording with duration
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.5, 0.6, 0.7],
        durationMs: MIN_RECORDING_DURATION_MS + 100
      })

      actor.send({ type: 'STOP' })

      expect(actor.getSnapshot().value).toBe('transcribing')
    })

    it('should transition to idle when STOP is sent with duration < MIN_RECORDING_DURATION_MS', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })
      expect(actor.getSnapshot().value).toBe('recording')

      // Simulate recording with short duration
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.3, 0.4],
        durationMs: MIN_RECORDING_DURATION_MS - 100
      })

      actor.send({ type: 'STOP' })

      expect(actor.getSnapshot().value).toBe('idle')
    })

    it('should update context with AUDIO_DATA events', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })

      const levels = [0.2, 0.5, 0.8, 0.6]
      const durationMs = 1000

      actor.send({ type: 'AUDIO_DATA', levels, durationMs })

      const context = actor.getSnapshot().context as PipelineContext

      expect(context.audioLevels).toEqual(levels)
      expect(context.audioDurationMs).toBe(durationMs)
    })
  })

  describe('transcribing state', () => {
    it('should transition to complete on TRANSCRIPTION_SUCCESS', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.5],
        durationMs: MIN_RECORDING_DURATION_MS + 100
      })
      actor.send({ type: 'STOP' })

      expect(actor.getSnapshot().value).toBe('transcribing')

      actor.send({
        type: 'TRANSCRIPTION_SUCCESS',
        text: 'Hello world',
        rawText: 'hello world'
      })

      expect(actor.getSnapshot().value).toBe('complete')

      const context = actor.getSnapshot().context as PipelineContext
      expect(context.transcriptionText).toBe('Hello world')
      expect(context.rawTranscriptionText).toBe('hello world')
    })

    it('should transition to error on TRANSCRIPTION_FAILURE', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.5],
        durationMs: MIN_RECORDING_DURATION_MS + 100
      })
      actor.send({ type: 'STOP' })

      expect(actor.getSnapshot().value).toBe('transcribing')

      const error = {
        code: 'TRANSCRIPTION_FAILED' as const,
        message: 'Failed to transcribe',
        suggestion: 'Try again'
      }

      actor.send({ type: 'TRANSCRIPTION_FAILURE', error })

      expect(actor.getSnapshot().value).toBe('error')

      const context = actor.getSnapshot().context as PipelineContext
      expect(context.error).toEqual(error)
    })
  })

  describe('complete state', () => {
    it('should transition to idle on COMPLETE_ACKNOWLEDGED event', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.5],
        durationMs: MIN_RECORDING_DURATION_MS + 100
      })
      actor.send({ type: 'STOP' })
      actor.send({
        type: 'TRANSCRIPTION_SUCCESS',
        text: 'Hello world',
        rawText: 'hello world'
      })

      expect(actor.getSnapshot().value).toBe('complete')

      actor.send({ type: 'COMPLETE_ACKNOWLEDGED' })

      expect(actor.getSnapshot().value).toBe('idle')
    })
  })

  describe('error state', () => {
    it('should transition to idle on ERROR_DISMISSED event', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.5],
        durationMs: MIN_RECORDING_DURATION_MS + 100
      })
      actor.send({ type: 'STOP' })

      const error = {
        code: 'TRANSCRIPTION_FAILED' as const,
        message: 'Failed to transcribe',
        suggestion: 'Try again'
      }

      actor.send({ type: 'TRANSCRIPTION_FAILURE', error })

      expect(actor.getSnapshot().value).toBe('error')

      actor.send({ type: 'ERROR_DISMISSED' })

      expect(actor.getSnapshot().value).toBe('idle')
    })
  })

  describe('context clearing', () => {
    it('should clear context when transitioning back to idle', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      // Go through a full cycle
      actor.send({ type: 'HOTKEY_PRESSED' })
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.5, 0.6],
        durationMs: MIN_RECORDING_DURATION_MS + 100
      })
      actor.send({ type: 'STOP' })
      actor.send({
        type: 'TRANSCRIPTION_SUCCESS',
        text: 'Hello world',
        rawText: 'hello world'
      })

      // Manually transition to idle
      actor.send({ type: 'COMPLETE_ACKNOWLEDGED' })

      expect(actor.getSnapshot().value).toBe('idle')

      const context = actor.getSnapshot().context as PipelineContext

      expect(context.audioBuffer).toBeNull()
      expect(context.audioDurationMs).toBe(0)
      expect(context.audioLevels).toEqual([])
      expect(context.transcriptionText).toBe('')
      expect(context.rawTranscriptionText).toBe('')
      expect(context.error).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should toggle recording on HOTKEY_PRESSED (toggle mode)', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })
      expect(actor.getSnapshot().value).toBe('recording')

      // Simulate audio with sufficient duration
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.5],
        durationMs: MIN_RECORDING_DURATION_MS + 100
      })

      // Second HOTKEY_PRESSED should stop recording and go to transcribing
      actor.send({ type: 'HOTKEY_PRESSED' })
      expect(actor.getSnapshot().value).toBe('transcribing')
    })

    it('should return to idle on HOTKEY_PRESSED if recording too short', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      actor.send({ type: 'HOTKEY_PRESSED' })

      // Short recording
      actor.send({
        type: 'AUDIO_DATA',
        levels: [0.3],
        durationMs: MIN_RECORDING_DURATION_MS - 100
      })

      actor.send({ type: 'HOTKEY_PRESSED' })
      expect(actor.getSnapshot().value).toBe('idle')
    })

    it('should ignore invalid events in idle state', () => {
      const machine = createPipelineMachine()
      const actor = createActor(machine)
      actor.start()

      expect(actor.getSnapshot().value).toBe('idle')

      // These should be ignored or handled gracefully
      actor.send({ type: 'STOP' })
      actor.send({ type: 'AUDIO_DATA', levels: [0.5], durationMs: 1000 })

      expect(actor.getSnapshot().value).toBe('idle')
    })
  })
})
