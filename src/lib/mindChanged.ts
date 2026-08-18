import type { Category, Thought } from '../types'
import { classify } from './classify'
import { normalizeForMatch } from './duplicates'

const FLIP =
  /\b(actually|never mind|nevermind|instead|changed my mind|don't need|dont need|is fine|nixed|cancelled|canceled|won't|will not|battery instead)\b/i

/** True when an edit looks like a meaning change, not a typo fix. */
export function looksLikeMindChanged(before: string, after: string): boolean {
  const a = before.trim()
  const b = after.trim()
  if (!a || !b || a === b) return false

  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (na === nb) return false

  if (Math.abs(a.length - b.length) <= 2 && nb.includes(na.slice(0, 8))) {
    return false
  }

  const tokensA = new Set(na.split(' ').filter((w) => w.length > 3))
  const tokensB = new Set(nb.split(' ').filter((w) => w.length > 3))
  let shared = 0
  for (const w of tokensA) if (tokensB.has(w)) shared += 1
  const union = new Set([...tokensA, ...tokensB]).size
  if (union > 0 && shared / union >= 0.55) return false

  return true
}

export function suggestedCategoryAfterEdit(
  text: string,
  previous: Category,
): Category | null {
  const next = classify(text)
  return next !== previous ? next : null
}

/** Open do/think loop this dump looks like a change of mind about. */
export function findSuperseded(
  text: string,
  thoughts: Thought[],
  now = new Date(),
): Thought | null {
  if (!FLIP.test(text)) return null
  const nb = normalizeForMatch(text)
  const tokensB = new Set(nb.split(' ').filter((w) => w.length > 3))
  if (!tokensB.size) return null
  const cutoff = now.getTime() - 30 * 864e5
  let best: { thought: Thought; shared: number } | null = null
  for (const t of thoughts) {
    if (t.private || t.status === 'done' || t.status === 'parked') continue
    if (t.category !== 'do' && t.category !== 'think') continue
    if (new Date(t.createdAt).getTime() < cutoff) continue
    const na = normalizeForMatch(t.text)
    const tokensA = new Set(na.split(' ').filter((w) => w.length > 3))
    let shared = 0
    for (const w of tokensA) if (tokensB.has(w)) shared += 1
    if (shared < 1) continue
    if (!looksLikeMindChanged(t.text, text)) continue
    if (!best || shared > best.shared) best = { thought: t, shared }
  }
  return best?.thought ?? null
}
