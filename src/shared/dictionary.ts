import type { DictionaryEntry } from './types'

export function applyDictionary(text: string, entries: DictionaryEntry[]): string {
  if (!entries.length) return text
  let result = text
  for (const entry of entries) {
    if (!entry.from || !entry.to) continue
    // Case-insensitive whole-word replacement
    const escaped = entry.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    result = result.replace(regex, (match) => {
      // Preserve case of first letter
      if (match[0] === match[0].toUpperCase()) {
        return entry.to[0].toUpperCase() + entry.to.slice(1)
      }
      return entry.to
    })
  }
  return result
}
