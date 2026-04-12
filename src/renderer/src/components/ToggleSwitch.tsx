import React from 'react'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function ToggleSwitch({ checked, onChange, label, disabled = false }: ToggleSwitchProps): React.ReactElement {
  const handleChange = () => {
    if (!disabled) {
      onChange(!checked)
    }
  }

  return (
    <button
      type="button"
      onClick={handleChange}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        ${checked ? 'bg-teal-600' : 'bg-stone-200'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
      `}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  )
}
