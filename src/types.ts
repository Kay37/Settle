export type Category =
  | 'do'
  | 'people'
  | 'think'
  | 'worry'
  | 'later'
  | 'note'

export type ThoughtStatus = 'open' | 'done' | 'parked' | 'waiting'

export interface LearnedRule {
  phrase: string
  category: Category
}

export interface Thought {
  id: string
  text: string
  title: string
  category: Category
  status: ThoughtStatus
  createdAt: string
  updatedAt: string
  dueAt?: string | null
  person?: string | null
  nextAction?: string
  snoozeUntil?: string | null
  project?: string | null
}

export interface AppState {
  thoughts: Thought[]
  learned: LearnedRule[]
  version: 2
}

export const CATEGORIES: {
  id: Category
  label: string
  hint: string
}[] = [
  { id: 'do', label: 'Do', hint: 'Errands & next actions' },
  { id: 'people', label: 'People', hint: 'Reach out & follow-ups' },
  { id: 'think', label: 'Think', hint: 'Ideas & decisions' },
  { id: 'worry', label: 'Worry', hint: 'Park it, don’t carry it' },
  { id: 'later', label: 'Later', hint: 'Not today' },
  { id: 'note', label: 'Note', hint: 'Reference & scraps' },
]
