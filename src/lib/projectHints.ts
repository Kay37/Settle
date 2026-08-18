import type { Thought } from '../types'
import { isActive } from './assign'

const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'need', 'want',
  'about', 'before', 'after', 'when', 'what', 'text', 'call', 'buy', 'get',
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
}

export type ProjectHint = {
  name: string
  thoughts: Thought[]
  keywords: string[]
}

/** Suggest thoughts that might belong to the same project. */
export function detectProjectHints(
  thoughts: Thought[],
  now = new Date(),
): ProjectHint[] {
  const open = thoughts.filter(
    (t) =>
      (t.status === 'open' || t.status === 'waiting') &&
      isActive(t.snoozeUntil, now) &&
      !t.project,
  )

  const hints: ProjectHint[] = []
  const used = new Set<string>()

  for (let i = 0; i < open.length; i++) {
    if (used.has(open[i].id)) continue
    const ti = tokens(open[i].text)
    if (!ti.length) continue

    const group = [open[i]]
    const shared = new Set(ti)

    for (let j = i + 1; j < open.length; j++) {
      if (used.has(open[j].id)) continue
      const tj = tokens(open[j].text)
      const overlap = tj.filter((w) => shared.has(w))
      if (overlap.length >= 2) {
        group.push(open[j])
        overlap.forEach((w) => shared.add(w))
      }
    }

    if (group.length >= 2) {
      group.forEach((t) => used.add(t.id))
      const keywords = [...shared].slice(0, 3)
      const name = titleFromKeywords(keywords, group)
      hints.push({ name, thoughts: group, keywords })
    }
  }

  return hints.sort((a, b) => b.thoughts.length - a.thoughts.length).slice(0, 3)
}

function titleFromKeywords(keywords: string[], thoughts: Thought[]): string {
  const joined = keywords.join(' ')
  const trip = /\b(trip|vacation|flight|hotel|travel|hawaii|passport)\b/i
  if (thoughts.some((t) => trip.test(t.text)) || trip.test(joined)) {
    const place = keywords.find((k) => k.length > 4) ?? keywords[0]
    return `${cap(place)} trip`
  }
  return cap(keywords.slice(0, 2).join(' '))
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
