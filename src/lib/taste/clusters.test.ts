import { describe, it, expect } from 'vitest'
import { clusterForPhrase, UNCATEGORIZED } from './clusters'
import {
  MIN_RATED_COFFEES_FOR_PROFILE,
  POSITIVE_RATING_THRESHOLD,
  PROFILE_VERSION,
} from './constants'

describe('constants', () => {
  it('holds the locked values', () => {
    expect(MIN_RATED_COFFEES_FOR_PROFILE).toBe(5)
    expect(POSITIVE_RATING_THRESHOLD).toBe(4)
    expect(PROFILE_VERSION).toBe(1)
  })
})

describe('clusterForPhrase', () => {
  it('maps an exact vocabulary phrase to its cluster', () => {
    expect(clusterForPhrase('watermelon bubble gum')).toBe('fruit_candied')
    expect(clusterForPhrase('jasmine')).toBe('floral')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(clusterForPhrase('  Watermelon Bubble Gum ')).toBe('fruit_candied')
  })

  it('fuzzy-matches a close near-miss to the right cluster', () => {
    expect(clusterForPhrase('blueberries')).toBe('fruit_fresh')
  })

  it('returns uncategorized for an unknown phrase or empty string', () => {
    expect(clusterForPhrase('motor oil')).toBe(UNCATEGORIZED)
    expect(clusterForPhrase('')).toBe(UNCATEGORIZED)
  })
})
