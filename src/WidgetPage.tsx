import { useMemo } from 'react'
import { dueLabel, isActive } from './lib/assign'
import { nextThree } from './lib/rank'
import { loadState } from './lib/storage'
import './index.css'

export default function WidgetPage() {
  const state = useMemo(() => loadState(), [])
  const items = useMemo(() => nextThree(state.thoughts), [state.thoughts])
  const waiting = useMemo(
    () =>
      state.thoughts.filter(
        (t) => t.status === 'waiting' && isActive(t.snoozeUntil),
      ).length,
    [state.thoughts],
  )

  return (
    <div className="app widget-page">
      <section className="widget-card" aria-label="Next three">
        <p className="kicker">Settle · Today</p>
        <h1>Next 3</h1>
        {items.length === 0 ? (
          <p className="widget-empty">Head is clear. Dump anything in Settle.</p>
        ) : (
          <ol className="widget-list">
            {items.map((t, i) => (
              <li key={t.id}>
                <span className="widget-num">0{i + 1}</span>
                <div>
                  <p>{t.nextAction || t.title}</p>
                  <small>
                    {[t.person, t.dueAt ? dueLabel(t.dueAt) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        )}
        {waiting > 0 && (
          <p className="thought-meta">{waiting} waiting on someone else</p>
        )}
        <a className="btn-primary widget-open" href="/">
          Open Settle
        </a>
      </section>
    </div>
  )
}
