import { describe, it, expect } from 'vitest'
import { ParsedListingSchema } from './schema'

describe('ParsedListingSchema', () => {
  it('accepts a complete valid listing', () => {
    const result = ParsedListingSchema.safeParse({
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
      tastingNotes: ['watermelon bubble gum', 'strawberry yogurt candy'],
      priceCents: 2200,
      sizeGrams: 227,
      parseConfidence: 'HIGH',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid process value', () => {
    const result = ParsedListingSchema.safeParse({
      roasterName: 'Test Roaster',
      roasterWebsite: null,
      coffeeName: 'Test Coffee',
      originCountry: null,
      originRegion: null,
      producer: null,
      variety: null,
      process: 'sous_vide',
      processDetail: null,
      flavorOrigin: 'unknown',
      tastingNotes: [],
      priceCents: null,
      sizeGrams: null,
      parseConfidence: 'LOW',
    })
    expect(result.success).toBe(false)
  })

  it('requires roasterName and coffeeName', () => {
    const result = ParsedListingSchema.safeParse({ roasterName: '', coffeeName: '' })
    expect(result.success).toBe(false)
  })
})
