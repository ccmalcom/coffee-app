import Link from 'next/link'
import { RatingStars } from './RatingStars'
import type { LibraryEntryWithCoffee } from '@/lib/actions/coffee'

export function CoffeeCard({ entry }: { entry: LibraryEntryWithCoffee }) {
  return (
    <Link
      href={`/coffee/${entry.coffeeId}`}
      className="block border rounded p-3 hover:bg-gray-50"
    >
      <p className="text-sm text-gray-500">{entry.roasterName}</p>
      <p className="font-medium">{entry.coffeeName}</p>
      <RatingStars value={entry.rating} readOnly />
    </Link>
  )
}
