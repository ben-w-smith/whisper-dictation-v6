import https from 'node:https'
import { existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { GGUF_MODEL_DIR, GGUF_META_FILE } from '@shared/constants'
import { CURATED_GGUF_MODELS } from '@shared/hf'
import type { DownloadedGgufModel, GgufMetaFile, HfModelSearchResult } from '@shared/hf'

const MAX_REDIRECTS = 5

// ── Helpers ──────────────────────────────────────────────────────────────

function getGgufDir(): string {
  return join(app.getPath('userData'), GGUF_MODEL_DIR)
}

function getMetaPath(): string {
  return join(app.getPath('userData'), GGUF_META_FILE)
}

function readMeta(): GgufMetaFile {
  const path = getMetaPath()
  if (!existsSync(path)) {
    return { downloadedModels: [] }
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as GgufMetaFile
  } catch {
    return { downloadedModels: [] }
  }
}

function writeMeta(meta: GgufMetaFile): void {
  writeFileSync(getMetaPath(), JSON.stringify(meta, null, 2), 'utf-8')
}

function broadcastProgress(filename: string, loaded: number, total: number): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.HF_DOWNLOAD_PROGRESS, {
        filename,
        loaded,
        total,
        percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
      })
    }
  })
}

function broadcastComplete(filename: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.HF_DOWNLOAD_COMPLETE, { filename })
    }
  })
}

function broadcastError(filename: string, error: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.HF_DOWNLOAD_ERROR, { filename, error })
    }
  })
}

/** Make an HTTPS GET request with optional Bearer token, following redirects. */
function httpsGetWithAuth(
  url: string,
  token: string | undefined,
  callback: (res: import('node:http').IncomingMessage) => void
): import('node:https').Request {
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return https.get(url, { headers }, callback)
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Search Hugging Face for GGUF models.
 */
export function searchHfModels(query: string, limit = 20): Promise<HfModelSearchResult[]> {
  const encoded = encodeURIComponent(query)
  const url = `https://huggingface.co/api/models?search=${encoded}&filter=gguf&sort=downloads&direction=-1&limit=${limit}`

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        const location = res.headers['location']
        res.resume()
        if (location) {
          searchHfModels(location, limit).then(resolve, reject)
        } else {
          reject(new Error(`Redirect with no Location header`))
        }
        return
      }

      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk })
      res.on('end', () => {
        try {
          const results = JSON.parse(data) as Array<{ id: string; downloads: number; tags: string[] }>
          resolve(results.map((r) => ({ id: r.id, downloads: r.downloads, tags: r.tags })))
        } catch {
          resolve([])
        }
      })
    }).on('error', reject)
  })
}

/**
 * List GGUF files in a Hugging Face repo.
 */
export function getHfModelFiles(repoId: string, token?: string): Promise<string[]> {
  const url = `https://huggingface.co/api/models/${repoId}`

  return new Promise((resolve, reject) => {
    httpsGetWithAuth(url, token, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        const location = res.headers['location']
        res.resume()
        if (location) {
          getHfModelFiles(location, token).then(resolve, reject)
        } else {
          reject(new Error(`Redirect with no Location header`))
        }
        return
      }

      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk })
      res.on('end', () => {
        try {
          const model = JSON.parse(data) as { siblings: Array<{rfilename: string}>}
          const ggufFiles = (model.siblings || [])
            .map((s) => s.rfilename)
            .filter((name) => name.endsWith('.gguf'))
          resolve(ggufFiles)
        } catch {
          resolve([])
        }
      })
    }).on('error', reject)
  })
}

/**
 * Download a GGUF model file from Hugging Face.
 * Streams to a .tmp file, renames atomically on success, updates metadata.
 */
export function downloadGgufModel(
  repoId: string,
  filename: string,
  curatedId: string | null,
  token?: string
): Promise<void> {
  const ggufDir = getGgufDir()
  mkdirSync(ggufDir, { recursive: true })

  const destPath = join(ggufDir, filename)
  const tmpPath = `${destPath}.tmp`

  // Already downloaded?
  if (existsSync(destPath)) {
    return Promise.resolve()
  }

  const url = `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(filename)}`

  return new Promise((resolve, reject) => {
    const download = (requestUrl: string, remaining: number): void => {
      if (remaining <= 0) {
        reject(new Error('Too many redirects'))
        return
      }

      httpsGetWithAuth(requestUrl, token, (res) => {
        const statusCode = res.statusCode

        if (statusCode && statusCode >= 300 && statusCode < 400) {
          const location = res.headers['location']
          if (!location) {
            reject(new Error(`Redirect (${statusCode}) with no Location header`))
            return
          }
          res.resume()
          download(location, remaining - 1)
          return
        }

        if (statusCode === 403) {
          res.resume()
          reject(new Error(
            'Access denied. This model may require you to accept its license on huggingface.co first.'
          ))
          return
        }

        if (statusCode !== 200) {
          res.resume()
          reject(new Error(`Failed to download: HTTP ${statusCode}`))
          return
        }

        const total = parseInt(res.headers['content-length'] || '0', 10)
        let loaded = 0

        const fileStream = require('node:fs').createWriteStream(tmpPath)

        res.on('data', (chunk: Buffer) => {
          loaded += chunk.length
          broadcastProgress(filename, loaded, total)
        })

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()

          // Atomic rename
          try { unlinkSync(destPath) } catch {}
          renameSync(tmpPath, destPath)

          // Get file size
          let fileSize = 0
          try { fileSize = statSync(destPath).size } catch {}

          // Update metadata
          const meta = readMeta()
          const id = curatedId ?? `${repoId}::${filename}`
          // Remove any previous entry for this filename
          meta.downloadedModels = meta.downloadedModels.filter((m) => m.filename !== filename)
          meta.downloadedModels.push({
            id,
            repoId,
            filename,
            downloadedAt: Date.now(),
            fileSize,
          })
          writeMeta(meta)

          broadcastComplete(filename)
          resolve()
        })

        fileStream.on('error', (error: Error) => {
          try { unlinkSync(tmpPath) } catch {}
          broadcastError(filename, error.message)
          reject(error)
        })
      }).on('error', (error: Error) => {
        try { unlinkSync(tmpPath) } catch {}
        broadcastError(filename, error.message)
        reject(error)
      })
    }

    download(url, MAX_REDIRECTS)
  })
}

/**
 * Get list of locally downloaded GGUF models.
 */
export function getDownloadedGgufModels(): DownloadedGgufModel[] {
  const meta = readMeta()
  // Filter to only files that still exist on disk
  const ggufDir = getGgufDir()
  return meta.downloadedModels.filter((m) => existsSync(join(ggufDir, m.filename)))
}

/**
 * Delete a downloaded GGUF model file and remove from metadata.
 */
export function deleteGgufModel(filename: string): void {
  const path = join(getGgufDir(), filename)
  if (existsSync(path)) {
    unlinkSync(path)
  }

  const meta = readMeta()
  meta.downloadedModels = meta.downloadedModels.filter((m) => m.filename !== filename)
  writeMeta(meta)
}

/**
 * Get the absolute path to a downloaded GGUF model file.
 */
export function getGgufModelPath(filename: string): string {
  return join(getGgufDir(), filename)
}
