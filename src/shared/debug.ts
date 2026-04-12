/**
 * DebugBus — structured, queryable event log for pipeline observability.
 *
 * Captures state transitions, IPC messages, audio diagnostics, whisper results,
 * and errors into a circular buffer. Exposed on the background window as
 * `window.__debugBus` for MCP tool / DevTools access.
 *
 * Zero overhead in production — the buffer is small (500 entries) and push
 * is just array ops + notifying subscribers.
 */

export type DebugSource = 'pipeline' | 'audio' | 'ipc' | 'whisper' | 'clipboard' | 'test'

export interface DebugEntry {
  ts: number
  source: DebugSource
  event: string
  data: unknown
}

export interface DebugFilter {
  source?: DebugSource
  event?: string
  since?: number // timestamp — only entries after this time
}

const MAX_ENTRIES = 500

class DebugBus {
  private entries: DebugEntry[] = []
  private listeners: Set<(entry: DebugEntry) => void> = new Set()

  push(source: DebugSource, event: string, data?: unknown): void {
    const entry: DebugEntry = { ts: Date.now(), source, event, data }

    this.entries.push(entry)

    // Circular buffer — drop oldest when over limit
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES)
    }

    // Notify subscribers
    for (const fn of this.listeners) {
      try {
        fn(entry)
      } catch {
        // Subscriber errors must not break the bus
      }
    }
  }

  query(filter?: DebugFilter): DebugEntry[] {
    if (!filter) return [...this.entries]

    return this.entries.filter((entry) => {
      if (filter.source && entry.source !== filter.source) return false
      if (filter.event && entry.event !== filter.event) return false
      if (filter.since && entry.ts < filter.since) return false
      return true
    })
  }

  subscribe(fn: (entry: DebugEntry) => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  clear(): void {
    this.entries = []
  }

  /** Number of entries currently in the buffer */
  get size(): number {
    return this.entries.length
  }
}

// Singleton
let instance: DebugBus | null = null

export function getDebugBus(): DebugBus {
  if (!instance) {
    instance = new DebugBus()
  }
  return instance
}
