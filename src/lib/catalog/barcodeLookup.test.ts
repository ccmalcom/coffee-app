import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbState = {
  rows: [] as Array<{ id: string; name: string; roasterName: string }>,
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve(dbState.rows),
        }),
      }),
    }),
  },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('lookupByBarcode', () => {
  beforeEach(() => {
    dbState.rows = []
    fetchMock.mockReset()
  })

  it('returns a catalog hit when the barcode is already known', async () => {
    dbState.rows = [{ id: 'c1', name: 'Julio Madrid Caturra Nitro', roasterName: 'Tinker Coffee Co.' }]
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('012345678905')
    expect(result).toEqual({
      source: 'catalog',
      coffeeId: 'c1',
      coffeeName: 'Julio Madrid Caturra Nitro',
      roasterName: 'Tinker Coffee Co.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to Open Food Facts when not in the catalog', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: { product_name: 'Some Grocery Coffee', brands: 'BigBrand' },
      }),
    })
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('999999999999')
    expect(result).toEqual({ source: 'open_food_facts', productName: 'Some Grocery Coffee', brand: 'BigBrand' })
  })

  it('returns not_found when neither the catalog nor Open Food Facts has it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 0 }) })
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('000000000000')
    expect(result).toEqual({ source: 'not_found' })
  })

  it('treats an Open Food Facts network failure as not_found rather than throwing', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('111111111111')
    expect(result).toEqual({ source: 'not_found' })
  })
})
