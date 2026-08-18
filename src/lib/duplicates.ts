import type { Thought } from '../types'

const STRIP =
  /^(i\s+)?(need to|have to|remember to|don't forget to|dont forget to|maybe|please)\s+/i

const VERBS =
  /^(call|text|email|message|ping|buy|get|schedule|book|pay|fix|send|remind|ask|tell|visit|meet)\s+/i

/** Normalize text for fuzzy duplicate matching. */
export function normalizeForMatch(text: string): string {
  let t = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(STRIP, '')
  t = t.replace(VERBS, '').replace(/\s+/g, ' ').trim()
  return t
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeForMatch(text)
      .split(' ')
      .filter((w) => w.length > 2),
  )
}

function overlapScore(a: string, b: string): number {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.92

  const ta = tokenSet(a)
  const tb = tokenSet(b)
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const tok of ta) if (tb.has(tok)) shared += 1
  return shared / Math.max(ta.size, tb.size)
}

/** Prior open/done thoughts that echo this dump line. */
export function findEchoes(
  text: string,
  thoughts: Thought[],
  limit = 1,
  muted: string[] = [],
): Thought[] {
  const mutedSet = new Set(muted.map((m) => normalizeForMatch(m)).filter(Boolean))
  const hits: { thought: Thought; score: number }[] = []
  for (const t of thoughts) {
    if (t.status === 'parked') continue
    if (t.private) continue
    if (mutedSet.has(normalizeForMatch(t.text))) continue
    const score = overlapScore(text, t.text)
    if (score >= 0.72) hits.push({ thought: t, score })
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => h.thought)
}

/** How often this loop has been dumped. */
export function mentionCount(text: string, thoughts: Thought[]): number {
  return 1 + findEchoes(text, thoughts, 20).length
}
