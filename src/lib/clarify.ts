import type { Category, LearnedRule } from '../types'
import { classify } from './classify'

export type ClarifyChoice = {
  label: string
  category: Category
}

export type ClarifyPrompt = {
  chunkIndex: number
  text: string
  question: string
  choices: ClarifyChoice[]
}

const AMBIGUOUS_CALL =
  /^(call|text|email|message|ping|remind|ask|tell)\s+[a-z]{2,14}$/i

const REMEMBER = /^remember\b/i

/** One useful question when classification confidence is low. */
export function findClarifyPrompts(
  chunks: string[],
  learned: LearnedRule[] = [],
): ClarifyPrompt[] {
  const out: ClarifyPrompt[] = []

  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i].trim()
    if (!text) continue

    const cat = classify(text, learned)
    const learnedHit = learned.some((r) =>
      text.toLowerCase().includes(r.phrase.toLowerCase()),
    )
    if (learnedHit) continue

    if (AMBIGUOUS_CALL.test(text)) {
      out.push({
        chunkIndex: i,
        text,
        question: `"${text}" — what kind of loop is this?`,
        choices: [
          { label: 'Do it', category: 'do' },
          { label: 'Reach out', category: 'people' },
          { label: 'Just remember', category: 'note' },
        ],
      })
      continue
    }

    if (REMEMBER.test(text) && cat === 'note') {
      out.push({
        chunkIndex: i,
        text,
        question: `"${text}" — reminder or something to do?`,
        choices: [
          { label: 'Reminder', category: 'note' },
          { label: 'To do', category: 'do' },
          { label: 'Later', category: 'later' },
        ],
      })
    }
  }

  return out.slice(0, 2)
}
