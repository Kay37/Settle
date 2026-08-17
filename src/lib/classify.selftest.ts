import {
  classify,
  dumpFromLocation,
  splitDump,
  titleFromText,
  urgencyScore,
} from './classify.ts'
import { applyLearned } from './learn.ts'
import { assign, extractPerson, parseDueAt } from './assign.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(classify('buy oat milk and paper towels') === 'do', 'errand → do')
assert(classify('text Sam about dinner Sunday') === 'people', 'person → people')
assert(classify('text sam about dinner') === 'people', 'lowercase name → people')
assert(classify('worried I forgot to renew my passport') === 'worry', 'worry')
assert(classify('idea: build a tiny packing list app') === 'think', 'idea → think')
assert(classify('someday learn pottery') === 'later', 'later')
assert(classify('wifi password is orchid-42') === 'note', 'note')
assert(classify('call the bank about the fee') === 'do', 'call bank → do')

assert(classify('passport renewal packet', [{ phrase: 'passport', category: 'do' }]) === 'do', 'learned')
assert(applyLearned('passport renewal', [{ phrase: 'passport', category: 'do' }]) === 'do', 'apply learned')

const parts = splitDump('buy milk\ncall mom\nidea for the porch')
assert(parts.length === 3, 'split lines')
assert(titleFromText('a'.repeat(100)).endsWith('…'), 'title truncates')
assert(urgencyScore('do this today asap') > urgencyScore('maybe someday'), 'urgency')

const deep = dumpFromLocation('?dump=hello%20world&unload=1', '')
assert(deep.text === 'hello world', 'dump param')
assert(deep.autoUnload === true, 'auto unload')

const now = new Date('2026-08-17T15:00:00')
const dueTomorrow = parseDueAt('text Sam tomorrow', now)
assert(dueTomorrow !== null && dueTomorrow.getDate() === 18, 'tomorrow date')
assert(extractPerson('text Sam tomorrow') === 'Sam', 'person Sam')
assert(extractPerson('call mom tonight') === 'Mom', 'person Mom')
assert(assign('buy oat milk today', now).dueAt !== null, 'today due')

console.log('classify.selftest: all passed')
