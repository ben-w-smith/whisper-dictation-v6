import { defaultSettings, refinementEnabledSettings } from './settings'
import { populatedHistory } from './transcriptions'

export function createMockApi(overrides: {
  settings?: Record<string, unknown>
  history?: unknown[]
  permissions?: { microphone: string; accessibility: string }
  downloadedModels?: string[]
} = {}) {
  const settings = overrides.settings ?? defaultSettings
  const history = overrides.history ?? populatedHistory
  const permissions = overrides.permissions ?? { microphone: 'granted', accessibility: 'granted' }
  const downloadedModels = overrides.downloadedModels ?? ['tiny.en', 'base.en', 'small.en']

  return {
    invoke: async (channel: string, ..._args: unknown[]) => {
      switch (channel) {
        case 'settings:get':
          return settings
        case 'settings:set':
          return undefined
        case 'history:get':
          return history
        case 'history:clear':
          return undefined
        case 'history:save':
          return undefined
        case 'permissions:check':
          return permissions
        case 'permissions:request-microphone':
          return true
        case 'model:downloaded-list':
          return downloadedModels
        case 'model:download':
          return undefined
        case 'app:version':
          return '6.0.0'
        default:
          return undefined
      }
    },
    send: () => {},
    on: () => () => {},
  }
}

export const defaultMockApi = createMockApi()

export const refinementMockApi = createMockApi({
  settings: refinementEnabledSettings,
})
