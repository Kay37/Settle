import {
  classify,
  classifyConfidence,
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

const plusParts = splitDump('hawaii flight + hawaii hotel')
assert(plusParts.length === 2, 'split plus')
assert(plusParts[0] === 'hawaii flight', 'plus part 1')
assert(plusParts[1] === 'hawaii hotel', 'plus part 2')
assert(classify('hawaii flight') === 'do', 'flight → do')
assert(classify('hawaii hotel') === 'do', 'hotel → do')
assert(classifyConfidence('hawaii flight', 'do') > 0.5, 'flight confidence')
assert(titleFromText('a'.repeat(100)).endsWith('…'), 'title truncates')
assert(urgencyScore('do this today asap') > urgencyScore('maybe someday'), 'urgency')

const deep = dumpFromLocation('?dump=hello%20world&unload=1', '')
assert(deep.text === 'hello world', 'dump param')
assert(deep.autoUnload === true, 'auto unload')

const shared = dumpFromLocation('?text=buy%20milk&title=Note', '')
assert(shared.text === 'buy milk', 'share text')
const sharedUrl = dumpFromLocation('?title=Link&url=https://example.com', '')
assert(sharedUrl.text.includes('Link') && sharedUrl.text.includes('example.com'), 'share title+url')

const now = new Date('2026-08-17T15:00:00')
const dueTomorrow = parseDueAt('text Sam tomorrow', now)
assert(dueTomorrow !== null && dueTomorrow.getDate() === 18, 'tomorrow date')
assert(extractPerson('text Sam tomorrow') === 'Sam', 'person Sam')
assert(extractPerson('call mom tonight') === 'Mom', 'person Mom')
assert(assign('buy oat milk today', now).dueAt !== null, 'today due')
assert(parseDueAt('this weekend', now) !== null, 'this weekend')
assert(parseDueAt('in 2 weeks', now) !== null, 'two weeks')
assert(parseDueAt('before mom visit', now) !== null, 'before visit')
const aug = parseDueAt('august 20', now)
assert(aug !== null && aug.getMonth() === 7 && aug.getDate() === 20, 'month name')

console.log('classify.selftest: all passed')
