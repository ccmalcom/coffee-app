'use client'

import { useState, useTransition } from 'react'
import { rateCoffee } from '@/lib/actions/coffee'
import { RatingStars } from './RatingStars'

export function RateReviewForm({
  coffeeId,
  initialRating,
  initialReview,
}: {
  coffeeId: string
  initialRating: number | null
  initialReview: string | null
}) {
  const [rating, setRating] = useState(initialRating)
  const [review, setReview] = useState(initialReview ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save(nextRating: number) {
    setRating(nextRating)
    setSaved(false)
    startTransition(async () => {
      await rateCoffee({ coffeeId, rating: nextRating, review })
      setSaved(true)
    })
  }

  function saveReview() {
    if (!rating) return
    startTransition(async () => {
      await rateCoffee({ coffeeId, rating, review })
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-2 border-t border-surface-raised pt-3 mt-3">
      <RatingStars value={rating} onChange={save} />
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        onBlur={saveReview}
        placeholder="Notes on this coffee..."
        rows={3}
        className="rounded border border-surface-raised bg-surface p-2 text-sm placeholder:text-text-muted"
      />
      {isPending && <p className="text-xs text-text-muted">Saving…</p>}
      {saved && !isPending && <p className="text-xs text-success">Saved</p>}
    </div>
  )
}
