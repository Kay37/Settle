import { PEOPLE_STOP } from './peopleStop'

export type Assignment = {
  dueAt: string | null
  person: string | null
  nextAction: string
}

const RELATIVES: Record<string, string> = {
  mom: 'Mom',
  mum: 'Mom',
  mama: 'Mom',
  dad: 'Dad',
  papa: 'Dad',
  sister: 'Sister',
  brother: 'Brother',
  wife: 'Partner',
  husband: 'Partner',
  partner: 'Partner',
  girlfriend: 'Partner',
  boyfriend: 'Partner',
  boss: 'Boss',
  roommate: 'Roommate',
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

function atHour(base: Date, hour: number, minute = 0): Date {
  const d = new Date(base)
  d.setHours(hour, minute, 0, 0)
  return d
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from)
  const diff = (weekday + 7 - d.getDay()) % 7
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff))
  return atHour(d, 9)
}

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
}

function parseMonthDay(text: string, now: Date): Date | null {
  const named = text.match(
    /\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|may)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  )
  if (named) {
    const month = MONTHS[named[1].toLowerCase()]
    const day = Number(named[2])
    if (month === undefined || day < 1 || day > 31) return null
    const d = new Date(now.getFullYear(), month, day, 9, 0, 0, 0)
    if (d.getTime() < now.getTime() - 36e5) d.setFullYear(d.getFullYear() + 1)
    return d
  }
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (!slash) return null
  const month = Number(slash[1]) - 1
  const day = Number(slash[2])
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  let year = now.getFullYear()
  if (slash[3]) {
    year = Number(slash[3])
    if (year < 100) year += 2000
  }
  const d = new Date(year, month, day, 9, 0, 0, 0)
  if (!slash[3] && d.getTime() < now.getTime() - 36e5) {
    d.setFullYear(d.getFullYear() + 1)
  }
  return d
}

function parseClock(text: string): { hour: number; minute: number } | null {
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  if (!m) return null
  let hour = Number(m[1])
  const minute = m[2] ? Number(m[2]) : 0
  const ap = (m[3] ?? '').toLowerCase()
  if (ap === 'pm' && hour < 12) hour += 12
  if (ap === 'am' && hour === 12) hour = 0
  if (!ap && hour >= 1 && hour <= 7) hour += 12
  if (hour > 23 || minute > 59) return null
  if (!ap && !/\b(at|am|pm|:)\b/i.test(m[0]) && hour > 12) return null
  if (!ap && !m[2] && !/\bat\s+\d/i.test(text)) return null
  return { hour, minute }
}

export function parseDueAt(text: string, now = new Date()): Date | null {
  const t = text.toLowerCase()
  let due: Date | null = null

  if (/\btoday\b|\bthis morning\b/.test(t)) due = atHour(now, 9)
  else if (/\bthis afternoon\b/.test(t)) due = atHour(now, 14)
  else if (/\b(tonight|this evening)\b/.test(t)) due = atHour(now, 20)
  else if (/\btomorrow\b/.test(t)) due = atHour(addDays(now, 1), 9)
  else if (/\bnext week\b/.test(t)) due = atHour(addDays(now, 7), 9)
  else if (/\bin a week\b/.test(t)) due = atHour(addDays(now, 7), 9)
  else if (/\bin\s+2\s+weeks?\b/.test(t)) due = atHour(addDays(now, 14), 9)
  else if (/\bthis weekend\b/.test(t)) {
    const day = now.getDay()
    const toSat = (6 - day + 7) % 7 || 7
    due = atHour(addDays(now, toSat), 9)
  } else if (/\bafter (my )?(vacation|trip|holiday)\b/.test(t)) {
    due = atHour(addDays(now, 14), 9)
  } else if (/\bbefore .+(visit|trip|meeting|party)\b/.test(t)) {
    due = atHour(addDays(now, 7), 9)
  } else {
    const monthDue = parseMonthDay(t, now)
    if (monthDue) due = monthDue
    else {
      const inDays = t.match(/\bin\s+(\d+)\s+days?\b/)
      if (inDays) due = atHour(addDays(now, Number(inDays[1])), 9)
    }
  }

  if (!due) {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const re = new RegExp('\\b(this|next|on)?\\s*' + WEEKDAYS[i] + '\\b')
      if (re.test(t)) {
        due = nextWeekday(now, i)
        if (t.includes('this') && now.getDay() === i) due = atHour(now, 9)
        break
      }
    }
  }

  const clock = parseClock(text)
  if (clock) {
    const base = due ? new Date(due) : new Date(now)
    due = atHour(base, clock.hour, clock.minute)
    if (!due || due.getTime() < now.getTime() - 60_000) {
      if (!/\b(today|tonight|this)\b/.test(t)) due = addDays(due, 1)
    }
  }

  return due
}

export function extractPerson(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [key, label] of Object.entries(RELATIVES)) {
    if (new RegExp('\\b' + key + '\\b').test(lower)) return label
  }

  const named = text.match(
    /\b(?:call|text|email|message|ping|remind|ask|tell|visit|meet|facetime|reach(?:\s+out)?(?:\s+to)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[a-z]{2,14})\b/,
  )
  if (named) {
    const raw = named[1]
    if (!PEOPLE_STOP.has(raw.toLowerCase())) {
      return raw[0].toUpperCase() + raw.slice(1)
    }
  }

  const withName = text.match(/\bwith\s+([A-Z][a-z]{2,14})\b/)
  if (withName && !PEOPLE_STOP.has(withName[1].toLowerCase())) {
    return withName[1]
  }

  return null
}

export function nextActionFrom(text: string, person: string | null): string {
  let t = text
    .replace(/^(i\s+)?(need to|have to|gotta|remember to|don't forget to|dont forget to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const cut = t.split(/[.!?]/)[0]?.trim() ?? t
  if (cut.length <= 56) {
    if (person && /^(call|text|email|message|ping)\b/i.test(cut)) return cut
    return cut
  }
  const slice = cut.slice(0, 56)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > 24 ? slice.slice(0, lastSpace) : slice).trim() + '…'
}

export function assign(text: string, now = new Date()): Assignment {
  const person = extractPerson(text)
  const due = parseDueAt(text, now)
  return {
    person,
    dueAt: due ? due.toISOString() : null,
    nextAction: nextActionFrom(text, person),
  }
}

export function snoozeTarget(
  kind: 'tonight' | 'tomorrow' | 'weekend',
  now = new Date(),
): Date {
  if (kind === 'tonight') {
    const d = atHour(now, 20)
    return d.getTime() > now.getTime() ? d : atHour(addDays(now, 1), 20)
  }
  if (kind === 'tomorrow') return atHour(addDays(now, 1), 9)
  const day = now.getDay()
  const toSat = (6 - day + 7) % 7 || 7
  return atHour(addDays(now, toSat), 9)
}

export function isActive(snoozeUntil: string | null | undefined, now = new Date()): boolean {
  if (!snoozeUntil) return true
  return new Date(snoozeUntil).getTime() <= now.getTime()
}

export function dueLabel(dueAt: string | null | undefined, now = new Date()): string | null {
  if (!dueAt) return null
  const due = new Date(dueAt)
  const startToday = atHour(now, 0)
  const startTomorrow = addDays(startToday, 1)
  const startNext = addDays(startToday, 2)
  if (due < now && due < startToday) return 'Overdue'
  if (due >= startToday && due < startTomorrow) {
    return due < now ? 'Due now' : 'Due today'
  }
  if (due >= startTomorrow && due < startNext) return 'Due tomorrow'
  return 'Due ' + due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatDueTime(dueAt: string): string {
  return new Date(dueAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
