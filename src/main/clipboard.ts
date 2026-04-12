import { clipboard } from 'electron'
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import { createError } from '@shared/errors'

/**
 * Write text to the system clipboard
 * @param text - Text to copy to clipboard
 * @throws Promise that rejects on failure
 */
export async function writeToClipboard(text: string): Promise<void> {
  try {
    clipboard.writeText(text)
  } catch (error) {
    throw new Error(`Failed to write to clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Read text from the system clipboard
 * @returns Promise<string> with clipboard contents
 */
export async function readFromClipboard(): Promise<string> {
  try {
    return clipboard.readText()
  } catch (error) {
    throw new Error(`Failed to read from clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Simulate Cmd+V to paste clipboard contents
 * This uses @nut-tree-fork/nut-js to simulate the keyboard shortcut
 * @returns Promise that resolves when paste is complete
 * @throws AppError with AUTO_PASTE_FAILED (non-fatal)
 */
export async function autoPaste(): Promise<void> {
  try {
    // Simulate Cmd+V using nut-js
    await keyboard.pressKey(Key.LeftCmd, Key.V)
    await keyboard.releaseKey(Key.LeftCmd, Key.V)
  } catch (error) {
    // Auto-paste failure should be non-fatal
    // Just log the error - the text is still in the clipboard
    const errorObj = createError('AUTO_PASTE_FAILED')
    console.warn(`Auto-paste failed: ${errorObj.message}. ${errorObj.suggestion}`)

    // Don't throw - this is a non-fatal error
    // The user can manually paste with Cmd+V
  }
}

/**
 * Clear the clipboard (write empty string)
 */
export async function clearClipboard(): Promise<void> {
  try {
    clipboard.writeText('')
  } catch (error) {
    throw new Error(`Failed to clear clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
