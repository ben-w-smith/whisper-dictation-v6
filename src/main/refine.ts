import http from 'node:http'
import { REFINEMENT_PROMPTS, LLAMA_SERVER_PORT } from '@shared/constants'
import type { AppSettings } from '@shared/types'
import { getLlamaStatus } from './llama'

/**
 * Refine transcribed text using the local llama-server.
 * Returns the original text unchanged if refinement is disabled,
 * the model path is not set, or the server is not ready.
 */
export async function refineText(
  text: string,
  settings: AppSettings
): Promise<string> {
  if (!settings.refinementEnabled) return text
  if (!settings.refinementModelPath) return text

  const status = getLlamaStatus()
  if (status !== 'ready') {
    console.warn('[Refine] llama-server not ready (status:', status, ') — using raw transcription')
    return text
  }

  const prompt = REFINEMENT_PROMPTS[settings.refinementIntensity] ?? REFINEMENT_PROMPTS.medium

  const requestBody = JSON.stringify({
    model: 'local',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  })

  return new Promise<string>((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: LLAMA_SERVER_PORT,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout: 30000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data)
              resolve(result.choices[0]?.message?.content?.trim() || text)
            } catch {
              resolve(text)
            }
          } else {
            reject(new Error(`llama-server responded ${res.statusCode}: ${data}`))
          }
        })
      }
    )

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('llama-server request timed out'))
    })

    req.write(requestBody)
    req.end()
  })
}
