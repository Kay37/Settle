import type { Category, LearnedRule } from '../types'

const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'need',
  'want',
  'just',
  'about',
  'into',
  'your',
  'their',
  'them',
  'then',
  'than',
  'when',
  'what',
  'which',
  'while',
  'would',
  'could',
  'should',
  'today',
  'tomorrow',
  'tonight',
  'later',
  'maybe',
  'also',
])

export function applyLearned(text: string, learned: LearnedRule[]): Category | null {
  const hay = text.toLowerCase()
  let best: LearnedRule | null = null
  for (const rule of learned) {
    if (!rule.phrase) continue
    if (hay.includes(rule.phrase.toLowerCase())) {
      if (!best || rule.phrase.length > best.phrase.length) best = rule
    }
  }
  return best?.category ?? null
}

export function learnFromCorrection(
  text: string,
  category: Category,
  learned: LearnedRule[],
): LearnedRule[] {
  const phrases = phrasesFrom(text)
  if (!phrases.length) return learned
  const next = learned.slice()
  for (const phrase of phrases) {
    const idx = next.findIndex((r) => r.phrase === phrase)
    if (idx >= 0) next[idx] = { phrase, category }
    else next.push({ phrase, category })
  }
  return next.slice(-80)
}

function phrasesFrom(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ')
  const words = clean.split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w))
  const out: string[] = []
  if (words.length >= 2) out.push(`${words[0]} ${words[1]}`)
  if (words[0]) out.push(words[0])
  return [...new Set(out)].slice(0, 2)
}
