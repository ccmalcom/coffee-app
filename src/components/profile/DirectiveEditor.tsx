'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDirective, type DirectiveView } from '@/lib/actions/taste'

const GOAL_OPTIONS = [
  { value: 'wild_process', label: 'Discover wild process-driven flavors' },
  { value: 'daily_drinkers', label: 'Find reliable daily drinkers' },
  { value: 'explore_origins', label: 'Explore specific origins' },
] as const

export function DirectiveEditor({ directive }: { directive: DirectiveView }) {
  const router = useRouter()
  const [goals, setGoals] = useState<string[]>(directive.goals)
  const [freeText, setFreeText] = useState(directive.freeText ?? '')
  const [excludeAddedFlavor, setExclude] = useState(directive.excludeAddedFlavor)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggleGoal(value: string) {
    setSaved(false)
    setGoals((prev) => (prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]))
  }

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await saveDirective({ goals, freeText: freeText || null, excludeAddedFlavor })
        setSaved(true)
        router.refresh()
      } catch {
        setError('Could not save your goals right now — try again.')
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h2 className="font-medium">Your goals</h2>

      <fieldset className="flex flex-col gap-2">
        {GOAL_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={goals.includes(o.value)}
              onChange={() => toggleGoal(o.value)}
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Anything else?
        <textarea
          value={freeText}
          onChange={(e) => {
            setSaved(false)
            setFreeText(e.target.value)
          }}
          rows={2}
          className="border rounded p-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={excludeAddedFlavor}
          onChange={(e) => {
            setSaved(false)
            setExclude(e.target.checked)
          }}
        />
        Exclude added-flavor coffees
      </label>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="bg-black text-white rounded p-2 disabled:opacity-50 self-start"
      >
        {isPending ? 'Saving…' : 'Save goals'}
      </button>
      {saved && <p role="status" className="text-sm text-green-700">Saved.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
