import type { AppState, Thought } from '../types'

const KEY = 'settle.v2'
const LEGACY = ['unload.v2', 'unload.v1']

const empty: AppState = { version: 2, thoughts: [], learned: [] }

export function loadState(): AppState {
  try {
    const raw =
      localStorage.getItem(KEY) ??
      LEGACY.map((k) => localStorage.getItem(k)).find(Boolean) ??
      null
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<AppState> & {
      version?: number
      thoughts?: Thought[]
    }
    if (!Array.isArray(parsed.thoughts)) return empty
    return {
      version: 2,
      thoughts: parsed.thoughts.map(normalizeThought),
      learned: Array.isArray(parsed.learned) ? parsed.learned : [],
    }
  } catch {
    return empty
  }
}

function normalizeThought(t: Thought): Thought {
  return {
    ...t,
    dueAt: t.dueAt ?? null,
    person: t.person ?? null,
    nextAction: t.nextAction ?? t.title,
    snoozeUntil: t.snoozeUntil ?? null,
    private: Boolean(t.private),
    supersedesId: t.supersedesId ?? null,
    confidence: t.confidence,
  }
}

export function saveState(state: AppState): void {
  const payload: AppState = { ...state, version: 2 }
  localStorage.setItem(KEY, JSON.stringify(payload))
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function exportJson(state: AppState): string {
  return JSON.stringify({ ...state, version: 2 }, null, 2)
}
