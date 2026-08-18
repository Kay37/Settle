import type { Thought } from '../types'

export type PersonMemory = {
  person: string
  count: number
}

export function peopleMentioned(thoughts: Thought[]): PersonMemory[] {
  const map = new Map<string, number>()
  for (const t of thoughts) {
    const p = t.person?.trim()
    if (!p) continue
    map.set(p, (map.get(p) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([person, count]) => ({ person, count }))
    .sort((a, b) => b.count - a.count || a.person.localeCompare(b.person))
}

export function recentCaptured(
  thoughts: Thought[],
  hours = 24,
  now = new Date(),
): Thought[] {
  const cutoff = now.getTime() - hours * 36e5
  return thoughts
    .filter((t) => new Date(t.createdAt).getTime() >= cutoff)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
}
