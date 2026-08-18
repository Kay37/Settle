import type { Thought } from '../types'
import { isActive } from './assign'
import { staleDays } from './staleSweep'

/** Open items waiting on someone else. */
export function waitingLoops(thoughts: Thought[], now = new Date()): Thought[] {
  return thoughts
    .filter(
      (t) =>
        t.status === 'waiting' &&
        isActive(t.snoozeUntil, now),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function waitingLabel(thought: Thought, now = Date.now()): string {
  const days = staleDays(thought.createdAt, now)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day waiting'
  return `${days} days waiting`
}
