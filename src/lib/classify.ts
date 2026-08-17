import type { Category, LearnedRule } from '../types'
import { applyLearned } from './learn'

const DO_WORDS =
  /\b(buy|get|pick up|grab|call|email|text|schedule|book|pay|fix|send|submit|order|renew|cancel|return|mail|ship|wash|clean|drop off|grocery|groceries|appointment|deadline|todo|to-do|need to|have to|gotta|must|errand|finish|complete|reply|respond|print|pickup)\b/i

const PEOPLE_WORDS =
  /\b(mom|dad|mum|mama|papa|sister|brother|friend|partner|wife|husband|girlfriend|boyfriend|fiancé|fiancee|boss|coworker|colleague|dentist|doctor|therapist|landlord|roommate|reach out|follow up|check in|catch up|wish .+ happy|birthday|congrats|congratulate|thank)\b/i

const PEOPLE_NAME =
  /\b(call|text|email|message|ping|remind|ask|tell|visit|meet|facetime)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[a-z]{2,14})\b/

const PEOPLE_STOP = new Set([
  'the',
  'my',
  'a',
  'an',
  'this',
  'that',
  'him',
  'her',
  'them',
  'someone',
  'anyone',
  'back',
  'home',
  'work',
  'about',
  'bank',
  'store',
  'doctor',
  'dentist',
])

const THINK_WORDS =
  /\b(idea|maybe|what if|consider|decide|decision|wonder|curious|brainstorm|project|side project|build|startup|concept|hypothesis|should i|ponder|riff)\b/i

const WORRY_WORDS =
  /\b(worried|worry|anxious|anxiety|stressed|stress|afraid|scared|nervous|overwhelmed|dread|can't stop thinking|cant stop thinking|spiraling|panic|rumina|uneasy|on my mind)\b/i

const LATER_WORDS =
  /\b(someday|eventually|later|when i have time|not urgent|low priority|wishlist|bucket|maybe later|park this|back burner|one day|not today)\b/i

const URGENCY =
  /\b(today|tonight|tomorrow|asap|urgent|immediately|this morning|this afternoon|eod|by friday|deadline|overdue|now)\b/i

/** Split a messy dump into individual thoughts. */
export function splitDump(raw: string): string[] {
  const cleaned = raw.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []

  const byLine = cleaned
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)

  if (byLine.length > 1) return byLine

  if ((cleaned.match(/;/g) ?? []).length >= 2) {
    return cleaned
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
  }

  if (cleaned.length > 140 && /[.!?];?\s+/.test(cleaned)) {
    return cleaned
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
  }

  if (cleaned.length > 100 && /\band also\b/i.test(cleaned)) {
    return cleaned
      .split(/\band also\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
  }

  const errandList = cleaned.split(/\s*,\s*(?:and\s+)?|\s+and\s+/).map((s) => s.trim())
  if (
    errandList.length >= 3 &&
    errandList.every((p) => p.length > 2 && p.length < 80) &&
    errandList.filter((p) => DO_WORDS.test(p) || PEOPLE_NAME.test(p)).length >= 2
  ) {
    return errandList
  }

  return [cleaned]
}

export function titleFromText(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 72) return oneLine
  const cut = oneLine.slice(0, 72)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function looksLikePersonMention(text: string): boolean {
  if (PEOPLE_WORDS.test(text)) return true
  const m = text.match(PEOPLE_NAME)
  if (!m) return false
  const name = (m[2] ?? '').toLowerCase()
  return Boolean(name) && !PEOPLE_STOP.has(name)
}

export function classify(text: string, learned: LearnedRule[] = []): Category {
  const learnedHit = applyLearned(text, learned)
  if (learnedHit) return learnedHit

  const t = text.trim()

  if (WORRY_WORDS.test(t)) return 'worry'
  if (looksLikePersonMention(t)) return 'people'
  if (LATER_WORDS.test(t)) return 'later'
  if (THINK_WORDS.test(t) && !DO_WORDS.test(t)) return 'think'
  if (DO_WORDS.test(t)) return 'do'
  if (THINK_WORDS.test(t)) return 'think'

  if (
    t.length < 90 &&
    /^(buy|get|grab|call|email|text|pay|fix|send|book|finish|reply|print)\b/i.test(t)
  ) {
    return 'do'
  }

  if (/\?$/.test(t) || /^(should|what|why|how|when|where|who)\b/i.test(t)) {
    return 'think'
  }

  return 'note'
}

export function urgencyScore(text: string): number {
  let score = 0
  if (URGENCY.test(text)) score += 5
  if (/\btoday\b/i.test(text)) score += 3
  if (/\basap\b|\burgent\b/i.test(text)) score += 4
  if (/\btomorrow\b/i.test(text)) score += 2
  return score
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Late night clear-out'
  if (hour < 12) return 'Morning settle'
  if (hour < 17) return 'Afternoon clear'
  if (hour < 21) return 'Evening dump'
  return 'Wind-down settle'
}

export function briefIntro(openCount: number): string {
  if (openCount === 0) return 'Your head is clear. Dump anything that shows up.'
  if (openCount === 1) return 'One open loop. Finish it or park it.'
  if (openCount < 5) return `${openCount} open loops — pick a few, ignore the rest.`
  return `${openCount} open loops. Don’t organize — just pick what’s next.`
}

export function dumpFromLocation(search: string, hash: string): {
  text: string
  autoUnload: boolean
} {
  const params = new URLSearchParams(search)
  if (hash.startsWith('#')) {
    const hp = new URLSearchParams(hash.slice(1))
    for (const [k, v] of hp.entries()) {
      if (!params.has(k)) params.set(k, v)
    }
  }

  const text = (
    params.get('dump') ||
    params.get('text') ||
    params.get('q') ||
    params.get('body') ||
    ''
  ).trim()

  const autoUnload =
    params.get('unload') === '1' ||
    params.get('settle') === '1' ||
    params.get('auto') === '1' ||
    params.get('submit') === '1'

  return { text, autoUnload }
}

export function searchThoughts<T extends { title: string; text: string; person?: string | null }>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/).filter((t) => t.length > 1)
  return items
    .map((item) => {
      const hay = `${item.title} ${item.text} ${item.person ?? ''}`.toLowerCase()
      let score = 0
      if (hay.includes(q)) score += 8
      for (const tok of tokens) if (hay.includes(tok)) score += 2
      return { item, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.item)
}
