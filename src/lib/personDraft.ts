import type { Thought } from '../types'

/** Draft line for reaching out about an open people loop. */
export function personDraft(person: string, thought: Thought): string {
  const action = (thought.nextAction || thought.title).trim()
  const name = person.trim()

  if (/^(text|call|email|message|dm|ping)\s/i.test(action)) {
    return action
  }

  const topic = action
    .replace(new RegExp(`^${name}\\s*[:\\-–]?\\s*`, 'i'), '')
    .replace(/^(about|re)\s+/i, '')
    .trim()

  if (topic) return `text ${name} about ${topic}`
  return `text ${name}`
}

/** Clipboard-friendly message draft (no "text" prefix). */
export function personMessage(person: string, thought: Thought): string {
  const draft = personDraft(person, thought)
  return draft.replace(/^text\s+\S+\s+about\s+/i, '').trim() || draft
}
