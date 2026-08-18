import type { Thought } from '../types'
import { isActive } from './assign'
import { urgencyScore } from './classify'

export function thoughtScore(t: Thought, now = Date.now()): number {
  let s = urgencyScore(t.text)
  if (t.dueAt) {
    const due = new Date(t.dueAt).getTime()
    if (due < now) s += 20
    else {
      const hours = (due - now) / 36e5
      if (hours < 12) s += 12
      else if (hours < 36) s += 6
    }
  }
  if (t.category === 'do') s += 3
  if (t.category === 'people') s += 2
  if (t.category === 'later' || t.category === 'note') s -= 4
  return s
}

export function rankOpen(items: Thought[], now = Date.now()): Thought[] {
  return [...items].sort((a, b) => {
    const u = thoughtScore(b, now) - thoughtScore(a, now)
    if (u !== 0) return u
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function nextThree(thoughts: Thought[], now = new Date()): Thought[] {
  const open = thoughts.filter(
    (t) =>
      t.status === 'open' &&
      isActive(t.snoozeUntil, now) &&
      (t.category === 'do' || t.category === 'people'),
  )
  return rankOpen(open, now.getTime()).slice(0, 3)
}
