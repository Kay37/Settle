import type { Thought } from '../types'
import { isActive } from './assign'

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Open loops from before today — Twos-style daily rollover. */
export function carriedOverOpen(thoughts: Thought[]): Thought[] {
  const start = startOfToday().getTime()
  return thoughts.filter(
    (t) =>
      t.status === 'open' &&
      isActive(t.snoozeUntil) &&
      new Date(t.createdAt).getTime() < start,
  )
}
