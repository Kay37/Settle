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
import { gentleInsights } from './insights.ts'
import { looksLikeMindChanged, suggestedCategoryAfterEdit, findSuperseded } from './mindChanged.ts'
import { nextThree } from './rank.ts'
import { thoughtToIcs } from './calendar.ts'
import { dueForReminder } from './reminders.ts'
import { classifyConfidence } from './classify.ts'
import { mentionCount } from './duplicates.ts'
import { possibleSteps } from './possibleSteps.ts'
import { peopleMentioned, recentCaptured } from './memory.ts'
import { carriedOverOpen } from './carriedOver.ts'

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

assert(looksLikeMindChanged('buy milk', 'worried about the meeting'), 'mind changed')
assert(!looksLikeMindChanged('buy milk', 'buy milks'), 'typo not mind change')
assert(suggestedCategoryAfterEdit('worried about talk', 'do') === 'worry', 'refile suggest')

const laptop: Thought = {
  id: 'lap',
  text: 'definitely need a new laptop, this one is dying',
  title: 'new laptop',
  category: 'think',
  status: 'open',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}
assert(
  findSuperseded('actually the laptop is fine if I replace the battery', [laptop])?.id === 'lap',
  'mind-changed supersede',
)

const privateThought: Thought = {
  id: 'priv',
  text: 'secret passport number',
  title: 'passport',
  category: 'note',
  status: 'open',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  private: true,
}
assert(localAsk([privateThought], 'passport').length === 0, 'ask skips private')
assert(findEchoes('call dentist', thoughts, 1, [thoughts[1].text]).length === 0, 'muted echo')

const insightThoughts: Thought[] = [
  ...clusterThoughts,
  { id: 'c3', text: 'pack for hawaii', title: 'Pack', category: 'do', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString(), project: 'Hawaii trip' },
]
assert(gentleInsights(insightThoughts, now).length >= 1, 'gentle insights')

const ranked = nextThree([
  { id: 'n1', text: 'buy milk today', title: 'buy milk', category: 'do', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString(), dueAt: now.toISOString() },
  { id: 'n2', text: 'wifi password', title: 'wifi', category: 'note', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString() },
], now)
assert(ranked.length === 1 && ranked[0].id === 'n1', 'next three skips notes')

const ics = thoughtToIcs({
  id: 'cal1',
  text: 'dentist',
  title: 'dentist',
  category: 'do',
  status: 'open',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  dueAt: '2026-08-18T15:00:00.000Z',
})
assert(ics !== null && ics.includes('BEGIN:VEVENT') && ics.includes('dentist'), 'ics export')

const remind = dueForReminder([
  { id: 'd1', text: 'pay bill', title: 'pay bill', category: 'do', status: 'open', createdAt: now.toISOString(), updatedAt: now.toISOString(), dueAt: '2026-08-17T12:00:00.000Z' },
], now)
assert(remind.length === 1, 'due reminder')

assert(classifyConfidence('wifi password is orchid', 'note') < 0.55, 'low confidence notes')
assert(mentionCount('call dentist', thoughts) >= 2, 'mention count')
assert(possibleSteps(thoughts[1]).length >= 1, 'possible steps')
assert(peopleMentioned(thoughts).some((p) => p.person === 'Sam'), 'people memory')
assert(recentCaptured(thoughts, 24, now).length >= 0, 'recent captured')

const yesterday = new Date(now)
yesterday.setDate(yesterday.getDate() - 1)
const oldOpen: Thought = {
  id: 'old',
  text: 'finish report',
  title: 'report',
  category: 'do',
  status: 'open',
  createdAt: yesterday.toISOString(),
  updatedAt: yesterday.toISOString(),
}
assert(carriedOverOpen([oldOpen]).length === 1, 'carried over open loops')

console.log('features.selftest: all passed')
