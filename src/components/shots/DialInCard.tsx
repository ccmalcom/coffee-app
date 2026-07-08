import type { DialInState } from '@/lib/grind/suggestion'

export function DialInCard({ state }: { state: DialInState }) {
  if (state.kind === 'new_bag') {
    const b = state.baseline
    if (b.status === 'insufficient_history') {
      return (
        <div className="border rounded p-3 text-sm text-gray-500">
          New coffee on this grinder — log shots to build a suggestion (or reach{' '}
          {b.shotsNeeded} total on this grinder + machine for a rough starting point).
        </div>
      )
    }
    return (
      <div className="border rounded p-3 text-sm bg-amber-50">
        <p className="font-medium">Rough starting point: {b.display}</p>
        <p className="text-gray-500">
          Estimated from your balanced/excellent shots on this grinder + machine
          (any coffee). Not yet calibrated to this coffee.
        </p>
      </div>
    )
  }

  const s = state.suggestion
  if (s.status === 'need_more_shots') {
    return (
      <div className="border rounded p-3 text-sm text-gray-500">
        Log {s.shotsNeeded - s.shotsLogged} more shot
        {s.shotsNeeded - s.shotsLogged === 1 ? '' : 's'} on this combo to unlock a
        suggestion ({s.shotsLogged}/{s.shotsNeeded}).
      </div>
    )
  }
  if (s.status === 'need_positive_reference') {
    return (
      <div className="border rounded p-3 text-sm text-gray-500">
        Log a shot you rate balanced or excellent to activate suggestions.
      </div>
    )
  }
  if (s.status === 'need_variation') {
    return (
      <div className="border rounded p-3 text-sm text-gray-500">
        Try a shot at a different setting to unlock suggestions.
      </div>
    )
  }

  return (
    <div className="border rounded p-3 text-sm bg-green-50">
      <p className="font-medium">
        Suggested grind: {s.display} → ~{Math.round(s.targetTime)}s
      </p>
      <ul className="mt-2 text-gray-600">
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
