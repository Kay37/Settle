import type { Thought } from '../types.ts'
import { previewDraft } from './preview.ts'
import { peopleRadar } from './peopleRadar.ts'
import { personDraft } from './personDraft.ts'
import { fromSyncCode, mergeSyncState, toSyncCode } from './syncCode.ts'
import { staleSweep } from './staleSweep.ts'
import { findEchoes, normalizeForMatch } from './duplicates.ts'
import { findClarifyPrompts } from './clarify.ts'
import { settleSummary } from './settleSummary.ts'
import { isWaiting } from './waiting.ts'
import { waitingLoops } from './waitingLoops.ts'
import { brainSweepQueue, sweepDue } from './brainSweep.ts'
import { detectProjectHints } from './projectHints.ts'
import { localAsk } from './askShared.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const preview = previewDraft('buy milk\ntext Sam tomorrow', [])
assert(preview.length === 2, 'preview splits')

const now = new Date('2026-08-17T15:00:00')
const thoughts: Thought[] = [
  {
    id: '1',
    text: 'text Sam about dinner',
    title: 'Text Sam about dinner',
    category: 'people',
    status: 'open',
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
    person: 'Sam',
    dueAt: '2026-08-16T09:00:00.000Z',
  },
  {
    id: '2',
    text: 'call dentist',
    title: 'Call dentist',
    category: 'do',
    status: 'open',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
  },
]

assert(normalizeForMatch('call dentist') === normalizeForMatch('call  dentist!'), 'normalize')
const echo = findEchoes('call dentist again', thoughts)
assert(echo.length === 1 && echo[0].id === '2', 'echo detection')

const clarify = findClarifyPrompts(['call john'], [])
assert(clarify.length === 1, 'clarify ambiguous call')

assert(isWaiting('waiting on John to reply'), 'waiting detect')
const waiting = waitingLoops([
  {
    id: 'w1',
    text: 'waiting on John',
    title: 'Waiting on John',
    category: 'people',
    status: 'waiting',
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
    person: 'John',
  },
])
assert(waiting.length === 1, 'waiting loops')

const summary = settleSummary(
  [
    {
      id: 'a',
      text: 'worried about talk',
      title: 'worried',
      category: 'worry',
      status: 'open',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'b',
      text: 'buy milk',
      title: 'buy milk',
      category: 'do',
      status: 'open',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ],
  { id: 'b', text: 'buy milk', title: 'buy milk', category: 'do', status: 'open', createdAt: '', updatedAt: '' },
)
assert(summary.includes('Settled 2'), 'settle summary')
assert(summary.includes('worry'), 'summary worries')

const draft = personDraft('Sam', thoughts[0])
assert(draft.includes('Sam'), 'person draft')

const radar = peopleRadar(thoughts, now)
assert(radar.length >= 1, 'radar')

const stale = staleSweep(thoughts, 7, 3, now)
assert(stale.some((t) => t.id === '2'), 'stale sweep')

const state = { version: 2 as const, thoughts, learned: [] }
const code = toSyncCode(state)
assert(fromSyncCode(code)?.thoughts.length === 2, 'sync round-trip')

const merged = mergeSyncState(
  { version: 2, thoughts: [thoughts[0]], learned: [] },
  { version: 2, thoughts: [{ ...thoughts[0], title: 'Updated', updatedAt: '2026-08-18T12:00:00.000Z' }], learned: [] },
)
assert(merged.thoughts[0].title === 'Updated', 'merge newer wins')

const clusterThoughts: Thought[] = [
  { id: 'c1', text: 'hawaii flight booking', title: 'Flights', category: 'do', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString() },
  { id: 'c2', text: 'hawaii hotel booking', title: 'Hotels', category: 'do', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString() },
]
const hints = detectProjectHints(clusterThoughts, now)
assert(hints.length >= 1, 'project hints')

const shortTrip: Thought[] = [
  { id: 't1', text: 'hawaii flight', title: 'Flight', category: 'do', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString() },
  { id: 't2', text: 'hawaii hotel', title: 'Hotel', category: 'do', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString() },
]
assert(detectProjectHints(shortTrip, now).length >= 1, 'trip hint from shared place')

const sweep = brainSweepQueue(thoughts, 5, now)
assert(Array.isArray(sweep), 'brain sweep queue')
assert(typeof sweepDue() === 'boolean', 'sweep due')

const askHits = localAsk(thoughts, 'sam')
assert(askHits.some((t) => t.person === 'Sam'), 'local ask')

console.log('features.selftest: all passed')
