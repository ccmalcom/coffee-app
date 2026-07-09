'use client'

export function RatingStars({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null
  onChange?: (rating: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={`text-2xl ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
            value && star <= value ? 'text-accent' : 'text-surface-raised'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
