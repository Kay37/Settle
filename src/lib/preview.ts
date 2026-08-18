import type { Category, LearnedRule } from '../types'
import { assign } from './assign'
import { classify, classifyConfidence, splitDump, titleFromText } from './classify'

export type PreviewItem = {
  text: string
  title: string
  category: Category
  person: string | null
  dueLabel: string | null
  confidence: number
}

export function previewDraft(
  raw: string,
  learned: LearnedRule[] = [],
): PreviewItem[] {
  const chunks = splitDump(raw)
  if (!chunks.length) return []

  return chunks.slice(0, 8).map((text) => {
    const category = classify(text, learned)
    const a = assign(text)
    const title = a.nextAction || titleFromText(text)
    let dueLabel: string | null = null
    if (a.dueAt) {
      const due = new Date(a.dueAt)
      const now = new Date()
      const sameDay =
        due.toDateString() === now.toDateString()
      dueLabel = sameDay
        ? 'Today'
        : due.toLocaleDateString(undefined, { weekday: 'short' })
    }
    return {
      text,
      title,
      category,
      person: a.person,
      dueLabel,
      confidence: classifyConfidence(text, category, learned),
    }
  })
}
