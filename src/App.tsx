import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { Category, LearnedRule, Thought } from './types'
import { CATEGORIES } from './types'
import WorryFollowUp, { revisitFridayIso } from './components/WorryFollowUp'
import BrainSweep from './components/BrainSweep'
import { askWithEndpoint, localAsk } from './lib/askShared'
import { brainSweepQueue, markSweepDone, sweepDue } from './lib/brainSweep'
import { findClarifyPrompts } from './lib/clarify'
import { findEchoes } from './lib/duplicates'
import { settleSummary } from './lib/settleSummary'
import { isWaiting } from './lib/waiting'
import { waitingLabel, waitingLoops } from './lib/waitingLoops'
import {
  assign,
  dueLabel,
  isActive,
  snoozeTarget,
} from './lib/assign'
import {
  briefIntro,
  dumpFromLocation,
  greetingForHour,
  searchThoughts,
  splitDump,
  titleFromText,
  urgencyScore,
} from './lib/classify'
import { fileLocally, fileWithEndpoint } from './lib/fileThoughts'
import { learnFromCorrection } from './lib/learn'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import { createRecognizer, speechSupported } from './lib/speech'
import { peopleRadar, staleLabel } from './lib/peopleRadar'
import { personDraft, personMessage } from './lib/personDraft'
import { previewDraft } from './lib/preview'
import { detectProjectHints, type ProjectHint } from './lib/projectHints'
import { exportJson, loadState, saveState, uid } from './lib/storage'
import { fromSyncCode, mergeSyncState, toSyncCode } from './lib/syncCode'
import { staleDays, staleSweep } from './lib/staleSweep'
import './index.css'

type View = 'brief' | 'all' | 'ask'
type ListFilter = Category | 'all' | 'due' | 'waiting'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function labelFor(category: Category): string {
  return CATEGORIES.find((c) => c.id === category)?.label ?? category
}

function thoughtScore(t: Thought): number {
  let s = urgencyScore(t.text)
  if (t.dueAt) {
    const due = new Date(t.dueAt).getTime()
    const now = Date.now()
    if (due < now) s += 20
    else {
      const hours = (due - now) / 36e5
      if (hours < 12) s += 12
      else if (hours < 36) s += 6
    }
  }
  if (t.category === 'do') s += 3
  if (t.category === 'people') s += 2
  if (t.category === 'later' || t.category === 'note') s -= 4
  return s
}

function rankOpen(items: Thought[]): Thought[] {
  return [...items].sort((a, b) => {
    const u = thoughtScore(b) - thoughtScore(a)
    if (u !== 0) return u
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function PineMark() {
  return (
    <svg className="pine" viewBox="0 0 80 96" aria-hidden="true">
      <path
        fill="currentColor"
        d="M40 4 52 28h-8l12 18h-9l13 22H20l13-22h-9l12-18h-8L40 4Z"
      />
      <path fill="currentColor" d="M36 68h8v12h-8z" />
      <path
        stroke="#2F6F6A"
        strokeWidth="2.2"
        strokeLinecap="round"
        d="M18 84h44"
      />
      <path
        stroke="#2F6F6A"
        strokeWidth="2"
        strokeLinecap="round"
        d="M24 89h32"
      />
    </svg>
  )
}

export default function App() {
  PLACEHOLDER_PART1
}
