import type { Thought } from '../types.ts'
import { previewDraft } from './preview.ts'
import { peopleRadar, staleLabel } from './peopleRadar.ts'
import { fromSyncCode, toSyncCode } from './syncCode.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const preview = previewDraft('buy milk\ntext Sam tomorrow', [])
assert(preview.length === 2, 'preview splits')
assert(preview[0].category === 'do', 'preview do')
assert(preview[1].category === 'people', 'preview people')
assert(preview[1].person === 'Sam', 'preview person')

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
    text: 'call Mom',
    title: 'Call Mom',
    category: 'people',
    status: 'open',
    createdAt: '2026-08-15T12:00:00.000Z',
    updatedAt: '2026-08-15T12:00:00.000Z',
    person: 'Mom',
  },
]

const radar = peopleRadar(thoughts, now)
assert(radar.length === 2, 'radar groups people')
assert(radar[0].person === 'Sam', 'overdue Sam first')
assert(radar[0].overdue === true, 'Sam overdue')
assert(staleLabel(7) === '1 week+', 'stale label week')

const state = {
  version: 2 as const,
  thoughts,
  learned: [{ phrase: 'passport', category: 'do' as const }],
}
const code = toSyncCode(state)
const restored = fromSyncCode(code)
assert(restored?.thoughts.length === 2, 'sync round-trip thoughts')
assert(restored?.learned.length === 1, 'sync round-trip learned')
assert(fromSyncCode('not-valid') === null, 'sync rejects garbage')

console.log('features.selftest: all passed')
