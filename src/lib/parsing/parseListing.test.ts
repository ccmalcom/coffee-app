// src/lib/parsing/parseListing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JULIO_MADRID_CATURRA_NITRO_LISTING } from './fixtures/julioMadridCaturraNitro'

const mockParse = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { parse: mockParse }
    },
  }
})

describe('parseListing', () => {
  beforeEach(() => {
    mockParse.mockReset()
  })

  it('PERMANENT CALIBRATION: parses Julio Madrid Caturra Nitro as nitro_washed / process', async () => {
    mockParse.mockResolvedValue({
      parsed_output: {
        roasterName: 'Tinker Coffee Co.',
        roasterWebsite: null,
        coffeeName: 'Colombia Julio Madrid Caturra Nitro',
        originCountry: 'Colombia',
        originRegion: null,
        producer: 'Julio Madrid',
        variety: 'Caturra',
        process: 'nitro_washed',
        processDetail: 'Nitro Washed (nitrogen-flushed anaerobic fermentation, then washed)',
        flavorOrigin: 'process',
        tastingNotes: ['watermelon bubble gum', 'strawberry yogurt candy', 'mango creamsicle', 'pink lemonade'],
        priceCents: 2400,
        sizeGrams: 340,
        parseConfidence: 'HIGH',
      },
    })

    const { parseListing } = await import('./parseListing')
    const result = await parseListing(JULIO_MADRID_CATURRA_NITRO_LISTING)

    expect(result.process).toBe('nitro_washed')
    expect(result.flavorOrigin).toBe('process')
    expect(result.tastingNotes).toContain('watermelon bubble gum')
  })

  it('retries once on a validation failure, then succeeds', async () => {
    mockParse
      .mockResolvedValueOnce({ parsed_output: { coffeeName: '' } }) // invalid: fails schema
      .mockResolvedValueOnce({
        parsed_output: {
          roasterName: 'Test Roaster',
          roasterWebsite: null,
          coffeeName: 'Test Coffee',
          originCountry: null,
          originRegion: null,
          producer: null,
          variety: null,
          process: null,
          processDetail: null,
          flavorOrigin: 'unknown',
          tastingNotes: [],
          priceCents: null,
          sizeGrams: null,
          parseConfidence: 'MEDIUM',
        },
      })

    const { parseListing } = await import('./parseListing')
    const result = await parseListing('some sparse listing text')

    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(result.coffeeName).toBe('Test Coffee')
  })

  it('falls back to a LOW-confidence best-effort row after two failed attempts, never throwing', async () => {
    mockParse
      .mockResolvedValueOnce({ parsed_output: { coffeeName: '' } })
      .mockResolvedValueOnce({ parsed_output: { coffeeName: '' } })

    const { parseListing } = await import('./parseListing')
    const result = await parseListing('Some Roaster - Some Coffee, barely any info')

    expect(result.parseConfidence).toBe('LOW')
    expect(result.coffeeName.length).toBeGreaterThan(0)
  })
})
