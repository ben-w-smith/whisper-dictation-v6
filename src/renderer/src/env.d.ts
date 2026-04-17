import type { DebugBus } from '@shared/debug'

// The `import` above makes this file a module, so the `Window` augmentation
// must live inside `declare global` to extend the global lib.dom Window.
declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: unknown[]) => void
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
    }
    __debugBus: DebugBus
    __testMockAudio?: boolean
  }
}

export {}
