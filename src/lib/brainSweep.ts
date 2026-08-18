import type { Thought } from '../types'
import { isActive } from './assign'
import { staleSweep } from './staleSweep'

/** Mixed queue for a short weekly brain sweep. */
export function brainSweepQueue(
  thoughts: Thought[],
  limit = 5,
  now = new Date(),
): Thought[] {
  const seen = new Set<string>()
  const out: Thought[] = []

  function push(t: Thought) {
    if (seen.has(t.id)) return
    seen.add(t.id)
    out.push(t)
  }

  for (const t of staleSweep(thoughts, 5, limit, now)) push(t)

  const worries = thoughts
    .filter(
      (t) =>
        t.status === 'open' &&
        t.category === 'worry' &&
        isActive(t.snoozeUntil, now),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const t of worries.slice(0, 2)) {
    if (out.length >= limit) break
    push(t)
  }

  const waiting = thoughts
    .filter((t) => t.status === 'waiting' && isActive(t.snoozeUntil, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const t of waiting.slice(0, 2)) {
    if (out.length >= limit) break
    push(t)
  }

  return out.slice(0, limit)
}

const SWEEP_KEY = 'settle.sweep.v1'

export function lastSweepAt(): number | null {
  try {
    const raw = localStorage.getItem(SWEEP_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

export function markSweepDone(): void {
  try {
    localStorage.setItem(SWEEP_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function sweepDue(days = 7): boolean {
  const last = lastSweepAt()
  if (!last) return true
  return Date.now() - last > days * 86_400_000
}
