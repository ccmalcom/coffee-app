import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedListing } from '@/lib/parsing/schema'
import { roasters, coffees } from '@/lib/db/schema'

const dbState = {
  roasters: [] as Array<{ id: string; name: string; website: string | null }>,
  coffees: [] as Array<{
    id: string
    roasterId: string
    name: string
    barcode: string | null
    listingUrl: string | null
    parseConfidence: string
  }>,
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (table: typeof roasters | typeof coffees) => ({
        where: () => {
          const isRoasters = table === roasters
          return Promise.resolve(
            isRoasters ? dbState.roasters : dbState.coffees,
          )
        },
      }),
    }),
    insert: (table: typeof roasters | typeof coffees) => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () => {
          const row = { id: `generated-${Math.random()}`, ...vals }
          if (table === roasters) dbState.roasters.push(row as never)
          else dbState.coffees.push(row as never)
          return Promise.resolve([row])
        },
      }),
    }),
  },
}))

const basicParsed: ParsedListing = {
  roasterName: 'Tinker Coffee Co.',
  roasterWebsite: 'https://tinkercoffee.com',
  coffeeName: 'Julio Madrid Caturra Nitro',
  originCountry: 'Colombia',
  originRegion: null,
  producer: 'Julio Madrid',
  variety: 'Caturra',
  process: 'nitro_washed',
  processDetail: 'Nitro Washed',
  flavorOrigin: 'process',
  tastingNotes: ['watermelon bubble gum'],
  priceCents: 2400,
  sizeGrams: 340,
  parseConfidence: 'HIGH',
}

describe('findOrCreateCoffee', () => {
  beforeEach(() => {
    dbState.roasters = []
    dbState.coffees = []
  })

  it('creates a new roaster and coffee when nothing matches', async () => {
    const { findOrCreateCoffee } = await import('./dedupe')
    const result = await findOrCreateCoffee(basicParsed, {
      listingUrl: 'https://tinkercoffee.com/products/julio',
    })
    expect(result.wasExisting).toBe(false)
    expect(dbState.coffees).toHaveLength(1)
  })

  it('matches an existing coffee by barcode', async () => {
    dbState.roasters.push({
      id: 'r1',
      name: 'Tinker Coffee Co.',
      website: null,
    })
    dbState.coffees.push({
      id: 'c1',
      roasterId: 'r1',
      name: 'Julio Madrid Caturra Nitro',
      barcode: '012345678905',
      listingUrl: null,
      parseConfidence: 'HIGH',
    })
    const { findOrCreateCoffee } = await import('./dedupe')
    const result = await findOrCreateCoffee(basicParsed, {
      barcode: '012345678905',
    })
    expect(result.wasExisting).toBe(true)
    expect(result.coffeeId).toBe('c1')
  })

  it('matches an existing coffee by fuzzy roaster+name when no barcode/URL match', async () => {
    dbState.roasters.push({
      id: 'r1',
      name: 'Tinker Coffee Co.',
      website: null,
    })
    dbState.coffees.push({
      id: 'c1',
      roasterId: 'r1',
      name: 'Julio Madrid Caturra Nitro Washed',
      barcode: null,
      listingUrl: null,
      parseConfidence: 'MEDIUM',
    })
    const { findOrCreateCoffee } = await import('./dedupe')
    const result = await findOrCreateCoffee(basicParsed, {})
    expect(result.wasExisting).toBe(true)
    expect(result.coffeeId).toBe('c1')
  })
})
