import React, { useState, useEffect, useCallback } from 'react'
import { IPC } from '@shared/ipc'

interface ShortcutRecorderProps {
  value: string | null
  mouseButton: number | null
  onChange: (keyboard: string | null, mouse: number | null) => void
  disabled?: boolean
}

export function ShortcutRecorder({
  value,
  mouseButton,
  onChange,
  disabled = false
}: ShortcutRecorderProps): React.ReactElement {
  const [isRecording, setIsRecording] = useState(false)
  const [displayValue, setDisplayValue] = useState<string>('')

  useEffect(() => {
    if (mouseButton !== null) {
      const mouseNames: Record<number, string> = {
        3: 'Back Button',
        4: 'Forward Button',
        1: 'Side Button 1',
        2: 'Side Button 2',
      }
      setDisplayValue(mouseNames[mouseButton] || `Button ${mouseButton}`)
    } else if (value) {
      setDisplayValue(formatAccelerator(value))
    } else {
      setDisplayValue('Click to record')
    }
  }, [value, mouseButton])

  const formatAccelerator = (accelerator: string): string => {
    return accelerator
      .replace(/CommandOrControl\+/, 'Cmd+')
      .replace(/Command\+/, 'Cmd+')
      .replace(/Control\+/, 'Ctrl+')
      .replace(/Alt\+/, 'Option+')
      .replace(/Shift\+/, 'Shift+')
      .replace(/Super\+/, 'Windows+')
      .replace(/\+/g, ' + ')
  }

  const isRecordingRef = React.useRef(false)

  const startRecording = useCallback(() => {
    if (disabled) return
    // Unregister the global hotkey so pressing it here doesn't trigger recording
    window.api.send(IPC.PAUSE_HOTKEY)
    isRecordingRef.current = true
    setIsRecording(true)
    setDisplayValue('Press keys or mouse button...')
  }, [disabled])

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false
    setIsRecording(false)
    // Re-register the global hotkey
    window.api.send(IPC.RESUME_HOTKEY)
  }, [])

  // If the settings window closes while the recorder is active, the hotkey
  // must be re-registered — otherwise it stays silently unregistered forever.
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        window.api.send(IPC.RESUME_HOTKEY)
      }
    }
  }, [])

  const clearShortcut = useCallback(() => {
    onChange(null, null)
    setDisplayValue('Click to record')
  }, [onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isRecording) return

      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        stopRecording()
        return
      }

      const modifiers: string[] = []
      if (e.metaKey) modifiers.push('Command')
      if (e.ctrlKey) modifiers.push('Control')
      if (e.altKey) modifiers.push('Alt')
      if (e.shiftKey) modifiers.push('Shift')

      const validKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
        'Space', 'Tab', 'Enter', 'Escape', 'Backspace', 'Delete',
        'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown',
        ';', '=', ',', '-', '.', '/', '\\', "'", '[', ']', '`']

      const key = e.key
      // Normalize single-char keys to uppercase so 'Ctrl+m' → 'Ctrl+M'
      const normalizedKey = key.length === 1 ? key.toUpperCase() : key
      if (validKeys.includes(key) || (modifiers.length > 0 && key !== 'Meta' && key !== 'Control' && key !== 'Alt' && key !== 'Shift')) {
        const accelerator = [...modifiers, normalizedKey].join('+')
        onChange(accelerator, null)
        stopRecording()
      }
    },
    [isRecording, onChange, stopRecording]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isRecording || e.button < 3) return

      e.preventDefault()
      e.stopPropagation()

      onChange(null, e.button)
      stopRecording()
    },
    [isRecording, onChange, stopRecording]
  )

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={startRecording}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        disabled={disabled}
        className={`
          px-3 py-2 rounded-lg border-2 text-sm font-mono transition-all duration-200
          ${isRecording
            ? 'border-[#c4bdb4] bg-[#ebe6df] text-text-primary animate-pulse'
            : 'border-border-custom bg-surface text-text-primary hover:border-border-hover'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          min-w-[200px] text-left
        `}
        tabIndex={0}
      >
        {displayValue}
      </button>
      {(value || mouseButton !== null) && (
        <button
          type="button"
          onClick={clearShortcut}
          disabled={disabled}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-[#ebe6df] rounded-lg transition-colors"
          aria-label="Clear shortcut"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
