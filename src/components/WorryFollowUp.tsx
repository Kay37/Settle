import type { Thought } from '../types'
import { snoozeTarget } from '../lib/assign'

type Props = {
  worries: Thought[]
  onLeave: (id: string) => void
  onPrepStep: (worry: Thought) => void
  onRevisit: (id: string) => void
  onDone: (id: string) => void
  onClose: () => void
}

export default function WorryFollowUp({
  worries,
  onLeave,
  onPrepStep,
  onRevisit,
  onDone,
  onClose,
}: Props) {
  const top = worries[0]
  if (!top) return null

  return (
    <div className="modal-backdrop worry-backdrop" role="presentation">
      <div className="modal worry-modal" role="dialog" aria-label="Worry follow-up">
        <p className="kicker">Not a task</p>
        <h2>Worry parked</h2>
        <p className="modal-lead">
          Just a loop to revisit — not everything needs a todo.
        </p>
        <blockquote className="worry-quote">{top.text}</blockquote>
        {worries.length > 1 && (
          <p className="thought-meta">+{worries.length - 1} more worry this settle</p>
        )}
        <div className="worry-actions">
          <button type="button" className="btn-ghost light" onClick={() => onLeave(top.id)}>
            Leave it here
          </button>
          <button type="button" className="btn-ghost light" onClick={() => onPrepStep(top)}>
            One small prep step
          </button>
          <button
            type="button"
            className="btn-ghost light"
            onClick={() => {
              onRevisit(top.id)
              onClose()
            }}
          >
            Revisit Friday
          </button>
          <button type="button" className="btn-primary" onClick={() => onDone(top.id)}>
            Done worrying
          </button>
        </div>
        <button type="button" className="btn-ghost light worry-skip" onClick={onClose}>
          Skip for now
        </button>
      </div>
    </div>
  )
}

export function revisitFridayIso(): string {
  const d = snoozeTarget('weekend')
  return d.toISOString()
}
