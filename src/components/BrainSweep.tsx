import type { Thought } from '../types'

type Props = {
  queue: Thought[]
  onDone: (id: string) => void
  onTonight: (id: string) => void
  onLater: (id: string) => void
  onSkip: () => void
  onFinish: () => void
}

function label(category: string): string {
  const map: Record<string, string> = {
    do: 'Do',
    people: 'People',
    think: 'Think',
    worry: 'Worry',
    later: 'Later',
    note: 'Note',
  }
  return map[category] ?? category
}

export default function BrainSweep({
  queue,
  onDone,
  onTonight,
  onLater,
  onSkip,
  onFinish,
}: Props) {
  const current = queue[0]
  const remaining = queue.length

  if (!current) return null

  function next(action: () => void) {
    action()
    if (remaining <= 1) onFinish()
  }

  return (
    <div className="modal-backdrop sweep-backdrop" role="presentation">
      <div className="modal sweep-modal" role="dialog" aria-label="Brain sweep">
        <p className="kicker">Brain sweep</p>
        <h2>Clear one loop</h2>
        <p className="modal-lead">
          {remaining} left — done, snooze, or park. No inbox grooming.
        </p>
        <div className="sweep-card">
          <span className={`cat-pill ${current.category}`}>{label(current.category)}</span>
          <p className="sweep-text">{current.nextAction || current.title}</p>
          {current.text !== current.title && (
            <p className="thought-meta">{current.text}</p>
          )}
        </div>
        <div className="sweep-actions">
          <button type="button" className="btn-primary" onClick={() => next(() => onDone(current.id))}>
            Done
          </button>
          <button type="button" className="btn-ghost light" onClick={() => next(() => onTonight(current.id))}>
            Tonight
          </button>
          <button type="button" className="btn-ghost light" onClick={() => next(() => onLater(current.id))}>
            Later
          </button>
          <button type="button" className="btn-ghost light" onClick={onSkip}>
            Skip rest
          </button>
        </div>
      </div>
    </div>
  )
}
