import { describe, it, expect } from 'vitest'
import { diceCoefficient, normalizeForMatch } from './similarity'

describe('normalizeForMatch', () => {
  it('lowercases, trims, and strips punctuation', () => {
    expect(normalizeForMatch('  Julio Madrid, Caturra Nitro!! ')).toBe(
      'julio madrid caturra nitro',
    )
  })
})

describe('diceCoefficient', () => {
  it('returns 1 for identical strings', () => {
    expect(diceCoefficient('caturra nitro', 'caturra nitro')).toBe(1)
  })

  it('returns a high score for near-duplicate names', () => {
    const score = diceCoefficient(
      'julio madrid caturra nitro',
      'julio madrid caturra nitro washed',
    )
    expect(score).toBeGreaterThan(0.85)
  })

  it('returns a low score for unrelated strings', () => {
    const score = diceCoefficient(
      'ethiopia yirgacheffe washed',
      'colombia caturra nitro',
    )
    expect(score).toBeLessThan(0.3)
  })
})
