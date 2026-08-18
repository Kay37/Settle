import type { Thought } from '../types'

/** Human relief line after a successful settle. */
export function settleSummary(created: Thought[], nextTop: Thought | null): string {
  const n = created.length
  const worries = created.filter((t) => t.category === 'worry').length
  const waiting = created.filter((t) => t.status === 'waiting').length
  const today = created.filter(
    (t) => t.category === 'do' || t.category === 'people',
  ).length

  const parts = [`Settled ${n} thought${n === 1 ? '' : 's'}`]
  if (worries) parts.push(`${worries} worry${worries === 1 ? '' : 'ies'} parked`)
  if (waiting) parts.push(`${waiting} waiting`)
  if (today) parts.push(`${today} for today`)

  if (nextTop) {
    const action = nextTop.nextAction || nextTop.title
    parts.push(`Next: ${action}`)
  }

  return parts.join(' · ')
}
