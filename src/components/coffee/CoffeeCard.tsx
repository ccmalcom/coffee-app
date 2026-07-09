import Link from 'next/link'
import { RatingStars } from './RatingStars'
import type { LibraryEntryWithCoffee } from '@/lib/actions/coffee'

export function CoffeeCard({ entry }: { entry: LibraryEntryWithCoffee }) {
  return (
    <Link
      href={`/coffee/${entry.coffeeId}`}
      className="block rounded border border-surface-raised bg-surface p-3 hover:bg-surface-raised"
    >
      <p className="text-sm text-text-muted">{entry.roasterName}</p>
      <p className="font-medium">{entry.coffeeName}</p>
      <RatingStars value={entry.rating} readOnly />
    </Link>
  )
}
