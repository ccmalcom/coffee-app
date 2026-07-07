import { z } from 'zod'

export const PROCESS_VALUES = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic_maceration',
  'nitro_washed',
  'co_ferment',
  'thermal_shock',
  'other',
] as const

export const FLAVOR_ORIGIN_VALUES = ['process', 'added', 'unknown'] as const

export const PARSE_CONFIDENCE_VALUES = ['HIGH', 'MEDIUM', 'LOW'] as const

export const ParsedListingSchema = z.object({
  roasterName: z.string().min(1),
  roasterWebsite: z.string().url().nullable(),
  coffeeName: z.string().min(1),
  originCountry: z.string().nullable(),
  originRegion: z.string().nullable(),
  producer: z.string().nullable(),
  variety: z.string().nullable(),
  process: z.enum(PROCESS_VALUES).nullable(),
  processDetail: z.string().nullable(),
  flavorOrigin: z.enum(FLAVOR_ORIGIN_VALUES),
  tastingNotes: z.array(z.string()),
  priceCents: z.number().int().nonnegative().nullable(),
  sizeGrams: z.number().int().positive().nullable(),
  parseConfidence: z.enum(PARSE_CONFIDENCE_VALUES),
})

export type ParsedListing = z.infer<typeof ParsedListingSchema>
