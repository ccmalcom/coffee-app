import type { ReactNode } from 'react'

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-accent bg-surface-raised px-2 py-0.5 text-xs text-text">
      {children}
    </span>
  )
}
