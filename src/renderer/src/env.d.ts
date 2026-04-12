import type { DebugBus } from '@shared/debug'

interface Window {
  api: {
    send: (channel: string, ...args: unknown[]) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    on: (channel: string, callback: (...args: unknown[]) => void) => () => void
  }
  __debugBus: DebugBus
  __testMockAudio?: boolean
}
