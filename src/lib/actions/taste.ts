'use server'

import { eq, and, desc, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { libraryEntries, coffees, tasteProfile, directives } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'
import {
  computeProfile,
  type RatedCoffee,
  type TasteProfileData,
} from '@/lib/taste/profile'
import { generateProfileSummary, ProseGenerationError } from '@/lib/taste/prose'
import { MIN_RATED_COFFEES_FOR_PROFILE } from '@/lib/taste/constants'

export type ProfileState = 'cold_start' | 'never_built' | 'fresh' | 'stale'

export type ProfileView = {
  state: ProfileState
  profile: TasteProfileData | null
  builtAt: string | null
  ratedCount: number
  newRatingsSince: number
}

export type DirectiveView = {
  goals: string[]
  freeText: string | null
  excludeAddedFlavor: boolean
}

type RatedRow = {
  rating: number | null
  review: string | null
  updatedAt: Date
  tastingNotes: string[] | null
  process: string | null
  flavorOrigin: string | null
}

// The user's rated coffees joined to the catalog facts the profile is built from.
async function ratedEntries(userId: string): Promise<RatedRow[]> {
  return db
    .select({
      rating: libraryEntries.rating,
      review: libraryEntries.review,
      updatedAt: libraryEntries.updatedAt,
      tastingNotes: coffees.tastingNotes,
      process: coffees.process,
      flavorOrigin: coffees.flavorOrigin,
    })
    .from(libraryEntries)
    .innerJoin(coffees, eq(libraryEntries.coffeeId, coffees.id))
    .where(and(eq(libraryEntries.userId, userId), isNotNull(libraryEntries.rating)))
    .orderBy(desc(libraryEntries.updatedAt)) as unknown as Promise<RatedRow[]>
}

export async function getProfileView(): Promise<ProfileView> {
  const userId = await requireUserId()
  const rated = await ratedEntries(userId)
  const ratedCount = rated.length

  const rows = await db
    .select()
    .from(tasteProfile)
    .where(eq(tasteProfile.userId, userId))
    .orderBy(desc(tasteProfile.builtAt))
  const latest = rows[0] ?? null

  if (ratedCount < MIN_RATED_COFFEES_FOR_PROFILE) {
    return { state: 'cold_start', profile: null, builtAt: null, ratedCount, newRatingsSince: 0 }
  }
  if (!latest) {
    return { state: 'never_built', profile: null, builtAt: null, ratedCount, newRatingsSince: 0 }
  }

  const builtAt = latest.builtAt as Date
  // Staleness is DERIVED here, never trusted from the `stale` column.
  const newRatingsSince = rated.filter((r) => r.updatedAt > builtAt).length

  return {
    state: newRatingsSince > 0 ? 'stale' : 'fresh',
    profile: latest.profile as TasteProfileData,
    builtAt: builtAt.toISOString(),
    ratedCount,
    newRatingsSince,
  }
}

export async function rebuildProfile(): Promise<ProfileView> {
  const userId = await requireUserId()
  const rated = await ratedEntries(userId)

  const ratedCoffees: RatedCoffee[] = rated.map((r) => ({
    rating: r.rating as number,
    tastingNotes: r.tastingNotes ?? [],
    process: r.process,
    flavorOrigin: r.flavorOrigin,
  }))

  const profile = computeProfile(ratedCoffees)

  const reviewSnippets = rated
    .map((r) => r.review)
    .filter((r): r is string => !!r && r.trim().length > 0)
    .slice(0, 5)

  try {
    profile.summary = await generateProfileSummary(profile, reviewSnippets)
  } catch (err) {
    // The deterministic profile is still saved; the UI offers a retry. Only a
    // prose failure degrades to an empty summary — anything else is a real bug.
    if (!(err instanceof ProseGenerationError)) throw err
    profile.summary = ''
  }

  await db
    .insert(tasteProfile)
    .values({ userId, profile, stale: false, builtAt: new Date() })
    .returning()

  return getProfileView()
}

export async function getDirective(): Promise<DirectiveView> {
  const userId = await requireUserId()
  const rows = await db.select().from(directives).where(eq(directives.userId, userId))
  const d = rows[0]
  return {
    goals: (d?.goals as string[] | undefined) ?? [],
    freeText: (d?.freeText as string | null | undefined) ?? null,
    excludeAddedFlavor: (d?.excludeAddedFlavor as boolean | undefined) ?? true,
  }
}

export async function saveDirective(input: {
  goals: string[]
  freeText?: string | null
  excludeAddedFlavor: boolean
}): Promise<void> {
  const userId = await requireUserId()
  const existing = await db.select().from(directives).where(eq(directives.userId, userId))

  if (existing.length > 0) {
    await db
      .update(directives)
      .set({
        goals: input.goals,
        freeText: input.freeText ?? null,
        excludeAddedFlavor: input.excludeAddedFlavor,
        editedAt: new Date(),
      })
      .where(eq(directives.userId, userId))
    return
  }

  await db
    .insert(directives)
    .values({
      userId,
      goals: input.goals,
      freeText: input.freeText ?? null,
      excludeAddedFlavor: input.excludeAddedFlavor,
    })
    .returning()
}
