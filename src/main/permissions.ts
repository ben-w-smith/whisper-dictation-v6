import { systemPreferences, BrowserWindow } from 'electron'
import type { PermissionStatus } from '@shared/types'
import { createError } from '@shared/errors'

export async function checkMicrophonePermission(): Promise<{ microphone: 'granted' | 'denied' | 'prompt' }> {
  try {
    // Check macOS microphone permission
    const status = systemPreferences.getMediaAccessStatus('microphone')

    switch (status) {
      case 'granted':
        return { microphone: 'granted' }
      case 'denied':
        return { microphone: 'denied' }
      case 'not-determined':
        return { microphone: 'prompt' }
      case 'restricted':
        return { microphone: 'denied' }
      default:
        return { microphone: 'prompt' }
    }
  } catch (error) {
    console.error('[Permissions] Error checking microphone permission:', error)
    return { microphone: 'prompt' }
  }
}

export async function checkAccessibilityPermission(): Promise<{ accessibility: 'granted' | 'denied' | 'prompt' }> {
  try {
    // macOS doesn't provide a direct API to check accessibility permission
    // We need to trust the systemPreferences module or attempt to use it
    // For now, we'll return 'prompt' which the UI should interpret as needing user action
    const trusted = systemPreferences.isTrustedAccessibilityClient(false)

    if (trusted) {
      return { accessibility: 'granted' }
    } else {
      return { accessibility: 'prompt' }
    }
  } catch (error) {
    console.error('[Permissions] Error checking accessibility permission:', error)
    return { accessibility: 'prompt' }
  }
}

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const granted = await systemPreferences.askForMediaAccess('microphone')
    console.log('[Permissions] Microphone permission request:', granted ? 'granted' : 'denied')
    return granted
  } catch (error) {
    console.error('[Permissions] Error requesting microphone permission:', error)
    return false
  }
}

export async function checkAllPermissions(): Promise<PermissionStatus> {
  const [micStatus, accessibilityStatus] = await Promise.all([
    checkMicrophonePermission(),
    checkAccessibilityPermission()
  ])

  return {
    microphone: micStatus.microphone,
    accessibility: accessibilityStatus.accessibility
  }
}
