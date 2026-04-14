import type { AppSettings, DictionaryEntry } from '@shared/types'

const sampleDictionary: DictionaryEntry[] = [
  { id: '1', from: 'tablty', to: 'tabletly' },
  { id: '2', from: 'whisper', to: 'Whisper' },
  { id: '3', from: 'electron', to: 'Electron' },
]

export const defaultSettings: AppSettings = {
  localModel: 'base.en',
  keyboardShortcuts: ['Command+Shift+D'],
  mouseButton: null,
  microphoneDeviceId: '',
  autoPaste: true,
  copyToClipboard: true,
  refinementEnabled: false,
  refinementModelPath: '',
  refinementIntensity: 'medium',
  showOverlay: true,
  playSounds: true,
  onboardingComplete: true,
  dictionary: [],
}

export const populatedDictionarySettings: AppSettings = {
  ...defaultSettings,
  dictionary: sampleDictionary,
}

export const refinementEnabledSettings: AppSettings = {
  ...defaultSettings,
  refinementEnabled: true,
  refinementModelPath: '/Users/example/models/gemma-4-E2B-Q4_K_M.gguf',
  refinementIntensity: 'medium',
}

export const multiShortcutSettings: AppSettings = {
  ...defaultSettings,
  keyboardShortcuts: ['Command+Shift+D', 'Command+Shift+F'],
}
