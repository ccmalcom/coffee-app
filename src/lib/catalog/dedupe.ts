import { db } from '@/lib/db'
import { roasters, coffees } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ParsedListing } from '@/lib/parsing/schema'
import { diceCoefficient } from './similarity'

const FUZZY_MATCH_THRESHOLD = 0.85

export async function findOrCreateRoaster(
  name: string,
  website?: string | null,
): Promise<string> {
  const existing = await db
    .select()
    .from(roasters)
    .where(eq(roasters.name, name))
  if (existing.length > 0) return existing[0].id

  const [created] = await db
    .insert(roasters)
    .values({ name, website: website ?? null })
    .returning()
  return created.id
}

export async function findOrCreateCoffee(
  parsed: ParsedListing,
  opts: { barcode?: string | null; listingUrl?: string | null } = {},
): Promise<{ coffeeId: string; wasExisting: boolean }> {
  // 1. Barcode match — strongest signal, a physical bag was scanned.
  if (opts.barcode) {
    const byBarcode = await db
      .select()
      .from(coffees)
      .where(eq(coffees.barcode, opts.barcode))
    if (byBarcode.length > 0) {
      return pickHighestConfidence(byBarcode)
    }
  }

  // 2. Listing URL match — same product page seen before.
  if (opts.listingUrl) {
    const byUrl = await db
      .select()
      .from(coffees)
      .where(eq(coffees.listingUrl, opts.listingUrl))
    if (byUrl.length > 0) {
      return pickHighestConfidence(byUrl)
    }
  }

  const roasterId = await findOrCreateRoaster(
    parsed.roasterName,
    parsed.roasterWebsite,
  )

  // 3. Fuzzy roaster+name match — same roaster, near-identical coffee name.
  const roasterCoffees = await db
    .select()
    .from(coffees)
    .where(eq(coffees.roasterId, roasterId))
  const fuzzyMatch = roasterCoffees
    .map((c) => ({
      coffee: c,
      score: diceCoefficient(c.name, parsed.coffeeName),
    }))
    .filter((m) => m.score >= FUZZY_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0]

  if (fuzzyMatch) {
    return { coffeeId: fuzzyMatch.coffee.id, wasExisting: true }
  }

  // 4. Nothing matched — create a new catalog row.
  const [created] = await db
    .insert(coffees)
    .values({
      roasterId,
      name: parsed.coffeeName,
      originCountry: parsed.originCountry,
      originRegion: parsed.originRegion,
      producer: parsed.producer,
      variety: parsed.variety,
      process: parsed.process,
      processDetail: parsed.processDetail,
      flavorOrigin: parsed.flavorOrigin,
      tastingNotes: parsed.tastingNotes,
      rawListingText: null,
      listingUrl: opts.listingUrl ?? null,
      barcode: opts.barcode ?? null,
      priceCents: parsed.priceCents,
      sizeGrams: parsed.sizeGrams,
      parseConfidence: parsed.parseConfidence,
    })
    .returning()

  return { coffeeId: created.id, wasExisting: false }
}

function pickHighestConfidence<
  T extends { id: string; parseConfidence: string },
>(
  rows: T[],
): {
  coffeeId: string
  wasExisting: true
} {
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const
  const best = [...rows].sort(
    (a, b) =>
      (rank[b.parseConfidence as keyof typeof rank] ?? 0) -
      (rank[a.parseConfidence as keyof typeof rank] ?? 0),
  )[0]
  return { coffeeId: best.id, wasExisting: true }
}
