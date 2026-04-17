import ElectronStoreImport from 'electron-store'
import Keytar from 'keytar'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { AppSettings, TranscriptionEntry } from '@shared/types'

// electron-store 10.x is ESM with a default export. Under Electron's CJS
// loader the default export can land on `.default`; handle both shapes.
const Store = (ElectronStoreImport as unknown as { default: typeof ElectronStoreImport }).default || ElectronStoreImport
// Type alias so `Store<T>` resolves in type positions (the `const Store`
// above only binds in value-space). Constraint mirrors electron-store's
// own `T extends Record<string, any>` so we can pass AppSettings directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Store<T extends Record<string, any>> = ElectronStoreImport<T>

const keytar = (Keytar as unknown as { default: typeof Keytar }).default || Keytar

/**
 * Create the settings store
 */
function createSettingsStore(): Store<AppSettings> {
  const store = new Store<AppSettings>({
    name: 'settings',
    defaults: DEFAULT_SETTINGS,
  })

  return store
}

/**
 * Create the history store
 */
function createHistoryStore(): Store<{ entries: TranscriptionEntry[] }> {
  const store = new Store<{ entries: TranscriptionEntry[] }>({
    name: 'history',
    defaults: { entries: [] },
  })

  return store
}

/**
 * Migrate legacy settings keys to current schema.
 * Called once during store initialization.
 */
function migrateLegacySettings(store: Store<AppSettings>): void {
  // Migrate keyboardShortcut (string) → keyboardShortcuts (string[])
  const legacyShortcut = (store as unknown as Store<Record<string, unknown>>).get('keyboardShortcut')
  if (typeof legacyShortcut === 'string') {
    const current = store.get('keyboardShortcuts')
    if (!current || !Array.isArray(current) || current.length === 0) {
      store.set('keyboardShortcuts', [legacyShortcut])
    }
    // Remove legacy key
    ;(store as unknown as Store<Record<string, unknown>>).delete('keyboardShortcut')
    console.log('[Store] Migrated keyboardShortcut → keyboardShortcuts')
  }

  // Remove deprecated recordingMode key
  if ('recordingMode' in (store as unknown as Store<Record<string, unknown>>).store) {
    ;(store as unknown as Store<Record<string, unknown>>).delete('recordingMode')
    console.log('[Store] Removed deprecated recordingMode')
  }

  // Migrate: if user already has a manual refinementModelPath, preserve it
  const existingModelPath = store.get('refinementModelPath')
  if (existingModelPath && typeof existingModelPath === 'string' && existingModelPath.length > 0) {
    const raw = (store as unknown as Store<Record<string, unknown>>).store
    if (!('refinementModelSource' in raw) || raw.refinementModelSource === undefined) {
      store.set('refinementModelSource', 'manual')
      console.log('[Store] Set refinementModelSource to manual (existing path found)')
    }
  }
}

// Singleton instances
let settingsStore: Store<AppSettings> | null = null
let historyStore: Store<{ entries: TranscriptionEntry[] }> | null = null

/**
 * Get or create the settings store
 */
function getSettingsStore(): Store<AppSettings> {
  if (!settingsStore) {
    settingsStore = createSettingsStore()
    migrateLegacySettings(settingsStore)
  }
  return settingsStore
}

/**
 * Get or create the history store
 */
function getHistoryStore(): Store<{ entries: TranscriptionEntry[] }> {
  if (!historyStore) {
    historyStore = createHistoryStore()
  }
  return historyStore
}

/**
 * Get all settings
 * @returns Current AppSettings
 */
export async function getSettings(): Promise<AppSettings> {
  const store = getSettingsStore()

  // API keys are stored exclusively in the OS keychain via keytar —
  // they are not part of AppSettings and are accessed via getApiKey()
  // by callers that need them (refinement, remote transcription).
  return {
    ...DEFAULT_SETTINGS,
    ...store.store,
  }
}

/**
 * Get a single setting value
 * @param key - The setting key to retrieve
 * @returns The setting value or undefined if not found
 */
export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const settings = await getSettings()
  return settings[key]
}

/**
 * Set a single setting value
 * @param key - The setting key to update
 * @param value - The new value
 */
export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  // API keys never pass through setSetting — they live in keytar and
  // are mutated via setApiKey() directly.
  const store = getSettingsStore()
  store.set(key, value)
}

/**
 * Set multiple settings at once
 * @param settings - Partial AppSettings object with values to update
 */
export function setSettings(settings: Partial<AppSettings>): void {
  const store = getSettingsStore()

  for (const [key, value] of Object.entries(settings)) {
    store.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings])
  }
}

