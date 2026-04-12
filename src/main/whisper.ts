import { spawn, ChildProcess } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { WHISPER_BIN_PATH, MODEL_DIR } from '@shared/constants'
import { createError } from '@shared/errors'
import type { WhisperResult } from '@shared/types'

// Test mock — set via IPC test:mock-transcription, cleared after use
let mockTranscriptionText: string | null = null

/**
 * Set a mock transcription result for testing.
 * When set, transcribeAudio() returns this text immediately
 * instead of calling whisper.cpp or cloud APIs.
 * Cleared after the next transcription call.
 */
export function setMockTranscriptionResult(text: string): void {
  mockTranscriptionText = text
}

export interface TranscribeOptions {
  language?: string
  onProgress?: (message: string) => void
}

export interface TranscribeAudioParams {
  audioPath: string
  model: string
  options?: TranscribeOptions
}

/**
 * Transcribe audio file using whisper.cpp or cloud providers
 * @param audioPath - Absolute path to the audio file
 * @param model - Model name (e.g., 'base.en', 'small.en')
 * @param options - Optional parameters for transcription
 * @returns Promise<WhisperResult> with transcribed text
 * @throws AppError with MODEL_NOT_FOUND or TRANSCRIPTION_FAILED
 */
export async function transcribeAudio({
  audioPath,
  model,
  options = {},
}: TranscribeAudioParams): Promise<WhisperResult> {
  // Test mock — return immediately if set
  if (mockTranscriptionText !== null) {
    const text = mockTranscriptionText
    mockTranscriptionText = null
    return { text }
  }

  const { language = 'auto', onProgress } = options

  // Get the app's user data path for models
  const userDataPath = app.getPath('userData')
  const modelPath = join(userDataPath, MODEL_DIR, `${model}.bin`)

  // Check if model exists
  if (!existsSync(modelPath)) {
    throw createError('MODEL_NOT_FOUND')
  }

  // Check if audio file exists
  if (!existsSync(audioPath)) {
    throw createError('TRANSCRIPTION_FAILED', {
      message: 'Audio file not found',
      suggestion: 'The audio file could not be found. Please try recording again.',
    })
  }

  // Get the path to the whisper binary.
  // In dev mode: project root (process.cwd())
  // In production: unpacked from asar — bin/ is listed under asarUnpack so it lands
  // at Contents/Resources/app.asar.unpacked/bin/whisper-cpp, NOT inside the archive.
  // spawn() cannot execute binaries inside an asar archive.
  const binPath = app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', WHISPER_BIN_PATH)
    : join(process.cwd(), WHISPER_BIN_PATH)

  if (!existsSync(binPath)) {
    throw createError('TRANSCRIPTION_FAILED', {
      message: 'Whisper binary not found',
      suggestion: 'The whisper-cpp binary could not be found. Please reinstall the application.',
    })
  }

  return new Promise<WhisperResult>((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let whisperProcess: ChildProcess | null = null
    let timedOut = false

    // 30-second timeout — kill the whisper process if it hasn't responded
    const timeout = setTimeout(() => {
      timedOut = true
      if (whisperProcess) {
        whisperProcess.kill('SIGKILL')
      }
      reject(createError('TRANSCRIPTION_FAILED', {
        message: 'Whisper process timed out after 30 seconds',
        suggestion: 'Try a smaller model or shorter recording.',
      }))
    }, 30000)

    try {
      // Build arguments for whisper.cpp
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '-otxt', // Output text only
        '-l', language,
        '-nt', // No timestamps
      ]

      onProgress?.('Starting transcription...')

      // Spawn the whisper process
      whisperProcess = spawn(binPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      if (!whisperProcess.stdout || !whisperProcess.stderr) {
        throw new Error('Failed to spawn whisper process')
      }

      // Collect stdout
      whisperProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf-8')
        stdout += text
      })

      // Collect stderr for progress information
      whisperProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf-8')
        stderr += text

        // Parse progress from stderr (whisper.cpp outputs progress info)
        if (text.includes('whisper') || text.includes('sample')) {
          onProgress?.('Processing audio...')
        }
      })

      // Handle process completion
      whisperProcess.on('close', (code) => {
        clearTimeout(timeout)
        if (timedOut) return
        if (code === 0 && stdout.trim()) {
          // Parse the output - whisper.cpp outputs the transcription to stdout
          const text = stdout.trim()

          resolve({
            text,
            language: language === 'auto' ? undefined : language,
          })
        } else if (code === 0 && !stdout.trim()) {
          // Successful run but no speech detected — return empty string
          resolve({
            text: '',
            language: language === 'auto' ? undefined : language,
          })
        } else {
          // Non-zero exit — check if it's a model load failure specifically
          if (stderr.includes('failed to load') || stderr.includes('error: failed to open')) {
            reject(createError('MODEL_NOT_FOUND'))
          } else {
            reject(createError('TRANSCRIPTION_FAILED', {
              message: `Whisper process exited with code ${code}`,
              suggestion: 'Try recording again or selecting a different model.',
            }))
          }
        }
      })

      // Handle spawn errors
      whisperProcess.on('error', (error) => {
        clearTimeout(timeout)
        if (timedOut) return
        reject(createError('TRANSCRIPTION_FAILED', {
          message: error.message,
          suggestion: 'Make sure whisper-cpp is properly installed.',
        }))
      })

    } catch (error) {
      clearTimeout(timeout)
      if (whisperProcess) {
        whisperProcess.kill()
      }
      reject(createError('TRANSCRIPTION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Try recording again or check the application logs.',
      }))
    }
  })
}

/**
 * Check if a whisper model is downloaded
 * @param model - Model name to check
 * @returns true if the model file exists
 */
export function isModelDownloaded(model: string): boolean {
  const userDataPath = app.getPath('userData')
  const modelPath = join(userDataPath, MODEL_DIR, `${model}.bin`)
  return existsSync(modelPath)
}

/**
 * Get the path to a model file
 * @param model - Model name
 * @returns Absolute path to the model file
 */
export function getModelPath(model: string): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, MODEL_DIR, `${model}.bin`)
}

/**
 * Get list of all downloaded models
 * @returns Array of model names without the .bin extension
 */
export function getDownloadedModels(): string[] {
  const userDataPath = app.getPath('userData')
  const modelsDir = join(userDataPath, MODEL_DIR)

  if (!existsSync(modelsDir)) {
    return []
  }

  try {
    const files = readdirSync(modelsDir)
    return files
      .filter((file: string) => file.endsWith('.bin'))
      .map((file: string) => file.replace('.bin', ''))
  } catch {
    return []
  }
}

