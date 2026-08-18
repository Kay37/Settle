import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { Category, LearnedRule, Thought } from './types'
import { CATEGORIES } from './types'
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
import { previewDraft } from './lib/preview'
import { exportJson, loadState, saveState, uid } from './lib/storage'
import { fromSyncCode, toSyncCode } from './lib/syncCode'
import './index.css'

type View = 'brief' | 'all' | 'ask'

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
  const [filter, setFilter] = useState<Category | 'all' | 'due'>('all')
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
  const autoUnloadedRef = useRef(false)
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null)
  const interimRef = useRef('')
  const baseDraftRef = useRef('')

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
    const t = window.setTimeout(() => setToast(null), undoIds ? 5000 : 2400)
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

  const activeOpen = useMemo(
    () =>
      thoughts.filter(
        (t) => t.status === 'open' && isActive(t.snoozeUntil),
      ),
    [thoughts],
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
    if (filter === 'due') list = list.filter((t) => Boolean(t.dueAt) && t.status === 'open')
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

  const askHits = useMemo(
    () => searchThoughts(thoughts, ask),
    [thoughts, ask],
  )

  const draftPreview = useMemo(
    () => (draft.trim() ? previewDraft(draft, learned) : []),
    [draft, learned],
  )

  const radarLoops = useMemo(() => peopleRadar(thoughts), [thoughts])

  function flash(message: string) {
    setToast(message)
  }

  async function unloadText(raw: string) {
    const chunks = splitDump(raw)
    if (!chunks.length) return

    setFiling(true)
    try {
      const filed =
        settings.useAi && settings.filingEndpoint.trim()
          ? await fileWithEndpoint(
              chunks,
              settings.filingEndpoint,
              settings.filingToken,
              learned,
            )
          : fileLocally(chunks, learned)

      const now = new Date().toISOString()
      const created: Thought[] = filed.map((item) => ({
        id: uid(),
        text: item.text,
        title: item.title,
        category: item.category,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        dueAt: item.dueAt,
        person: item.person,
        nextAction: item.nextAction,
        snoozeUntil: null,
      }))

      setThoughts((prev) => [...created, ...prev])
      setUndoIds(created.map((t) => t.id))
      setDraft('')
      interimRef.current = ''
      baseDraftRef.current = ''

      const first = created[0]
      const extra = [
        first ? labelFor(first.category) : null,
        first?.person,
        first?.dueAt ? dueLabel(first.dueAt) : null,
      ]
        .filter(Boolean)
        .join(' · ')

      flash(
        created.length === 1
          ? `Filed ${extra} · Undo`
          : `Filed ${created.length} · assigned · Undo`,
      )
      setView('brief')
    } finally {
      setFiling(false)
    }
  }

  function unload() {
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

  async function copyShortcutsUrl() {
    const base = window.location.origin + window.location.pathname
    const sample = `${base}?dump=buy%20milk%0Atext%20Sam&unload=1`
    try {
      await navigator.clipboard.writeText(sample)
      flash('Shortcuts sample URL copied')
    } catch {
      flash(sample)
    }
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

      <section className="dump-shell" aria-label="Dump box">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Brain dump here… “text Sam tomorrow”, “buy oat milk today”, ideas, worries."
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
            {draftPreview.map((item, i) => (
              <span
                key={`${i}-${item.text.slice(0, 24)}`}
                className={`preview-chip ${item.category}`}
                title={item.text}
              >
                <span className="preview-cat">{labelFor(item.category)}</span>
                <span className="preview-title">{item.title}</span>
                {item.person && (
                  <span className="preview-meta">{item.person}</span>
                )}
                {item.dueLabel && (
                  <span className="preview-meta due">{item.dueLabel}</span>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="dump-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={!draft.trim() || filing}
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
            </div>

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
            <div className="thought-list" style={{ marginTop: '0.9rem' }}>
              {!ask.trim() ? (
                <p className="thought-meta">Type a name or a scrap of a thought.</p>
              ) : askHits.length === 0 ? (
                <p className="thought-meta">Nothing matched.</p>
              ) : (
                askHits.map((t) => (
                  <ThoughtRow key={t.id} thought={t} {...rowProps} />
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="footer-bar">
        <span>On-device · Add to Home Screen</span>
        <div className="footer-actions">
          <button type="button" className="btn-ghost" onClick={copyShortcutsUrl}>
            Shortcuts
          </button>
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
  onClose,
  onFlash,
}: {
  settings: Settings
  thoughts: Thought[]
  learned: LearnedRule[]
  onChange: (s: Settings) => void
  onImport: (state: { thoughts: Thought[]; learned: LearnedRule[] }) => void
  onClose: () => void
  onFlash: (message: string) => void
}) {
  const [syncPaste, setSyncPaste] = useState('')

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
    onImport(parsed)
    setSyncPaste('')
    onFlash(`Synced ${parsed.thoughts.length} thoughts`)
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
          language. Optional remote filing needs your own endpoint.
        </p>

        <label className="toggle-row">
          <span>Use smart filing endpoint</span>
          <input
            type="checkbox"
            checked={settings.useAi}
            onChange={(e) => onChange({ ...settings, useAi: e.target.checked })}
          />
        </label>

        <label className="field">
          <span>Filing endpoint URL</span>
          <input
            type="url"
            autoComplete="off"
            placeholder="https://your-worker.example/file"
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
            placeholder="optional"
            value={settings.filingToken}
            onChange={(e) =>
              onChange({ ...settings, filingToken: e.target.value })
            }
          />
        </label>

        <div className="shortcuts-help">
          <h3>iOS Shortcuts</h3>
          <p>Ask for Text / Dictate → Open URLs:</p>
          <code>
            {typeof window !== 'undefined'
              ? `${window.location.origin}/?dump=[text]&unload=1`
              : '/?dump=[text]&unload=1'}
          </code>
        </div>

        <div className="sync-section">
          <h3>Sync phone ↔ PC</h3>
          <p>
            Copy a one-time code here, paste it on your other device. Replaces
            that device&apos;s data.
          </p>
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

        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

function BriefSection({
  title,
  items,
  empty,
  onUpdate,
  onRemove,
  onSnooze,
}: {
  title: string
  items: Thought[]
  empty: string
  onUpdate: (id: string, patch: Partial<Thought>) => void
  onRemove: (id: string) => void
  onSnooze: (id: string, kind: 'tonight' | 'tomorrow' | 'weekend') => void
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
  compact,
  style,
}: {
  thought: Thought
  onUpdate: (id: string, patch: Partial<Thought>) => void
  onRemove: (id: string) => void
  onSnooze: (id: string, kind: 'tonight' | 'tomorrow' | 'weekend') => void
  compact?: boolean
  style?: CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(thought.text)
  const due = dueLabel(thought.dueAt)
  const overdue = due === 'Overdue' || due === 'Due now'

  useEffect(() => {
    setText(thought.text)
  }, [thought.text])

  function saveEdit() {
    const next = text.trim()
    if (!next) return
    const a = assign(next)
    onUpdate(thought.id, {
      text: next,
      title: a.nextAction || titleFromText(next),
      dueAt: a.dueAt,
      person: a.person,
      nextAction: a.nextAction,
    })
    setEditing(false)
  }

  return (
    <article
      className={`thought${thought.status === 'done' ? ' is-done' : ''}${overdue ? ' is-overdue' : ''}`}
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
                {due && (
                  <span className={`chip ${overdue ? 'overdue' : 'due'}`}>
                    {due}
                  </span>
                )}
                {thought.snoozeUntil && !isActive(thought.snoozeUntil) && (
                  <span className="chip">Snoozed</span>
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
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
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