/**
 * Reset all settings to defaults
 */
export function resetSettings(): void {
  const store = getSettingsStore()
  store.clear()
  // Re-apply defaults
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    store.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings])
  }
}

/**
 * Get all transcription history entries
 * @returns Array of TranscriptionEntry
 */
export function getHistory(): TranscriptionEntry[] {
  const store = getHistoryStore()
  return store.get('entries', [])
}

/**
 * Save a new transcription entry to history
 * @param entry - TranscriptionEntry to save
 */
export function saveHistoryEntry(entry: TranscriptionEntry): void {
  const store = getHistoryStore()
  const entries = store.get('entries', [])

  // Add new entry at the beginning
  entries.unshift(entry)

  // Keep only the last 1000 entries
  const MAX_ENTRIES = 1000
  const trimmedEntries = entries.slice(0, MAX_ENTRIES)

  store.set('entries', trimmedEntries)
}

/**
 * Delete a specific history entry by ID
 * @param id - ID of the entry to delete
 */
export function deleteHistoryEntry(id: string): void {
  const store = getHistoryStore()
  const entries = store.get('entries', [])

  const filteredEntries = entries.filter((entry) => entry.id !== id)
  store.set('entries', filteredEntries)
}

/**
 * Clear all transcription history
 */
export function clearHistory(): void {
  const store = getHistoryStore()
  store.set('entries', [])
}

/**
 * Export history to JSON string
 * @returns JSON string of all history entries
 */
export function exportHistory(): string {
  const entries = getHistory()
  return JSON.stringify(entries, null, 2)
}

/**
 * Import history from JSON string
 * @param json - JSON string of history entries
 * @returns Number of entries imported
 */
export function importHistory(json: string): number {
  try {
    const entries = JSON.parse(json) as TranscriptionEntry[]

    if (!Array.isArray(entries)) {
      throw new Error('Invalid history format')
    }

    // Validate entries
    const validEntries = entries.filter((entry) => {
      return (
        typeof entry.id === 'string' &&
        typeof entry.text === 'string' &&
        typeof entry.timestamp === 'number'
      )
    })

    const store = getHistoryStore()
    const existingEntries = store.get('entries', [])

    // Merge entries, avoiding duplicates by ID
    const entryMap = new Map<string, TranscriptionEntry>()

    for (const entry of existingEntries) {
      entryMap.set(entry.id, entry)
    }

    for (const entry of validEntries) {
      entryMap.set(entry.id, entry)
    }

    // Convert back to array and sort by timestamp (newest first)
    const mergedEntries = Array.from(entryMap.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    )

    store.set('entries', mergedEntries)

    return validEntries.length
  } catch (error) {
    throw new Error(`Failed to import history: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Keytar service names for API keys
const KEYTAR_SERVICES = {
  openai: 'whisper-dictation-openai',
  google: 'whisper-dictation-google',
  anthropic: 'whisper-dictation-anthropic',
  huggingface: 'whisper-dictation-huggingface',
} as const
const KEYTAR_ACCOUNT = 'default'

/**
 * Get an API key from keytar with fallback to electron-store
 */
export async function getApiKey(service: keyof typeof KEYTAR_SERVICES): Promise<string> {
  try {
    const serviceName = KEYTAR_SERVICES[service]
    const key = await keytar.getPassword(serviceName, KEYTAR_ACCOUNT)
    if (key) {
      return key
    }
  } catch (error) {
    // No electron-store fallback — see setApiKey for rationale.
    console.error(`keytar failed to get ${service} key:`, error)
  }
  return ''
}

/**
 * Set an API key using keytar with fallback to electron-store
 */
export async function setApiKey(service: keyof typeof KEYTAR_SERVICES, key: string): Promise<void> {
  try {
    const serviceName = KEYTAR_SERVICES[service]
    if (key) {
      await keytar.setPassword(serviceName, KEYTAR_ACCOUNT, key)
    } else {
      await keytar.deletePassword(serviceName, KEYTAR_ACCOUNT)
    }
  } catch (error) {
    // If keytar fails there is no fallback — API keys are intentionally
    // not persisted to electron-store (they are not part of AppSettings).
    // Surface the failure so the caller can notify the user.
    console.error(`keytar failed to set ${service} key:`, error)
    throw error
  }
}

/**
 * Get all API keys
 */
export async function getApiKeys(): Promise<{
  openai: string
  google: string
  anthropic: string
}> {
  const [openai, google, anthropic] = await Promise.all([
    getApiKey('openai'),
    getApiKey('google'),
    getApiKey('anthropic'),
  ])

  return { openai, google, anthropic }
}
