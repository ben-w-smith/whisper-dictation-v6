import React, { useState, useEffect } from 'react'
import { ShortcutRecorder } from './ShortcutRecorder'
import type { LocalModel, PermissionStatus } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { IPC } from '@shared/ipc'

type OnboardingStep = 1 | 2 | 3

interface OnboardingProps {
  onComplete: () => void
  initialStep?: OnboardingStep
}

export function Onboarding({ onComplete, initialStep = 1 }: OnboardingProps): React.ReactElement {
  const [step, setStep] = useState<OnboardingStep>(initialStep)
  const [permissions, setPermissions] = useState<PermissionStatus>({
    microphone: 'prompt',
    accessibility: 'prompt',
  })
  const [keyboardShortcuts, setKeyboardShortcuts] = useState<string[]>(DEFAULT_SETTINGS.keyboardShortcuts)
  const [mouseButton, setMouseButton] = useState<number | null>(DEFAULT_SETTINGS.mouseButton)
  const [selectedModel, setSelectedModel] = useState<LocalModel>(DEFAULT_SETTINGS.localModel)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    const checkPermissions = async () => {
      const status = await window.api.invoke(IPC.CHECK_PERMISSIONS) as PermissionStatus
      setPermissions(status)
    }
    checkPermissions()
  }, [])

  const requestMicrophone = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setPermissions((prev) => ({ ...prev, microphone: 'granted' }))
    } catch {
      setPermissions((prev) => ({ ...prev, microphone: 'denied' }))
    }
  }

  const requestAccessibility = async () => {
    window.api.send(IPC.REQUEST_ACCESSIBILITY)
  }

  const handleDownloadModel = async () => {
    setIsDownloading(true)
    setDownloadProgress(0)
    await window.api.invoke(IPC.DOWNLOAD_MODEL, selectedModel)
  }

  useEffect(() => {
    const unsubscribeProgress = window.api.on(IPC.DOWNLOAD_PROGRESS, (progress: { percent: number }) => {
      setDownloadProgress(progress.percent)
    })

    const unsubscribeComplete = window.api.on(IPC.DOWNLOAD_COMPLETE, () => {
      setIsDownloading(false)
    })

    return () => {
      unsubscribeProgress()
      unsubscribeComplete()
    }
  }, [])

  const handleFinish = async () => {
    await window.api.invoke(IPC.SET_SETTING, 'keyboardShortcuts', keyboardShortcuts)
    await window.api.invoke(IPC.SET_SETTING, 'mouseButton', mouseButton)
    await window.api.invoke(IPC.SET_SETTING, 'localModel', selectedModel)
    await window.api.invoke(IPC.SET_SETTING, 'onboardingComplete', true)
    onComplete()
  }

  const handleSkip = async () => {
    await window.api.invoke(IPC.SET_SETTING, 'onboardingComplete', true)
    onComplete()
  }

  const canProceedFromStep2 = () => {
    return permissions.microphone === 'granted' && (keyboardShortcuts.length > 0 || mouseButton !== null)
  }

  return (
    <div className="fixed inset-0 bg-canvas z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg relative">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-accent w-8' : 'bg-border-custom w-2'
              }`}
            />
          ))}
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-0 right-0 p-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          Skip
        </button>

        {step === 1 && (
          <div className="text-center">
            <div className="w-24 h-24 bg-accent rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-1">Welcome to Whisper Dictation</h1>
            <p className="text-base text-text-secondary mb-8">
              Fast, private voice dictation for macOS powered by local AI
            </p>
            <button
              onClick={() => setStep(2)}
              className="px-8 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-2">Permissions & Shortcut</h2>
            <p className="text-text-secondary mb-6">Let's set up the essentials</p>

            <div className="space-y-4 mb-6">
              {/* Microphone permission */}
              <div className="p-4 rounded-xl border border-border-custom bg-surface">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-text-primary">Microphone Access</div>
                    <div className="text-sm text-text-secondary">Required to record audio</div>
                  </div>
                  {permissions.microphone === 'granted' ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Granted
                    </span>
                  ) : permissions.microphone === 'denied' ? (
                    <button
                      onClick={requestMicrophone}
                      className="px-3 py-1.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle transition-colors"
                    >
                      Retry
                    </button>
                  ) : (
                    <button
                      onClick={requestMicrophone}
                      className="px-3 py-1.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle transition-colors"
                    >
                      Grant Access
                    </button>
                  )}
                </div>
              </div>

              {/* Accessibility permission */}
              <div className="p-4 rounded-xl border border-border-custom bg-surface">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-text-primary">Accessibility</div>
                    <div className="text-sm text-text-secondary">Required for auto-paste</div>
                  </div>
                  {permissions.accessibility === 'granted' ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Granted
                    </span>
                  ) : (
                    <button
                      onClick={requestAccessibility}
                      className="px-3 py-1.5 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent-subtle transition-colors"
                    >
                      Open Settings
                    </button>
                  )}
                </div>
              </div>

              {/* Shortcut recorder */}
              <div className="p-4 rounded-xl border border-border-custom bg-surface">
                <div className="font-medium text-text-primary mb-1">Recording Shortcut</div>
                <div className="text-sm text-text-secondary mb-3">
                  Press a key combination or mouse button
                </div>
                <ShortcutRecorder
                  value={keyboardShortcuts[0] ?? null}
                  mouseButton={mouseButton}
                  onChange={(keyboard, mouse) => {
                    setKeyboardShortcuts(keyboard ? [keyboard] : DEFAULT_SETTINGS.keyboardShortcuts)
                    setMouseButton(mouse)
                  }}
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 text-text-secondary hover:text-text-primary transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedFromStep2()}
                className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-2">Choose Your Model</h2>
            <p className="text-text-secondary mb-6">Select a Whisper model for transcription</p>

            <div className="space-y-3 mb-6">
              {(['tiny.en', 'base.en', 'small.en'] as LocalModel[]).map((model) => {
                const isRecommended = model === 'base.en'
                return (
                  <button
                    key={model}
                    onClick={() => setSelectedModel(model)}
                    className={`
                      w-full p-4 rounded-xl border-2 text-left transition-all relative
                      ${selectedModel === model
                        ? 'border-accent bg-accent-subtle'
                        : 'border-border-custom bg-surface hover:border-border-hover'
                      }
                    `}
                  >
                    {isRecommended && (
                      <span className="absolute top-3 right-3 text-xs px-2 py-0.5 bg-accent text-white rounded-full">
                        Recommended
                      </span>
                    )}
                    <div className="font-medium text-text-primary capitalize">
                      {model.replace('.en', '')}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {model === 'tiny.en' && 'Fastest, ~39MB'}
                      {model === 'base.en' && 'Balanced, ~74MB'}
                      {model === 'small.en' && 'Better accuracy, ~244MB'}
                    </div>
                  </button>
                )
              })}
            </div>

            {downloadProgress > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-accent-subtle">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-primary">Downloading {selectedModel}...</span>
                  <span className="text-text-secondary">{downloadProgress}%</span>
                </div>
                <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 text-text-secondary hover:text-text-primary transition-colors"
              >
                Back
              </button>
              {downloadProgress === 0 ? (
                <button
                  onClick={handleDownloadModel}
                  className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
                >
                  Download Model
                </button>
              ) : downloadProgress === 100 ? (
                <button
                  onClick={handleFinish}
                  className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
                >
                  Start Dictating
                </button>
              ) : (
                <button
                  disabled
                  className="px-6 py-2.5 bg-border-custom text-white font-medium rounded-lg cursor-not-allowed"
                >
                  Downloading...
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
