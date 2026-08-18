import type { Thought } from '../types'

function icsStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** One timed event for a dated thought. */
export function thoughtToIcs(thought: Thought, now = new Date()): string | null {
  if (!thought.dueAt) return null
  const start = new Date(thought.dueAt)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const title = thought.nextAction || thought.title
  const desc = thought.text !== title ? thought.text : ''
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Settle//Dump box//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${thought.id}@settle.app`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    desc ? `DESCRIPTION:${escapeIcs(desc)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .filter((line) => line !== null)
    .join('\r\n')
}

export function downloadIcs(thought: Thought): boolean {
  const ics = thoughtToIcs(thought)
  if (!ics || typeof document === 'undefined') return false
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `settle-${thought.id.slice(0, 8)}.ics`
  a.click()
  URL.revokeObjectURL(url)
  return true
}
