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
        <h1 className="text-xl font-semibold">Library</h1>
        <Link
          href="/coffee/add"
          className="bg-black text-white rounded px-3 py-1 text-sm"
        >
          + Add coffee
        </Link>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/library?tab=${t}`}
            className={`px-3 py-1 rounded text-sm capitalize ${
              activeTab === t ? 'bg-black text-white' : 'bg-gray-200'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No coffees here yet.</p>
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
