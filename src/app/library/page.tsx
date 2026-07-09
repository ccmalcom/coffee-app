import Link from 'next/link'
import { listLibrary } from '@/lib/actions/coffee'
import { CoffeeCard } from '@/components/coffee/CoffeeCard'

// 'wishlist' and 'finished' are omitted for now: no UI path sets those statuses yet
// (that's Plan 2/3's job), so showing them here would just be permanently-empty dead tabs.
// Re-add them once status-changing UI exists — the tab loop below is already generic over TABS.
const TABS = ['owned'] as const

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = (TABS as readonly string[]).includes(tab ?? '')
    ? (tab as (typeof TABS)[number])
    : 'owned'

  const entries = await listLibrary(activeTab)

  return (
    <main className="max-w-lg mx-auto p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-display font-semibold">Library</h1>
        <Link
          href="/coffee/add"
          className="rounded bg-accent px-3 py-1 text-sm font-medium text-bg hover:bg-accent-hover"
        >
          + Add coffee
        </Link>
      </div>

      <div className="flex gap-4 border-b border-surface-raised">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/library?tab=${t}`}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm capitalize ${
              activeTab === t
                ? 'border-accent text-text'
                : 'border-transparent text-text-muted'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-text-muted text-sm">No coffees here yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <CoffeeCard key={entry.entryId} entry={entry} />
          ))}
        </div>
      )}
    </main>
  )
}
