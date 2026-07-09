'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { rebuildProfile, type ProfileView as ProfileViewData } from '@/lib/actions/taste'
import { MIN_RATED_COFFEES_FOR_PROFILE } from '@/lib/taste/constants'
import { Chip } from '@/components/ui/Chip'

export function ProfileView({ view }: { view: ProfileViewData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function rebuild() {
    setError(null)
    startTransition(async () => {
      try {
        await rebuildProfile()
        router.refresh()
      } catch {
        setError('Could not rebuild your profile right now — try again.')
      }
    })
  }

  if (view.state === 'cold_start') {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">
          Not personalized yet — rate a few more coffees ({view.ratedCount} of{' '}
          {MIN_RATED_COFFEES_FOR_PROFILE}). Your stated goals below still guide discovery
          in the meantime.
        </p>
      </section>
    )
  }

  if (view.state === 'never_built') {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-sm">You have enough ratings to build your taste profile.</p>
        <button
          type="button"
          onClick={rebuild}
          disabled={isPending}
          className="rounded bg-accent p-2 font-medium text-bg hover:bg-accent-hover disabled:opacity-50 self-start"
        >
          {isPending ? 'Building…' : 'Build your profile'}
        </button>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </section>
    )
  }

  const profile = view.profile!
  return (
    <section className="flex flex-col gap-4">
      {view.state === 'stale' && (
        <div role="status" className="flex items-center justify-between gap-3 rounded border-l-4 border-accent bg-surface-raised p-2 text-sm">
          <span>
            {view.newRatingsSince} new rating{view.newRatingsSince === 1 ? '' : 's'} since last build.
          </span>
          <button
            type="button"
            onClick={rebuild}
            disabled={isPending}
            className="rounded bg-accent px-3 py-1 font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? 'Rebuilding…' : 'Rebuild profile'}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {profile.summary && <p className="text-sm">{profile.summary}</p>}

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Flavor clusters</h3>
        {profile.clusters.length === 0 ? (
          <p className="text-sm text-text-muted">No strong flavor preferences yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.clusters.map((c) => (
              <li key={c.cluster} className="flex flex-col gap-1">
                <span className="self-start">
                  <Chip>{c.cluster.replace(/_/g, '-')}</Chip>
                </span>
                <div aria-hidden className="h-2 rounded bg-surface-raised">
                  <div className="h-2 rounded bg-accent" style={{ width: `${Math.round(c.affinity * 100)}%` }} />
                </div>
                <small className="text-text-muted">{c.evidence}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Preferred processes</h3>
        {profile.processes.length === 0 ? (
          <p className="text-sm text-text-muted">No strong process preferences yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {profile.processes.map((p) => (
              <li key={p.process} className="text-sm">
                <span>{p.process.replace(/_/g, '-')}</span> <small className="text-text-muted">{p.evidence}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {view.builtAt && (
        <p className="text-xs text-text-muted">Last built {new Date(view.builtAt).toLocaleDateString()}</p>
      )}
    </section>
  )
}
