import type { Thought } from '../types'

/** On-demand next steps — never auto-created as thoughts. */
export function possibleSteps(thought: Thought): string[] {
  const t = thought.text.toLowerCase()
  if (thought.category === 'worry') {
    return ['Ten-minute prep', 'Park until Friday', 'Name what would help']
  }
  if (thought.category === 'think' || /\b(decide|should i|what if)\b/.test(t)) {
    return ['List two options', 'Ask one person', 'Sleep on it']
  }
  if (thought.category !== 'do') return []
  if (/\b(flight|hotel|book|reservation)\b/.test(t)) {
    return ['Open the booking', 'Check dates', 'Confirm the email']
  }
  if (/\b(buy|get|grocery|groceries|store)\b/.test(t)) {
    return ['Add to the list', 'Do it today', 'Skip for now']
  }
  return ['Do the next physical step', 'Pick a time', 'Park for later']
}
