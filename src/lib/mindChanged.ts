import type { Category } from '../types'
import { classify } from './classify'
import { normalizeForMatch } from './duplicates'

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
