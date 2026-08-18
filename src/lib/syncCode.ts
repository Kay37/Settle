import type { AppState } from '../types'

/** Pasteable backup for moving Settle between phone and PC. */
export function toSyncCode(state: AppState): string {
  const json = JSON.stringify({ ...state, version: 2 })
  return btoa(unescape(encodeURIComponent(json)))
}

export function fromSyncCode(raw: string): AppState | null {
  try {
    const cleaned = raw.trim().replace(/\s+/g, '')
    const json = decodeURIComponent(escape(atob(cleaned)))
    const parsed = JSON.parse(json) as AppState
    if (!Array.isArray(parsed.thoughts)) return null
    return {
      version: 2,
      thoughts: parsed.thoughts,
      learned: Array.isArray(parsed.learned) ? parsed.learned : [],
    }
  } catch {
    return null
  }
}
