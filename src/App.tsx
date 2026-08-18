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
  const initial = loadState()
  const [thoughts, setThoughts] = useState<Thought[]>(() => initial.thoughts)
  const [learned, setLearned] = useState<LearnedRule[]>(() => initial.learned)
  const [draft, setDraft] = useState('')
  const [view, setView] = useState<View>('brief')
  const [filter, setFilter] = useState<ListFilter>('all')
  const [query, setQuery] = useState('')
  const [ask, setAsk] = useState('')
  const [hideDone, setHideDone] = useState(true)
  const [listening, setListening] = useState(false)
  const [filing, setFiling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [undoIds, setUndoIds] = useState<string[] | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [canSpeak] = useState(() => speechSupported())
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, Category>>({})
  const [worryBatch, setWorryBatch] = useState<Thought[] | null>(null)
  const [reliefPulse, setReliefPulse] = useState(false)
  const [sweepQueue, setSweepQueue] = useState<Thought[]>([])
  const [sweepOpen, setSweepOpen] = useState(false)
  const [askHits, setAskHits] = useState<Thought[]>([])
  const [askSource, setAskSource] = useState<string | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const autoUnloadedRef = useRef(false)
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null)
  const interimRef = useRef('')
  const baseDraftRef = useRef('')
  const dumpShellRef = useRef<HTMLElement>(null)
  const projectSectionRef = useRef<HTMLDivElement>(null)

  const hour = new Date().getHours()
  const session = greetingForHour(hour)

  useEffect(() => {
    saveState({ version: 2, thoughts, learned })
  }, [thoughts, learned])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!toast) return
    const ms = undoIds ? 6000 : toast.includes('Settled') ? 4500 : 2400
    const t = window.setTimeout(() => setToast(null), ms)
    return () => window.clearTimeout(t)
  }, [toast, undoIds])

  useEffect(() => {
    return () => {
      try {
        recognizerRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    const { text, autoUnload } = dumpFromLocation(
      window.location.search,
      window.location.hash,
    )
    if (!text) return
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text))
    window.history.replaceState({}, '', window.location.pathname)
    if (autoUnload && !autoUnloadedRef.current) {
      autoUnloadedRef.current = true
      window.setTimeout(() => {
        void unloadText(text)
      }, 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setClarifyAnswers({})
  }, [draft])

  const activeOpen = useMemo(
    () =>
      thoughts.filter(
        (t) => t.status === 'open' && isActive(t.snoozeUntil),
      ),
    [thoughts],
  )

  const waitingItems = useMemo(() => waitingLoops(thoughts), [thoughts])

  const draftChunks = useMemo(
    () => (draft.trim() ? splitDump(draft) : []),
    [draft],
  )

  const clarifyPrompts = useMemo(
    () => findClarifyPrompts(draftChunks, learned),
    [draftChunks, learned],
  )

  const needsClarify = clarifyPrompts.some(
    (p) => clarifyAnswers[p.chunkIndex] === undefined,
  )

  const nextThree = useMemo(
    () =>
      rankOpen(
        activeOpen.filter((t) => t.category === 'do' || t.category === 'people'),
      ).slice(0, 3),
    [activeOpen],
  )

  const briefBuckets = useMemo(
    () => ({
      do: rankOpen(activeOpen.filter((t) => t.category === 'do')).slice(0, 5),
      people: rankOpen(activeOpen.filter((t) => t.category === 'people')).slice(
        0,
        4,
      ),
      worry: rankOpen(activeOpen.filter((t) => t.category === 'worry')).slice(
        0,
        2,
      ),
      think: rankOpen(activeOpen.filter((t) => t.category === 'think')).slice(
        0,
        3,
      ),
    }),
    [activeOpen],
  )

  const filtered = useMemo(() => {
    let list = thoughts
    if (hideDone) list = list.filter((t) => t.status !== 'done')
    if (filter === 'waiting') list = list.filter((t) => t.status === 'waiting')
    else if (filter === 'due') list = list.filter((t) => Boolean(t.dueAt) && t.status === 'open')
    else if (filter !== 'all') list = list.filter((t) => t.category === filter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.text.toLowerCase().includes(q) ||
          (t.person ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [thoughts, filter, query, hideDone])

  const askHitsLocal = useMemo(
    () => searchThoughts(thoughts, ask),
    [thoughts, ask],
  )

  useEffect(() => {
    const q = ask.trim()
    if (!q) {
      setAskHits([])
      setAskSource(null)
      setAskLoading(false)
      return
    }

    const local = localAsk(thoughts, q)
    setAskHits(local)
    setAskSource('local')

    if (!settings.useAi) {
      setAskLoading(false)
      return
    }

    const endpoint =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/ask`
        : '/api/ask'

    let cancelled = false
    setAskLoading(true)

    void askWithEndpoint(thoughts, q, endpoint, settings.filingToken).then(
      (result) => {
        if (cancelled) return
        const byId = new Map(thoughts.map((t) => [t.id, t]))
        const ordered = result.ids
          .map((id) => byId.get(id))
          .filter((t): t is Thought => Boolean(t))
        setAskHits(ordered.length ? ordered : local)
        setAskSource(result.source)
        setAskLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [ask, thoughts, settings.useAi, settings.filingToken])

  const projectHints = useMemo(() => detectProjectHints(thoughts), [thoughts])
  const sweepCandidates = useMemo(() => brainSweepQueue(thoughts), [thoughts])

  function startBrainSweep() {
    setSweepQueue(brainSweepQueue(thoughts))
    setSweepOpen(true)
  }

  function finishBrainSweep() {
    setSweepOpen(false)
    setSweepQueue([])
    markSweepDone()
    flash('Brain sweep done — head clearer')
  }

  function tagProject(name: string, ids: string[]) {
    const idSet = new Set(ids)
    const now = new Date().toISOString()
    setThoughts((prev) =>
      prev.map((t) =>
        idSet.has(t.id) ? { ...t, project: name, updatedAt: now } : t,
      ),
    )
    flash(`Tagged ${ids.length} as “${name}”`)
  }

  const draftPreview = useMemo(
    () => (draft.trim() ? previewDraft(draft, learned) : []),
    [draft, learned],
  )

  const radarLoops = useMemo(() => peopleRadar(thoughts), [thoughts])

  const staleItems = useMemo(() => staleSweep(thoughts, 7, 3), [thoughts])

  function draftReachOut(person: string, thought: Thought) {
    setDraft(personDraft(person, thought))
    dumpShellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    flash(`Draft ready for ${person}`)
  }

  async function copyReachOut(person: string, thought: Thought) {
    const msg = personMessage(person, thought)
    try {
      await navigator.clipboard.writeText(msg)
      flash('Message copied')
    } catch {
      flash(msg)
    }
  }

  function flash(message: string) {
    setToast(message)
  }

  async function unloadText(raw: string, answers = clarifyAnswers) {
    const chunks = splitDump(raw)
    if (!chunks.length) return

    setFiling(true)
    try {
      let filed =
        settings.useAi && settings.filingEndpoint.trim()
          ? await fileWithEndpoint(
              chunks,
              settings.filingEndpoint,
              settings.filingToken,
              learned,
            )
          : fileLocally(chunks, learned)

      filed = filed.map((item, index) => ({
        ...item,
        category: answers[index] ?? item.category,
      }))

      const now = new Date().toISOString()
      const created: Thought[] = filed.map((item) => {
        const waiting = isWaiting(item.text)
        return {
          id: uid(),
          text: item.text,
          title: item.title,
          category: waiting ? 'people' : item.category,
          status: waiting ? 'waiting' : 'open',
          createdAt: now,
          updatedAt: now,
          dueAt: item.dueAt,
          person: item.person,
          nextAction: item.nextAction,
          snoozeUntil: null,
        }
      })

      setThoughts((prev) => [...created, ...prev])
      setUndoIds(created.map((t) => t.id))
      setDraft('')
      setClarifyAnswers({})
      interimRef.current = ''
      baseDraftRef.current = ''

      const ranked = rankOpen(
        created.filter(
          (t) =>
            t.status === 'open' &&
            (t.category === 'do' || t.category === 'people'),
        ),
      )
      const summary = settleSummary(created, ranked[0] ?? null)
      flash(`${summary} · Undo`)

      setReliefPulse(true)
      window.setTimeout(() => setReliefPulse(false), 700)

      const worries = created.filter((t) => t.category === 'worry')
      if (worries.length) setWorryBatch(worries)

      const createdIds = new Set(created.map((t) => t.id))
      const freshHints = detectProjectHints([...created, ...thoughts])
      if (
        freshHints.some((hint) => hint.thoughts.some((t) => createdIds.has(t.id)))
      ) {
        window.setTimeout(() => {
          projectSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          })
        }, 120)
      }

      setView('brief')
    } finally {
      setFiling(false)
    }
  }

  function unload() {
    if (needsClarify) {
      flash('Answer the quick question first')
      return
    }
    void unloadText(draft)
  }

  function undoLast() {
    if (!undoIds?.length) return
    const ids = new Set(undoIds)
    setThoughts((prev) => prev.filter((t) => !ids.has(t.id)))
    setUndoIds(null)
    flash('Settle undone')
  }

  function updateThought(id: string, patch: Partial<Thought>) {
    setThoughts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next = { ...t, ...patch, updatedAt: new Date().toISOString() }
        if (patch.category && patch.category !== t.category) {
          setLearned((rules) => learnFromCorrection(t.text, patch.category!, rules))
        }
        return next
      }),
    )
  }

  function removeThought(id: string) {
    setThoughts((prev) => prev.filter((t) => t.id !== id))
  }

  function snooze(id: string, kind: 'tonight' | 'tomorrow' | 'weekend') {
    updateThought(id, { snoozeUntil: snoozeTarget(kind).toISOString() })
    flash(`Snoozed ${kind}`)
  }

  function toggleListen() {
    if (listening) {
      recognizerRef.current?.stop()
      setListening(false)
      return
    }

    baseDraftRef.current = draft
    interimRef.current = ''

    const rec = createRecognizer({
      onPartial: (text) => {
        interimRef.current = text
        const base = baseDraftRef.current
        setDraft(base ? `${base.trimEnd()} ${text}` : text)
      },
      onFinal: (text) => {
        const next = `${baseDraftRef.current} ${text}`.replace(/\s+/g, ' ').trim()
        baseDraftRef.current = next
        interimRef.current = ''
        setDraft(next)
      },
      onEnd: () => setListening(false),
      onError: (message) => {
        setListening(false)
        flash(`Mic: ${message}`)
      },
    })

    if (!rec) {
      flash('Voice not supported in this browser')
      return
    }

    recognizerRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      flash('Could not start microphone')
      setListening(false)
    }
  }

  function downloadBackup() {
    const blob = new Blob(
      [exportJson({ version: 2, thoughts, learned })],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `settle-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importBackup(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          thoughts?: Thought[]
          learned?: LearnedRule[]
        }
        if (!Array.isArray(parsed.thoughts)) throw new Error('bad file')
        setThoughts(parsed.thoughts)
        if (Array.isArray(parsed.learned)) setLearned(parsed.learned)
        flash(`Imported ${parsed.thoughts.length} thoughts`)
      } catch {
        flash('Could not read backup')
      }
    }
    reader.readAsText(file)
  }

  async function copyBrief() {
    const lines = [
      'Settle — next 3',
      ...nextThree.map(
        (t, i) => `${i + 1}. ${t.nextAction || t.title}${t.person ? ` (${t.person})` : ''}`,
      ),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      flash('Brief copied')
    } catch {
      flash('Could not copy')
    }
  }

  const rowProps = {
    onUpdate: updateThought,
    onRemove: removeThought,
    onSnooze: snooze,
  }

  return (
    <div className="app">
      PLACEHOLDER_TRUNCATED_FOR_SIZE
    </div>
  )
}
