import type { Thought } from '../types'
import { isActive } from './assign'
import { staleDays } from './staleSweep'

export type Insight = {
  id: string
  text: string
}

/** Small, local-only nudges for the Today brief — no LLM. */
export function gentleInsights(
  thoughts: Thought[],
  now = new Date(),
): Insight[] {
  const open = thoughts.filter(
    (t) =>
      (t.status === 'open' || t.status === 'waiting') &&
      isActive(t.snoozeUntil, now),
  )
  if (!open.length) return []

  const insights: Insight[] = []
  const projects = new Map<string, number>()
  for (const t of open) {
    if (!t.project) continue
    projects.set(t.project, (projects.get(t.project) ?? 0) + 1)
  }
  for (const [name, count] of projects) {
    if (count >= 2) {
      insights.push({
        id: `project-${name}`,
        text: `${count} open loops tagged “${name}”.`,
      })
    }
  }

  const trip = /\b(trip|vacation|flight|hotel|travel|passport)\b/i
  const tripCount = open.filter((t) => trip.test(t.text)).length
  if (tripCount >= 2) {
    insights.push({
      id: 'trip-cluster',
      text: `${tripCount} travel-related items open — batch them when you can.`,
    })
  }

  const overduePeople = open.filter(
    (t) =>
      t.category === 'people' &&
      t.dueAt &&
      new Date(t.dueAt).getTime() < now.getTime(),
  )
  if (overduePeople.length) {
    insights.push({
      id: 'people-overdue',
      text: `${overduePeople.length} people loop${overduePeople.length > 1 ? 's' : ''} past due.`,
    })
  }

  const stale = open.filter((t) => staleDays(t.createdAt, now.getTime()) >= 14)
  if (stale.length >= 3) {
    insights.push({
      id: 'stale-many',
      text: `${stale.length} thoughts have been open 2+ weeks — brain sweep might help.`,
    })
  }

  const worries = open.filter((t) => t.category === 'worry')
  if (worries.length >= 2) {
    insights.push({
      id: 'worry-stack',
      text: `${worries.length} worries parked — pick one small prep step or revisit later.`,
    })
  }

  return insights.slice(0, 3)
}
