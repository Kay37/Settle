import type { Thought } from '../types'
import { isActive } from './assign'

const DAY = 86_400_000

function daysSince(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY)
}

/** Open thoughts older than minDays, stalest first. */
export function staleSweep(
  thoughts: Thought[],
  minDays = 7,
  limit = 3,
  now = new Date(),
): Thought[] {
  const ts = now.getTime()
  return thoughts
    .filter(
      (t) =>
        t.status === 'open' &&
        isActive(t.snoozeUntil, now) &&
        daysSince(t.createdAt, ts) >= minDays,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit)
}

export function staleDays(iso: string, now = Date.now()): number {
  return daysSince(iso, now)
}
