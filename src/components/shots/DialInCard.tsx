import type { DialInState } from '@/lib/grind/suggestion'

export function DialInCard({ state }: { state: DialInState }) {
  if (state.kind === 'new_bag') {
    const b = state.baseline
    if (b.status === 'insufficient_history') {
      return (
        <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
          New coffee on this grinder — log shots to build a suggestion (or reach{' '}
          {b.shotsNeeded} total on this grinder + machine for a rough starting point).
        </div>
      )
    }
    return (
      <div className="rounded border-l-4 border-accent bg-surface-raised p-3 text-sm">
        <p className="font-medium">Rough starting point: {b.display}</p>
        <p className="text-text-muted">
          Estimated from your balanced/excellent shots on this grinder + machine
          (any coffee). Not yet calibrated to this coffee.
        </p>
      </div>
    )
  }

  const s = state.suggestion
  if (s.status === 'need_more_shots') {
    return (
      <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
        Log {s.shotsNeeded - s.shotsLogged} more shot
        {s.shotsNeeded - s.shotsLogged === 1 ? '' : 's'} on this combo to unlock a
        suggestion ({s.shotsLogged}/{s.shotsNeeded}).
      </div>
    )
  }
  if (s.status === 'need_positive_reference') {
    return (
      <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
        Log a shot you rate balanced or excellent to activate suggestions.
      </div>
    )
  }
  if (s.status === 'need_variation') {
    return (
      <div className="rounded border border-surface-raised p-3 text-sm text-text-muted">
        Try a shot at a different setting to unlock suggestions.
      </div>
    )
  }

  return (
    <div className="rounded border-l-4 border-success bg-surface-raised p-3 text-sm">
      <p className="font-medium">
        Suggested grind: {s.display} → ~{Math.round(s.targetTime)}s
      </p>
      <ul className="mt-2 text-text-muted">
        {s.evidence.map((e, i) => (
          <li key={i}>
            setting {e.grindPosition} → {e.timeSeconds}s
            {e.outcomeTags.length > 0 && ` (${e.outcomeTags.join(', ')})`}
          </li>
        ))}
      </ul>
    </div>
  )
}
