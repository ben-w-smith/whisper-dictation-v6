// Typed IPC channel definitions
export const IPC = {
  // Renderer -> Main
  START_WHISPER: 'whisper:start',
  WRITE_CLIPBOARD: 'clipboard:write',
  AUTO_PASTE: 'clipboard:paste',
  SAVE_HISTORY: 'history:save',
  GET_SETTINGS: 'settings:get',
  SET_SETTING: 'settings:set',
  GET_HISTORY: 'history:get',
  CHECK_PERMISSIONS: 'permissions:check',
  DOWNLOAD_MODEL: 'model:download',
  GET_DOWNLOADED_MODELS: 'model:downloaded-list',
  OPEN_SETTINGS: 'window:settings',
  OPEN_ABOUT: 'window:about',
  QUIT_APP: 'app:quit',
  REFINE_TEXT: 'refine:text',
  SET_WINDOW_MODE: 'window:set-mode',
  UPDATE_TRAY_STATE: 'tray:update-state',
  PAUSE_HOTKEY: 'hotkey:pause',
  RESUME_HOTKEY: 'hotkey:resume',
  CAPTURE_MOUSE_BUTTON: 'hotkey:capture-mouse',
  MOUSE_BUTTON_CAPTURED: 'hotkey:mouse-captured',
  REQUEST_MICROPHONE: 'permissions:request-microphone',
  OPEN_SYSTEM_SETTINGS: 'app:open-system-settings',

  // Hugging Face
  HF_GET_TOKEN: 'hf:get-token',
  HF_SET_TOKEN: 'hf:set-token',
  HF_SEARCH_MODELS: 'hf:search-models',
  HF_GET_MODEL_FILES: 'hf:get-model-files',
  HF_DOWNLOAD_GGUF: 'hf:download-gguf',
  HF_GET_DOWNLOADED_GGUF: 'hf:get-downloaded-gguf',
  HF_DELETE_GGUF: 'hf:delete-gguf',

  // Main -> Renderer
  HISTORY_UPDATED: 'history:updated',
  WHISPER_RESULT: 'whisper:result',
  WHISPER_ERROR: 'whisper:error',
  HOTKEY_TRIGGERED: 'hotkey:triggered',
  FORCE_START_RECORDING: 'recording:force-start',
  SETTINGS_UPDATED: 'settings:updated',
  DOWNLOAD_PROGRESS: 'model:download-progress',
  DOWNLOAD_COMPLETE: 'model:download-complete',
  REFINEMENT_SKIPPED: 'refinement:skipped',
  LLAMA_SERVER_STATUS: 'llama:status',

  // Hugging Face broadcasts
  HF_DOWNLOAD_PROGRESS: 'hf:download-progress',
  HF_DOWNLOAD_COMPLETE: 'hf:download-complete',
  HF_DOWNLOAD_ERROR: 'hf:download-error',

  REQUEST_ACCESSIBILITY: 'permissions:request-accessibility',

  // Overlay -> Main -> Background (relay through main process)
  OVERLAY_DISMISS: 'overlay:dismiss',
  OVERLAY_READY: 'overlay:ready',
  OVERLAY_CANCEL: 'overlay:cancel',

  // Debug
  DEBUG_QUERY: 'debug:query',

  // Test-only channels (gated on NODE_ENV === 'test')
  TEST_MOCK_TRANSCRIPTION: 'test:mock-transcription',
  TEST_READ_CLIPBOARD: 'test:read-clipboard',
  TEST_COMPLETE_ONBOARDING: 'test:complete-onboarding',
  TEST_TRIGGER_MOUSE_CAPTURE: 'test:trigger-mouse-capture',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
