import type { AppSettings } from '@shared/types'

export const defaultSettings: AppSettings = {
  localModel: 'base.en',
  recordingMode: 'toggle',
  keyboardShortcut: 'Command+Shift+D',
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
}

export const refinementEnabledSettings: AppSettings = {
  ...defaultSettings,
  refinementEnabled: true,
  refinementModelPath: '/Users/example/models/gemma-4-E2B-Q4_K_M.gguf',
  refinementIntensity: 'medium',
}

export const pushToTalkSettings: AppSettings = {
  ...defaultSettings,
  recordingMode: 'push-to-talk',
  mouseButton: 3,
  keyboardShortcut: null,
}
