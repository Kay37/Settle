import type { Thought } from '../types'
import { isActive } from './assign'

const KEY = 'settle.notified.v1'

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function loadNotified(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function saveNotified(map: Record<string, string>) {
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function remindersSupported(): boolean {
  return typeof Notification !== 'undefined'
}

export function dueForReminder(thoughts: Thought[], now = new Date()): Thought[] {
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  return thoughts.filter((t) => {
    if (t.status !== 'open' && t.status !== 'waiting') return false
    if (!isActive(t.snoozeUntil, now)) return false
    if (!t.dueAt) return false
    return new Date(t.dueAt).getTime() <= now.getTime()
  })
}

export async function enableReminders(): Promise<boolean> {
  if (!remindersSupported()) return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

/** Fire at most one notification per thought per day. */
export async function notifyDueThoughts(
  thoughts: Thought[],
  now = new Date(),
): Promise<number> {
  if (!remindersSupported() || Notification.permission !== 'granted') return 0
  const due = dueForReminder(thoughts, now)
  if (!due.length) return 0

  const notified = loadNotified()
  const today = dayKey(now)
  let count = 0

  for (const t of due.slice(0, 3)) {
    if (notified[t.id] === today) continue
    const title = t.nextAction || t.title
    try {
      new Notification('Settle', {
        body: `${title} is due`,
        tag: `settle-${t.id}`,
        icon: '/icon-192.png',
      })
      notified[t.id] = today
      count += 1
    } catch {
      /* ignore */
    }
  }

  saveNotified(notified)
  return count
}
