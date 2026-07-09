import { describe, it, expect } from 'vitest'
import { computeProfile, type RatedCoffee } from './profile'

const coffees: RatedCoffee[] = [
  { rating: 5, tastingNotes: ['watermelon bubble gum'], process: 'anaerobic', flavorOrigin: 'process' },
  { rating: 4, tastingNotes: ['strawberry yogurt candy'], process: 'natural', flavorOrigin: 'process' },
  { rating: 5, tastingNotes: ['jasmine'], process: 'washed', flavorOrigin: 'process' },
  { rating: 2, tastingNotes: ['dark chocolate'], process: 'washed', flavorOrigin: 'process' },
  { rating: 3, tastingNotes: ['lemon'], process: 'washed', flavorOrigin: 'process' },
]

describe('computeProfile', () => {
  it('ranks liked clusters, normalizes the top to 1, and drops non-positive ones', () => {
    const p = computeProfile(coffees)
    expect(p.version).toBe(1)
    expect(p.ratedCount).toBe(5)
    expect(p.summary).toBe('')

    expect(p.clusters[0]).toEqual({
      cluster: 'fruit_candied',
      affinity: 1,
      evidence: '2 of 2 fruit-candied coffees rated 4★+',
    })
    expect(p.clusters[1]).toMatchObject({ cluster: 'floral', affinity: 0.67 })
    // nutty_cocoa only appears on a 2★ coffee → net negative → omitted.
    expect(p.clusters.find((c) => c.cluster === 'nutty_cocoa')).toBeUndefined()
    // citrus only appears on a 3★ (neutral) coffee → zero affinity → omitted.
    expect(p.clusters.find((c) => c.cluster === 'citrus')).toBeUndefined()
  })

  it('ranks processes with evidence and normalization', () => {
    const p = computeProfile(coffees)
    expect(p.processes.map((x) => x.process)).toEqual(['anaerobic', 'natural', 'washed'])
    expect(p.processes[0]).toMatchObject({ process: 'anaerobic', affinity: 1 })
    expect(p.processes.find((x) => x.process === 'washed')?.evidence).toBe(
      'rated 1 of 3 washed coffees 4★+',
    )
  })

  it('skips uncategorized notes', () => {
    const p = computeProfile([
      { rating: 5, tastingNotes: ['motor oil'], process: null, flavorOrigin: null },
    ])
    expect(p.clusters).toEqual([])
  })

  it('builds honestly when nothing is liked (all low ratings)', () => {
    const p = computeProfile([
      { rating: 2, tastingNotes: ['jasmine'], process: 'washed', flavorOrigin: 'process' },
      { rating: 1, tastingNotes: ['lemon'], process: 'washed', flavorOrigin: 'process' },
    ])
    expect(p.ratedCount).toBe(2)
    expect(p.clusters).toEqual([])
    expect(p.processes).toEqual([])
  })
})
