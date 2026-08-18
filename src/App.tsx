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
} from './lib/classify'
import { rankOpen } from './lib/rank'
import { downloadIcs } from './lib/calendar'
import {
  enableReminders,
  notifyDueThoughts,
  remindersSupported,
} from './lib/reminders'
import { fileLocally, fileWithEndpoint } from './lib/fileThoughts'
import { learnFromCorrection } from './lib/learn'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import { createRecognizer, speechSupported } from './lib/speech'
import { peopleRadar, staleLabel } from './lib/peopleRadar'
import { personDraft, personMessage } from './lib/personDraft'
import { previewDraft } from './lib/preview'
import { detectProjectHints, type ProjectHint } from './lib/projectHints'
import { gentleInsights } from './lib/insights'
import { looksLikeMindChanged, suggestedCategoryAfterEdit } from './lib/mindChanged'
import { canShare, shareText } from './lib/share'
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
    if (!settings.reminders) return
    void notifyDueThoughts(thoughts)
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void notifyDueThoughts(thoughts)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [thoughts, settings.reminders])

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
  const insights = useMemo(() => gentleInsights(thoughts), [thoughts])
  const sweepCandidates = useMemo(() => brainSweepQueue(thoughts), [thoughts])
  const [canNativeShare] = useState(() => canShare())

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

  async function shareBrief() {
    const lines = nextThree.map(
      (t, i) => `${i + 1}. ${t.nextAction || t.title}${t.person ? ` (${t.person})` : ''}`,
    )
    const text = ['Settle — next 3', ...lines].join('\n')
    const ok = await shareText('Settle — next 3', text)
    flash(ok ? 'Shared next 3' : 'Share not available')
  }

  const rowProps = {
    onUpdate: updateThought,
    onRemove: removeThought,
    onSnooze: snooze,
    onFlash: flash,
    canShare: canNativeShare,
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-row">
          <div className="brand-lockup">
            <PineMark />
            <div>
              <h1 className="brand">
                SETTLE
                <span className="brand-sub">Dump box</span>
              </h1>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
        <p className="tagline">
          Dump anything. Filing, dates, and people get assigned for you.
        </p>
        <p className="session">{session}</p>
      </header>

      <section
        className={`dump-shell${reliefPulse ? ' settled-pulse' : ''}`}
        aria-label="Dump box"
        ref={dumpShellRef}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Brain dump here… separate items with + or new lines. “text Sam tomorrow”, “buy oat milk today”."
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              unload()
            }
          }}
          aria-label="Mental clutter dump"
          disabled={filing}
        />
        {draftPreview.length > 0 && (
          <div className="preview-row" aria-label="Filing preview">
            {draftPreview.map((item, i) => {
              const echo = findEchoes(item.text, thoughts, 1)[0]
              return (
                <span
                  key={`${i}-${item.text.slice(0, 24)}`}
                  className={`preview-chip ${clarifyAnswers[i] ?? item.category}${echo ? ' has-echo' : ''}`}
                  title={item.text}
                >
                  <span className="preview-cat">
                    {labelFor(clarifyAnswers[i] ?? item.category)}
                  </span>
                  <span className="preview-title">{item.title}</span>
                  {item.person && (
                    <span className="preview-meta">{item.person}</span>
                  )}
                  {item.dueLabel && (
                    <span className="preview-meta due">{item.dueLabel}</span>
                  )}
                  {echo && (
                    <span className="preview-meta echo" title={echo.text}>
                      Echo
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        )}
        {clarifyPrompts.map((prompt) => (
          <div key={prompt.chunkIndex} className="clarify-card">
            <p className="clarify-q">{prompt.question}</p>
            <div className="clarify-choices">
              {prompt.choices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  className={`clarify-btn${clarifyAnswers[prompt.chunkIndex] === choice.category ? ' is-active' : ''}`}
                  onClick={() =>
                    setClarifyAnswers((prev) => ({
                      ...prev,
                      [prompt.chunkIndex]: choice.category,
                    }))
                  }
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {draftPreview.some((item) => findEchoes(item.text, thoughts, 1)[0]) && (
          <p className="echo-hint">Echo — you&apos;ve dumped something like this before</p>
        )}
        <div className="dump-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={!draft.trim() || filing || needsClarify}
            onClick={unload}
          >
            {filing ? 'Settling…' : 'Settle'}
          </button>
          {canSpeak && (
            <button
              type="button"
              className="btn-ghost"
              aria-pressed={listening}
              onClick={toggleListen}
              disabled={filing}
            >
              {listening ? 'Stop mic' : 'Speak'}
            </button>
          )}
        </div>
        <p className="hint">⌘/Ctrl + Enter · local · learns when you recategorize</p>
      </section>

      <nav className="nav" aria-label="Views">
        <button
          type="button"
          aria-current={view === 'brief' ? 'page' : undefined}
          onClick={() => setView('brief')}
        >
          Today
        </button>
        <button
          type="button"
          aria-current={view === 'all' ? 'page' : undefined}
          onClick={() => setView('all')}
        >
          All ({activeOpen.length})
        </button>
        <button
          type="button"
          aria-current={view === 'ask' ? 'page' : undefined}
          onClick={() => setView('ask')}
        >
          Ask
        </button>
      </nav>

      {view === 'brief' && (
        <section className="panel" aria-label="Daily brief">
          <div className="brief-card">
            <p className="kicker">Daily brief</p>
            <h2>What now</h2>
            <p>{briefIntro(activeOpen.length)}</p>

            <div ref={projectSectionRef}>
              <ProjectHintsPanel
                hints={projectHints}
                onTag={tagProject}
                prominent
              />
            </div>

            {insights.length > 0 && (
              <ul className="insights-list" aria-label="Gentle insights">
                {insights.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </ul>
            )}

            {nextThree.length > 0 && (
              <div className="next-list" aria-label="Next three">
                {nextThree.map((t, i) => (
                  <div key={t.id} className="next-item">
                    <span className="next-num">0{i + 1}</span>
                    <div>
                      <p>{t.nextAction || t.title}</p>
                      <small>
                        {[
                          labelFor(t.category),
                          t.person,
                          t.dueAt ? dueLabel(t.dueAt) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="done-mini"
                      onClick={() => updateThought(t.id, { status: 'done' })}
                    >
                      Done
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="dump-actions" style={{ marginTop: '0.9rem' }}>
              <button type="button" className="btn-ghost" onClick={copyBrief}>
                Copy next 3
              </button>
              {canNativeShare && nextThree.length > 0 && (
                <button type="button" className="btn-ghost" onClick={shareBrief}>
                  Share next 3
                </button>
              )}
              {sweepCandidates.length > 0 && (
                <button type="button" className="btn-ghost" onClick={startBrainSweep}>
                  Brain sweep{sweepDue() ? '' : ' ✓'}
                </button>
              )}
            </div>

            {waitingItems.length > 0 && (
              <div className="waiting-section" aria-label="Waiting for">
                <div className="radar-head">
                  <h3>Waiting for</h3>
                  <p>Ball&apos;s in their court — not your next action</p>
                </div>
                <div className="stale-list">
                  {waitingItems.slice(0, 5).map((t) => (
                    <div key={t.id} className="waiting-card">
                      <div className="stale-top">
                        {t.person && (
                          <span className="radar-person">{t.person}</span>
                        )}
                        <span className="radar-stale">{waitingLabel(t)}</span>
                      </div>
                      <p className="radar-action">{t.nextAction || t.title}</p>
                      <div className="radar-actions">
                        <button
                          type="button"
                          className="done-mini"
                          onClick={() =>
                            updateThought(t.id, { status: 'open' })
                          }
                        >
                          Got reply
                        </button>
                        <button
                          type="button"
                          className="done-mini"
                          onClick={() => updateThought(t.id, { status: 'done' })}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {staleItems.length > 0 && (
              <div className="stale-section" aria-label="Stale sweep">
                <div className="radar-head">
                  <h3>Stale sweep</h3>
                  <p>Open longer than a week — decide or done</p>
                </div>
                <div className="stale-list">
                  {staleItems.map((t) => (
                    <div key={t.id} className="stale-card">
                      <div className="stale-top">
                        <span className={`cat-pill ${t.category}`}>
                          {labelFor(t.category)}
                        </span>
                        <span className="radar-stale">
                          {staleLabel(staleDays(t.createdAt))}
                        </span>
                      </div>
                      <p className="radar-action">{t.nextAction || t.title}</p>
                      <div className="radar-actions">
                        <button
                          type="button"
                          className="done-mini"
                          onClick={() => updateThought(t.id, { status: 'done' })}
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          className="done-mini"
                          onClick={() => snooze(t.id, 'tonight')}
                        >
                          Tonight
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {radarLoops.length > 0 && (
              <div className="radar-section" aria-label="People radar">
                <div className="radar-head">
                  <h3>People radar</h3>
                  <p>Open loops — stalest first</p>
                </div>
                <div className="radar-list">
                  {radarLoops.slice(0, 6).map((loop) => (
                    <div
                      key={loop.person}
                      className={`radar-card${loop.overdue ? ' is-overdue' : ''}`}
                    >
                      <div className="radar-top">
                        <span className="radar-person">{loop.person}</span>
                        <span className="radar-stale">
                          {staleLabel(loop.staleDays)}
                        </span>
                      </div>
                      <p className="radar-action">
                        {loop.top.nextAction || loop.top.title}
                      </p>
                      <div className="radar-meta">
                        {loop.top.dueAt && (
                          <span
                            className={`chip ${loop.overdue ? 'overdue' : 'due'}`}
                          >
                            {dueLabel(loop.top.dueAt)}
                          </span>
                        )}
                        {loop.thoughts.length > 1 && (
                          <span className="thought-meta">
                            +{loop.thoughts.length - 1} more
                          </span>
                        )}
                      </div>
                      <div className="radar-actions">
                        <button
                          type="button"
                          className="done-mini"
                          onClick={() => draftReachOut(loop.person, loop.top)}
                        >
                          Draft
                        </button>
                        <button
                          type="button"
                          className="done-mini"
                          onClick={() => copyReachOut(loop.person, loop.top)}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="done-mini"
                          onClick={() =>
                            updateThought(loop.top.id, { status: 'done' })
                          }
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="brief-sections">
              <BriefSection title="Do next" items={briefBuckets.do} empty="No errands filed yet." {...rowProps} />
              <BriefSection title="People" items={briefBuckets.people} empty="No people loops." {...rowProps} />
              <BriefSection title="Parked worries" items={briefBuckets.worry} empty="Nothing heavy right now." {...rowProps} />
              <BriefSection title="Worth thinking" items={briefBuckets.think} empty="No open ideas." {...rowProps} />
            </div>
          </div>
        </section>
      )}

      {view === 'all' && (
        <section className="panel" aria-label="All thoughts">
          <ProjectHintsPanel hints={projectHints} onTag={tagProject} prominent />
          <div className="search-row">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your dumps…"
              aria-label="Search thoughts"
            />
            <button
              type="button"
              className="btn-ghost light"
              aria-pressed={hideDone}
              onClick={() => setHideDone((v) => !v)}
            >
              {hideDone ? 'Show done' : 'Hide done'}
            </button>
          </div>
          <div className="filter-row" role="toolbar" aria-label="Filter by type">
            <button
              type="button"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={filter === 'due'}
              onClick={() => setFilter('due')}
            >
              Dated
            </button>
            <button
              type="button"
              aria-pressed={filter === 'waiting'}
              onClick={() => setFilter('waiting')}
            >
              Waiting
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={filter === c.id}
                onClick={() => setFilter(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <strong>Nothing here</strong>
              Dump a messy paragraph above — Settle will sort it.
            </div>
          ) : (
            <div className="thought-list">
              {filtered.map((t, i) => (
                <ThoughtRow
                  key={t.id}
                  thought={t}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  {...rowProps}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {view === 'ask' && (
        <section className="panel" aria-label="Ask your dumps">
          <div className="ask-card">
            <p className="kicker">Ask your dumps</p>
            <h2>What did I capture?</h2>
            <p>Search people, errands, worries — no folders required.</p>
            <input
              type="search"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Sam, passport, groceries…"
              aria-label="Ask your dumps"
              autoFocus
            />
            {askLoading && <p className="thought-meta">Searching deeper…</p>}
            {askSource === 'openai' && ask.trim() && !askLoading && (
              <p className="thought-meta">Smart match</p>
            )}
            <div className="thought-list" style={{ marginTop: '0.9rem' }}>
              {!ask.trim() ? (
                <p className="thought-meta">Type a name or a scrap of a thought.</p>
              ) : askHits.length === 0 && !askLoading ? (
                <p className="thought-meta">Nothing matched.</p>
              ) : (
                askHits.map((t) => (
                  <ThoughtRow key={t.id} thought={t} {...rowProps} />
                ))
              )}
            </div>
            {!settings.useAi && ask.trim() && askHitsLocal.length > askHits.length && (
              <p className="thought-meta">
                Enable smart filing in Settings for semantic Ask via /api/ask
              </p>
            )}
          </div>
        </section>
      )}

      <footer className="footer-bar">
        <span>On-device · Add to Home Screen</span>
        <div className="footer-actions">
          <a className="btn-ghost" href="/shortcuts">
            Shortcuts
          </a>
          <a className="btn-ghost" href="/widget">
            Widget
          </a>
          <button type="button" className="btn-ghost" onClick={downloadBackup}>
            Export
          </button>
          <label className="btn-ghost file-btn">
            Import
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </footer>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.replace(' · Undo', '')}</span>
          {undoIds && toast.includes('Undo') && (
            <button type="button" className="toast-undo" onClick={undoLast}>
              Undo
            </button>
          )}
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          thoughts={thoughts}
          learned={learned}
          onImport={(next) => {
            setThoughts(next.thoughts)
            setLearned(next.learned)
          }}
          onClose={() => setSettingsOpen(false)}
          onChange={setSettings}
          onFlash={flash}
          onLearnedChange={setLearned}
          onClearAll={() => {
            setThoughts([])
            setLearned([])
            flash('All local data cleared')
          }}
        />
      )}

      {worryBatch && worryBatch.length > 0 && (
        <WorryFollowUp
          worries={worryBatch}
          onLeave={() => setWorryBatch(null)}
          onPrepStep={(w) => {
            setDraft(`prep for: ${w.text.replace(/^worried?\s+(about\s+)?/i, '').trim()}`)
            setWorryBatch(null)
            dumpShellRef.current?.scrollIntoView({ behavior: 'smooth' })
            flash('Small prep step in dump box')
          }}
          onRevisit={(id) => {
            updateThought(id, { snoozeUntil: revisitFridayIso() })
            flash('Will resurface Friday')
          }}
          onDone={(id) => {
            updateThought(id, { status: 'done' })
            setWorryBatch(null)
            flash('Worry cleared')
          }}
          onClose={() => setWorryBatch(null)}
        />
      )}

      {sweepOpen && sweepQueue.length > 0 && (
        <BrainSweep
          queue={sweepQueue}
          onDone={(id) => {
            updateThought(id, { status: 'done' })
            setSweepQueue((q) => q.filter((t) => t.id !== id))
          }}
          onTonight={(id) => {
            snooze(id, 'tonight')
            setSweepQueue((q) => q.filter((t) => t.id !== id))
          }}
          onLater={(id) => {
            updateThought(id, { status: 'parked', category: 'later' })
            setSweepQueue((q) => q.filter((t) => t.id !== id))
          }}
          onSkip={finishBrainSweep}
          onFinish={finishBrainSweep}
        />
      )}
    </div>
  )
}

function SettingsModal({
  settings,
  thoughts,
  learned,
  onChange,
  onImport,
  onLearnedChange,
  onClearAll,
  onClose,
  onFlash,
}: {
  settings: Settings
  thoughts: Thought[]
  learned: LearnedRule[]
  onChange: (s: Settings) => void
  onImport: (state: { thoughts: Thought[]; learned: LearnedRule[] }) => void
  onLearnedChange: (rules: LearnedRule[]) => void
  onClearAll: () => void
  onClose: () => void
  onFlash: (message: string) => void
}) {
  const [syncPaste, setSyncPaste] = useState('')
  const [syncReplace, setSyncReplace] = useState(false)

  async function copySyncCode() {
    const code = toSyncCode({ version: 2, thoughts, learned })
    try {
      await navigator.clipboard.writeText(code)
      onFlash('Sync code copied — paste on your other device')
    } catch {
      onFlash('Could not copy sync code')
    }
  }

  function applySyncCode() {
    const parsed = fromSyncCode(syncPaste)
    if (!parsed) {
      onFlash('Invalid sync code')
      return
    }
    const local = { version: 2 as const, thoughts, learned }
    const next = syncReplace ? parsed : mergeSyncState(local, parsed)
    onImport(next)
    setSyncPaste('')
    onFlash(
      syncReplace
        ? `Replaced with ${parsed.thoughts.length} thoughts`
        : `Merged — ${next.thoughts.length} thoughts total`,
    )
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Settings</h2>
        <p className="modal-lead">
          Everything stays on-device. Recategorizing a dump teaches Settle your
          language. On Vercel, built-in filing uses <code>/api/file</code> — add
          an OpenAI key there for smarter sorting.
        </p>

        <label className="toggle-row">
          <span>Use smart filing endpoint</span>
          <input
            type="checkbox"
            checked={settings.useAi}
            onChange={(e) => onChange({ ...settings, useAi: e.target.checked })}
          />
        </label>

        <label className="toggle-row">
          <span>Remind me when something is due</span>
          <input
            type="checkbox"
            checked={settings.reminders}
            onChange={(e) => {
              const on = e.target.checked
              if (!on) {
                onChange({ ...settings, reminders: false })
                return
              }
              void enableReminders().then((ok) => {
                onChange({ ...settings, reminders: ok })
                onFlash(
                  ok
                    ? 'Due reminders on — works best from the Home Screen app'
                    : remindersSupported()
                      ? 'Notifications blocked'
                      : 'Reminders not supported here',
                )
              })
            }}
          />
        </label>

        <div className="sync-actions">
          <button
            type="button"
            className="btn-ghost light"
            onClick={() =>
              onChange({
                ...settings,
                useAi: true,
                filingEndpoint:
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/api/file`
                    : '/api/file',
              })
            }
          >
            Use built-in /api/file
          </button>
        </div>

        <label className="field">
          <span>Filing endpoint URL</span>
          <input
            type="url"
            autoComplete="off"
            placeholder="/api/file or https://your-worker.example/file"
            value={settings.filingEndpoint}
            onChange={(e) =>
              onChange({ ...settings, filingEndpoint: e.target.value })
            }
          />
        </label>

        <label className="field">
          <span>Bearer token (optional)</span>
          <input
            type="password"
            autoComplete="off"
            placeholder="FILING_SECRET if set on Vercel"
            value={settings.filingToken}
            onChange={(e) =>
              onChange({ ...settings, filingToken: e.target.value })
            }
          />
        </label>

        <div className="shortcuts-help">
          <h3>iOS Shortcuts</h3>
          <p>
            Full setup with QR code:{' '}
            <a href="/shortcuts">/shortcuts</a>
          </p>
          <code>
            {typeof window !== 'undefined'
              ? `${window.location.origin}/?dump=[text]&unload=1`
              : '/?dump=[text]&unload=1'}
          </code>
        </div>

        <div className="sync-section">
          <h3>Sync phone ↔ PC</h3>
          <p>
            Copy a code on one device, paste on the other. Default merges both
            sides — newer edits win on conflicts.
          </p>
          <label className="toggle-row sync-replace">
            <span>Replace all data (don&apos;t merge)</span>
            <input
              type="checkbox"
              checked={syncReplace}
              onChange={(e) => setSyncReplace(e.target.checked)}
            />
          </label>
          <div className="sync-actions">
            <button type="button" className="btn-ghost light" onClick={copySyncCode}>
              Copy sync code
            </button>
          </div>
          <label className="field">
            <span>Paste sync code from another device</span>
            <textarea
              className="sync-textarea"
              rows={3}
              value={syncPaste}
              onChange={(e) => setSyncPaste(e.target.value)}
              placeholder="Paste the long code here…"
            />
          </label>
          <button
            type="button"
            className="btn-ghost light"
            disabled={!syncPaste.trim()}
            onClick={applySyncCode}
          >
            Apply sync code
          </button>
        </div>

        {learned.length > 0 && (
          <div className="learned-section">
            <h3>What Settle learned</h3>
            <p>From when you recategorize — tap to remove.</p>
            <ul className="learned-list">
              {learned.map((rule) => (
                <li key={rule.phrase}>
                  <span className="learned-phrase">{rule.phrase}</span>
                  <span className={`cat-pill ${rule.category}`}>
                    {CATEGORIES.find((c) => c.id === rule.category)?.label}
                  </span>
                  <button
                    type="button"
                    className="learned-remove"
                    aria-label={`Forget ${rule.phrase}`}
                    onClick={() =>
                      onLearnedChange(learned.filter((r) => r.phrase !== rule.phrase))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="privacy-section">
          <h3>Privacy</h3>
          <p>
            {thoughts.length} thoughts · {learned.length} learned phrases · all on this
            device
          </p>
          <button
            type="button"
            className="btn-ghost light danger"
            onClick={() => {
              if (window.confirm('Delete all thoughts and learned rules on this device?')) {
                onClearAll()
              }
            }}
          >
            Clear all local data
          </button>
        </div>

        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

function ProjectHintsPanel({
  hints,
  onTag,
  prominent,
}: {
  hints: ProjectHint[]
  onTag: (name: string, ids: string[]) => void
  prominent?: boolean
}) {
  if (!hints.length) return null

  return (
    <section
      className={`project-section${prominent ? ' is-prominent' : ''}`}
      aria-label="Project hints"
    >
      <div className="radar-head">
        <h3>Same project?</h3>
        <p>These open loops share keywords — group if you want.</p>
      </div>
      <div className="project-list">
        {hints.map((hint) => (
          <div key={hint.name} className="project-card">
            <p className="radar-action">{hint.name}</p>
            <p className="thought-meta">
              {hint.thoughts.length} thoughts · {hint.keywords.join(', ')}
            </p>
            <button
              type="button"
              className="done-mini"
              onClick={() => onTag(hint.name, hint.thoughts.map((t) => t.id))}
            >
              Tag project
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function BriefSection({
  title,
  items,
  empty,
  onUpdate,
  onRemove,
  onSnooze,
  onFlash,
  canShare: canShareProp,
}: {
  title: string
  items: Thought[]
  empty: string
  onUpdate: (id: string, patch: Partial<Thought>) => void
  onRemove: (id: string) => void
  onSnooze: (id: string, kind: 'tonight' | 'tomorrow' | 'weekend') => void
  onFlash: (message: string) => void
  canShare: boolean
}) {
  return (
    <div className="brief-section">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="thought-meta" style={{ margin: 0 }}>
          {empty}
        </p>
      ) : (
        <div className="thought-list">
          {items.map((t) => (
            <ThoughtRow
              key={t.id}
              thought={t}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onSnooze={onSnooze}
              onFlash={onFlash}
              canShare={canShareProp}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ThoughtRow({
  thought,
  onUpdate,
  onRemove,
  onSnooze,
  onFlash,
  canShare: canShareProp,
  compact,
  style,
}: {
  thought: Thought
  onUpdate: (id: string, patch: Partial<Thought>) => void
  onRemove: (id: string) => void
  onSnooze: (id: string, kind: 'tonight' | 'tomorrow' | 'weekend') => void
  onFlash: (message: string) => void
  canShare: boolean
  compact?: boolean
  style?: CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(thought.text)
  const [refileCategory, setRefileCategory] = useState<Category | null>(null)
  const due = dueLabel(thought.dueAt)
  const overdue = due === 'Overdue' || due === 'Due now'

  useEffect(() => {
    setText(thought.text)
    setRefileCategory(null)
  }, [thought.text])

  function saveEdit() {
    const next = text.trim()
    if (!next) return
    const a = assign(next)
    const waiting = isWaiting(next)
    const mindChanged = looksLikeMindChanged(thought.text, next)
    const suggested = suggestedCategoryAfterEdit(next, thought.category)
    onUpdate(thought.id, {
      text: next,
      title: a.nextAction || titleFromText(next),
      dueAt: a.dueAt,
      person: a.person,
      nextAction: a.nextAction,
      status: waiting ? 'waiting' : thought.status === 'waiting' ? 'open' : thought.status,
      category: waiting ? 'people' : thought.category,
    })
    setEditing(false)
    if (mindChanged && suggested) {
      setRefileCategory(suggested)
      onFlash(`Sounds more like ${labelFor(suggested)} now`)
    }
  }

  async function shareThought() {
    const ok = await shareText(
      thought.nextAction || thought.title,
      thought.text,
    )
    onFlash(ok ? 'Shared' : 'Share not available')
  }

  return (
    <article
      className={`thought${thought.status === 'done' ? ' is-done' : ''}${thought.status === 'waiting' ? ' is-waiting' : ''}${overdue ? ' is-overdue' : ''}`}
      style={style}
    >
      <div className="thought-top">
        <div className="thought-body">
          {editing ? (
            <textarea
              className="edit-area"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
            />
          ) : (
            <>
              <p className="thought-title">{thought.nextAction || thought.title}</p>
              {!compact && thought.title !== thought.text && (
                <p className="thought-meta">{thought.text}</p>
              )}
              <div className="meta-row">
                {thought.person && (
                  <span className="chip person">{thought.person}</span>
                )}
                {thought.project && (
                  <span className="chip project">{thought.project}</span>
                )}
                {due && (
                  <span className={`chip ${overdue ? 'overdue' : 'due'}`}>
                    {due}
                  </span>
                )}
                {thought.snoozeUntil && !isActive(thought.snoozeUntil) && (
                  <span className="chip">Snoozed</span>
                )}
                {thought.status === 'waiting' && (
                  <span className="chip waiting">Waiting</span>
                )}
                <span className="thought-meta" style={{ margin: 0 }}>
                  {formatWhen(thought.createdAt)}
                </span>
              </div>
            </>
          )}
        </div>
        <span className={`cat-pill ${thought.category}`}>
          {labelFor(thought.category)}
        </span>
      </div>
      {refileCategory && (
        <div className="refile-card">
          <p>Re-file as {labelFor(refileCategory)}?</p>
          <div className="refile-actions">
            <button
              type="button"
              className="done-mini"
              onClick={() => {
                onUpdate(thought.id, { category: refileCategory })
                setRefileCategory(null)
                onFlash(`Re-filed as ${labelFor(refileCategory)}`)
              }}
            >
              Yes
            </button>
            <button
              type="button"
              className="done-mini"
              onClick={() => setRefileCategory(null)}
            >
              Keep {labelFor(thought.category)}
            </button>
          </div>
        </div>
      )}
      <div className="thought-actions">
        {editing ? (
          <>
            <button type="button" onClick={saveEdit}>
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setText(thought.text)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                onUpdate(thought.id, {
                  status: thought.status === 'done' ? 'open' : 'done',
                })
              }
            >
              {thought.status === 'done' ? 'Reopen' : 'Done'}
            </button>
            {thought.status === 'open' && (
              <>
                <button type="button" onClick={() => onSnooze(thought.id, 'tonight')}>
                  Tonight
                </button>
                <button type="button" onClick={() => onSnooze(thought.id, 'tomorrow')}>
                  Tomorrow
                </button>
                <button type="button" onClick={() => onSnooze(thought.id, 'weekend')}>
                  Weekend
                </button>
                {(thought.category === 'people' || thought.person) && (
                  <button
                    type="button"
                    onClick={() => onUpdate(thought.id, { status: 'waiting' })}
                  >
                    Waiting
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onUpdate(thought.id, { status: 'parked', category: 'later' })
                  }
                >
                  Later
                </button>
              </>
            )}
            {thought.status === 'waiting' && (
              <button
                type="button"
                onClick={() => onUpdate(thought.id, { status: 'open' })}
              >
                Got reply
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            {thought.dueAt && (
              <button
                type="button"
                onClick={() => {
                  const ok = downloadIcs(thought)
                  onFlash(ok ? 'Calendar file saved' : 'Could not export')
                }}
              >
                Calendar
              </button>
            )}
            {canShareProp && (
              <button type="button" onClick={shareThought}>
                Share
              </button>
            )}
            <select
              aria-label="Change category"
              value={thought.category}
              onChange={(e) =>
                onUpdate(thought.id, { category: e.target.value as Category })
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => onRemove(thought.id)}>
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  )
}
