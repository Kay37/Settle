import type { Thought } from '../types'
import { dueLabel, isActive } from './assign'

export type PersonLoop = {
  person: string
  thoughts: Thought[]
  top: Thought
  staleDays: number
  overdue: boolean
}

const DAY = 86_400_000

function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY)
}

/** Open people loops grouped by person, stalest first. */
export function peopleRadar(
  thoughts: Thought[],
  now = new Date(),
): PersonLoop[] {
  const open = thoughts.filter(
    (t) =>
      (t.status === 'open' || t.status === 'waiting') &&
      isActive(t.snoozeUntil, now) &&
      (t.category === 'people' || t.status === 'waiting' || Boolean(t.person)),
  )

  const byPerson = new Map<string, Thought[]>()
  for (const t of open) {
    const name = t.person?.trim() || 'Someone'
    const list = byPerson.get(name) ?? []
    list.push(t)
    byPerson.set(name, list)
  }

  const loops: PersonLoop[] = []
  for (const [person, list] of byPerson) {
    const sorted = [...list].sort((a, b) => {
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
      if (aDue !== bDue) return aDue - bDue
      return a.createdAt.localeCompare(b.createdAt)
    })
    const top = sorted[0]
    const staleDays = daysSince(top.createdAt, now.getTime())
    const label = top.dueAt ? dueLabel(top.dueAt, now) : null
    loops.push({
      person,
      thoughts: sorted,
      top,
      staleDays,
      overdue: label === 'Overdue' || label === 'Due now',
    })
  }

  return loops.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    if (a.staleDays !== b.staleDays) return b.staleDays - a.staleDays
    return a.person.localeCompare(b.person)
  })
}

export function staleLabel(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 14) return '1 week+'
  return `${Math.floor(days / 7)} weeks`
}
