import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoffeeDetail } from '@/lib/actions/coffee'
import { listShotsForCoffee, listCoffeeDialIns } from '@/lib/actions/shots'
import { RateReviewForm } from '@/components/coffee/RateReviewForm'
import { DialInCard } from '@/components/shots/DialInCard'
import { Chip } from '@/components/ui/Chip'

export default async function CoffeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coffee = await getCoffeeDetail(id)
  if (!coffee) notFound()

  const [shots, dialIns] = await Promise.all([
    listShotsForCoffee(id),
    listCoffeeDialIns(id),
  ])

  return (
    <main className="max-w-lg mx-auto p-4">
      <p className="text-sm text-text-muted">{coffee.roasterName}</p>
      <h1 className="text-2xl font-display font-semibold">{coffee.name}</h1>

      <dl className="mt-3 text-sm grid grid-cols-2 gap-1">
        {coffee.originCountry && (
          <>
            <dt className="text-text-muted">Origin</dt>
            <dd>
              {[coffee.originCountry, coffee.originRegion]
                .filter(Boolean)
                .join(', ')}
            </dd>
          </>
        )}
        {coffee.variety && (
          <>
            <dt className="text-text-muted">Variety</dt>
            <dd>{coffee.variety}</dd>
          </>
        )}
        {coffee.process && (
          <>
            <dt className="text-text-muted">Process</dt>
            <dd>{coffee.processDetail ?? coffee.process}</dd>
          </>
        )}
      </dl>

      {coffee.tastingNotes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {coffee.tastingNotes.map((note) => (
            <Chip key={note}>{note}</Chip>
          ))}
        </div>
      )}

      <RateReviewForm
        coffeeId={coffee.id}
        initialRating={coffee.rating}
        initialReview={coffee.review}
      />

      <section className="mt-6 border-t border-surface-raised pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-muted">Dial-in</h2>
          <Link
            href={`/coffee/${coffee.id}/log`}
            className="rounded bg-accent px-3 py-1 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            Log shot
          </Link>
        </div>

        {dialIns.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {dialIns.map((d, i) => (
              <div key={i}>
                <p className="text-xs text-text-muted mb-1">
                  {d.grinderNickname} · {d.machineNickname}
                </p>
                <DialInCard state={d.state} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-text-muted mb-2">Shot history</h2>
        {shots.length === 0 ? (
          <p className="text-sm text-text-muted">No shots logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shots.map((s) => (
              <li key={s.id} className="rounded border border-surface-raised bg-surface p-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{s.grindSetting}</span>
                  <span className="text-text-muted">
                    {s.doseGrams}g → {s.yieldGrams}g · {s.timeSeconds}s
                  </span>
                </div>
                <div className="text-xs text-text-muted">
                  {s.grinderNickname} · {s.machineNickname}
                  {s.outcomeTags.length > 0 && ` · ${s.outcomeTags.join(', ')}`}
                </div>
                {s.note && <p className="text-xs mt-1">{s.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
