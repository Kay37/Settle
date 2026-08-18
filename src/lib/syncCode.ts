import type { AppState, LearnedRule, Thought } from '../types'

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

/** Merge incoming sync data with local — newer updatedAt wins per thought. */
export function mergeSyncState(local: AppState, incoming: AppState): AppState {
  const byId = new Map<string, Thought>()
  for (const t of local.thoughts) byId.set(t.id, t)
  for (const t of incoming.thoughts) {
    const prev = byId.get(t.id)
    if (!prev || t.updatedAt >= prev.updatedAt) byId.set(t.id, t)
  }
  const thoughts = [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  const learnedMap = new Map<string, LearnedRule>()
  for (const r of local.learned) learnedMap.set(r.phrase, r)
  for (const r of incoming.learned) learnedMap.set(r.phrase, r)
  const learned = [...learnedMap.values()].slice(-80)

  return { version: 2, thoughts, learned }
}
