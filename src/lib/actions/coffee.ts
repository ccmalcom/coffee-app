'use server'

import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  coffees,
  roasters,
  libraryEntries,
  type libraryStatusEnum,
} from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'
import { parseListing, ListingParseError } from '@/lib/parsing/parseListing'
import { findOrCreateCoffee } from '@/lib/catalog/dedupe'
import {
  lookupByBarcode,
  type BarcodeLookupResult,
} from '@/lib/catalog/barcodeLookup'

type LibraryStatus = (typeof libraryStatusEnum.enumValues)[number]

async function upsertOwnedEntry(userId: string, coffeeId: string) {
  const existing = await db
    .select()
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(libraryEntries.coffeeId, coffeeId),
      ),
    )

  if (existing.length > 0) return existing[0]

  const [created] = await db
    .insert(libraryEntries)
    .values({ userId, coffeeId, status: 'owned', acquiredAt: new Date() })
    .returning()
  return created
}

export async function addCoffeeFromListing(input: {
  rawText: string
  listingUrl?: string
  barcode?: string
}): Promise<{
  coffeeId: string
  wasExisting: boolean
  parseConfidence: string
}> {
  const userId = await requireUserId()

  let parsed
  try {
    parsed = await parseListing(input.rawText)
  } catch (err) {
    if (err instanceof ListingParseError) {
      throw new Error(
        'Could not reach the coffee parser right now — try again in a moment.',
      )
    }
    throw err
  }

  const { coffeeId, wasExisting } = await findOrCreateCoffee(parsed, {
    listingUrl: input.listingUrl,
    barcode: input.barcode,
  })

  await upsertOwnedEntry(userId, coffeeId)

  return { coffeeId, wasExisting, parseConfidence: parsed.parseConfidence }
}

export async function addCoffeeFromBarcode(
  barcode: string,
): Promise<BarcodeLookupResult> {
  await requireUserId()
  return lookupByBarcode(barcode)
}

export async function confirmBarcodeCoffee(
  barcode: string,
  rawText: string,
): Promise<{ coffeeId: string; wasExisting: boolean }> {
  const userId = await requireUserId()

  let parsed
  try {
    parsed = await parseListing(rawText)
  } catch (err) {
    if (err instanceof ListingParseError) {
      throw new Error(
        'Could not reach the coffee parser right now — try again in a moment.',
      )
    }
    throw err
  }

  const { coffeeId, wasExisting } = await findOrCreateCoffee(parsed, {
    barcode,
  })
  await upsertOwnedEntry(userId, coffeeId)
  return { coffeeId, wasExisting }
}

export async function rateCoffee(input: {
  coffeeId: string
  rating: number
  review?: string
  status?: LibraryStatus
}): Promise<void> {
  const userId = await requireUserId()

  const existing = await db
    .select()
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(libraryEntries.coffeeId, input.coffeeId),
      ),
    )

  if (existing.length > 0) {
    // Preserve the entry's current status unless the caller explicitly passed one —
    // rating a wishlist/finished coffee shouldn't silently reset it to 'owned'.
    await db
      .update(libraryEntries)
      .set({
        rating: input.rating,
        review: input.review ?? null,
        status: input.status ?? existing[0].status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(libraryEntries.userId, userId),
          eq(libraryEntries.coffeeId, input.coffeeId),
        ),
      )
    return
  }

  // No entry exists yet (e.g. rating a Discovery candidate) — create one instead
  // of letting the UPDATE silently match zero rows and lose the rating.
  await db
    .insert(libraryEntries)
    .values({
      userId,
      coffeeId: input.coffeeId,
      rating: input.rating,
      review: input.review ?? null,
      status: input.status ?? 'owned',
      acquiredAt: new Date(),
    })
    .returning()
}

export type LibraryEntryWithCoffee = {
  entryId: string
  coffeeId: string
  coffeeName: string
  roasterName: string
  status: LibraryStatus
  rating: number | null
  review: string | null
}

export async function listLibrary(
  status?: LibraryStatus,
): Promise<LibraryEntryWithCoffee[]> {
  const userId = await requireUserId()
  const whereClause = status
    ? and(eq(libraryEntries.userId, userId), eq(libraryEntries.status, status))
    : eq(libraryEntries.userId, userId)

  const rows = await db
    .select({
      entryId: libraryEntries.id,
      coffeeId: coffees.id,
      coffeeName: coffees.name,
      roasterName: roasters.name,
      status: libraryEntries.status,
      rating: libraryEntries.rating,
      review: libraryEntries.review,
    })
    .from(libraryEntries)
    .innerJoin(coffees, eq(libraryEntries.coffeeId, coffees.id))
    .innerJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(whereClause)
    .orderBy(desc(libraryEntries.updatedAt))

  return rows
}

export type CoffeeDetail = {
  id: string
  name: string
  roasterName: string
  originCountry: string | null
  originRegion: string | null
  producer: string | null
  variety: string | null
  process: string | null
  processDetail: string | null
  tastingNotes: string[]
  rating: number | null
  review: string | null
  status: LibraryStatus | null
}

export async function getCoffeeDetail(
  coffeeId: string,
): Promise<CoffeeDetail | null> {
  const userId = await requireUserId()

  const coffeeRows = await db
    .select({
      id: coffees.id,
      name: coffees.name,
      roasterName: roasters.name,
      originCountry: coffees.originCountry,
      originRegion: coffees.originRegion,
      producer: coffees.producer,
      variety: coffees.variety,
      process: coffees.process,
      processDetail: coffees.processDetail,
      tastingNotes: coffees.tastingNotes,
    })
    .from(coffees)
    .innerJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(eq(coffees.id, coffeeId))

  if (coffeeRows.length === 0) return null

  const entryRows = await db
    .select({
      rating: libraryEntries.rating,
      review: libraryEntries.review,
      status: libraryEntries.status,
    })
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(libraryEntries.coffeeId, coffeeId),
      ),
    )

  const entry = entryRows[0]

  return {
    ...coffeeRows[0],
    rating: entry?.rating ?? null,
    review: entry?.review ?? null,
    status: (entry?.status as LibraryStatus) ?? null,
  }
}
