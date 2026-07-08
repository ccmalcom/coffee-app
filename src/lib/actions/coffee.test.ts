import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

const parseListingMock = vi.fn()
vi.mock('@/lib/parsing/parseListing', () => ({
  parseListing: parseListingMock,
  ListingParseError: class ListingParseError extends Error {},
}))

const findOrCreateCoffeeMock = vi.fn()
vi.mock('@/lib/catalog/dedupe', () => ({
  findOrCreateCoffee: findOrCreateCoffeeMock,
}))

const lookupByBarcodeMock = vi.fn()
vi.mock('@/lib/catalog/barcodeLookup', () => ({
  lookupByBarcode: lookupByBarcodeMock,
}))

const dbState = {
  libraryEntries: [] as Array<{
    id: string
    userId: string
    coffeeId: string
    status: string
    rating: number | null
    review: string | null
  }>,
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(dbState.libraryEntries),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () => {
          const row = { id: `le-${Math.random()}`, ...vals }
          dbState.libraryEntries.push(row as never)
          return Promise.resolve([row])
        },
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          Object.assign(dbState.libraryEntries[0], vals)
          return Promise.resolve()
        },
      }),
    }),
  },
}))

describe('addCoffeeFromListing', () => {
  beforeEach(() => {
    dbState.libraryEntries = []
    parseListingMock.mockReset()
    findOrCreateCoffeeMock.mockReset()
  })

  it('parses, dedupes, and creates a candidate library entry', async () => {
    parseListingMock.mockResolvedValue({ coffeeName: 'Test Coffee', parseConfidence: 'HIGH' })
    findOrCreateCoffeeMock.mockResolvedValue({ coffeeId: 'coffee-1', wasExisting: false })

    const { addCoffeeFromListing } = await import('./coffee')
    const result = await addCoffeeFromListing({ rawText: 'some listing text' })

    expect(result.coffeeId).toBe('coffee-1')
    expect(result.wasExisting).toBe(false)
    expect(dbState.libraryEntries).toHaveLength(1)
    expect(dbState.libraryEntries[0].status).toBe('owned')
  })
})

describe('addCoffeeFromBarcode', () => {
  beforeEach(() => {
    lookupByBarcodeMock.mockReset()
  })

  it('returns the catalog verdict directly when the barcode is already known', async () => {
    lookupByBarcodeMock.mockResolvedValue({
      source: 'catalog',
      coffeeId: 'coffee-1',
      coffeeName: 'Test Coffee',
      roasterName: 'Test Roaster',
    })
    const { addCoffeeFromBarcode } = await import('./coffee')
    const result = await addCoffeeFromBarcode('012345678905')
    expect(result.source).toBe('catalog')
  })
})

describe('rateCoffee', () => {
  it('updates rating and review on the existing library entry', async () => {
    dbState.libraryEntries = [
      { id: 'le-1', userId: 'user-1', coffeeId: 'coffee-1', status: 'owned', rating: null, review: null },
    ]
    const { rateCoffee } = await import('./coffee')
    await rateCoffee({ coffeeId: 'coffee-1', rating: 4, review: 'Great strawberry candy notes' })
    expect(dbState.libraryEntries[0].rating).toBe(4)
    expect(dbState.libraryEntries[0].review).toBe('Great strawberry candy notes')
  })
})
