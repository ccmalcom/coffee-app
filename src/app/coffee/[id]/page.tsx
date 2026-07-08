import { notFound } from 'next/navigation'
import { getCoffeeDetail } from '@/lib/actions/coffee'
import { RateReviewForm } from '@/components/coffee/RateReviewForm'

export default async function CoffeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coffee = await getCoffeeDetail(id)
  if (!coffee) notFound()

  return (
    <main className="max-w-lg mx-auto p-4">
      <p className="text-sm text-gray-500">{coffee.roasterName}</p>
      <h1 className="text-xl font-semibold">{coffee.name}</h1>

      <dl className="mt-3 text-sm grid grid-cols-2 gap-1">
        {coffee.originCountry && (
          <>
            <dt className="text-gray-500">Origin</dt>
            <dd>{[coffee.originCountry, coffee.originRegion].filter(Boolean).join(', ')}</dd>
          </>
        )}
        {coffee.variety && (
          <>
            <dt className="text-gray-500">Variety</dt>
            <dd>{coffee.variety}</dd>
          </>
        )}
        {coffee.process && (
          <>
            <dt className="text-gray-500">Process</dt>
            <dd>{coffee.processDetail ?? coffee.process}</dd>
          </>
        )}
      </dl>

      {coffee.tastingNotes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {coffee.tastingNotes.map((note) => (
            <span key={note} className="text-xs bg-gray-100 rounded-full px-2 py-1">
              {note}
            </span>
          ))}
        </div>
      )}

      <RateReviewForm coffeeId={coffee.id} initialRating={coffee.rating} initialReview={coffee.review} />
    </main>
  )
}
