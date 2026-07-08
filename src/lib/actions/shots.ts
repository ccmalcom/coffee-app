'use server'

import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { shots, equipment } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'
import { deriveGrindFields } from '@/lib/grind/position'
import {
  decideDialInState,
  type DialInState,
  type ShotForSuggestion,
} from '@/lib/grind/suggestion'

export type LogShotInput = {
  coffeeId: string
  grinderId: string
  machineId: string
  doseGrams: number
  yieldGrams: number
  timeSeconds: number
  macroInput?: number | null
  microInput?: number | null
  textInput?: string
  outcomeTags: string[]
  note?: string
  rating?: number | null
}

async function grinderMicroSteps(
  userId: string,
  grinderId: string,
): Promise<number | null> {
  const rows = await db
    .select({ microStepsPerMacroNotch: equipment.microStepsPerMacroNotch })
    .from(equipment)
    .where(and(eq(equipment.userId, userId), eq(equipment.id, grinderId)))
  return rows[0]?.microStepsPerMacroNotch ?? null
}

export async function logShot(input: LogShotInput): Promise<{ id: string }> {
  const userId = await requireUserId()
  const microSteps = await grinderMicroSteps(userId, input.grinderId)

  const grind = deriveGrindFields({
    microStepsPerMacroNotch: microSteps,
    macroInput: input.macroInput,
    microInput: input.microInput,
    textInput: input.textInput,
  })

  const [created] = await db
    .insert(shots)
    .values({
      userId,
      coffeeId: input.coffeeId,
      grinderId: input.grinderId,
      machineId: input.machineId,
      doseGrams: input.doseGrams,
      yieldGrams: input.yieldGrams,
      timeSeconds: input.timeSeconds,
      grindSetting: grind.grindSetting,
      grindMacro: grind.grindMacro,
      grindMicro: grind.grindMicro,
      grindPosition: grind.grindPosition,
      outcomeTags: input.outcomeTags as (typeof shots.$inferInsert)['outcomeTags'],
      note: input.note ?? null,
      rating: input.rating ?? null,
    })
    .returning()

  return { id: created.id }
}

export type ShotHistoryItem = {
  id: string
  grinderNickname: string
  machineNickname: string
  doseGrams: number
  yieldGrams: number
  timeSeconds: number
  grindSetting: string
  outcomeTags: string[]
  rating: number | null
  note: string | null
  brewedAt: string
}

export async function listShotsForCoffee(coffeeId: string): Promise<ShotHistoryItem[]> {
  const userId = await requireUserId()

  const rows = await db
    .select({
      id: shots.id,
      grinderId: shots.grinderId,
      machineId: shots.machineId,
      doseGrams: shots.doseGrams,
      yieldGrams: shots.yieldGrams,
      timeSeconds: shots.timeSeconds,
      grindSetting: shots.grindSetting,
      outcomeTags: shots.outcomeTags,
      rating: shots.rating,
      note: shots.note,
      brewedAt: shots.brewedAt,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.coffeeId, coffeeId)))
    .orderBy(desc(shots.brewedAt))

  const equip = await db
    .select({
      id: equipment.id,
      nickname: equipment.nickname,
    })
    .from(equipment)
    .where(eq(equipment.userId, userId))
  const nameOf = new Map(equip.map((e) => [e.id, e.nickname]))

  return rows.map((r) => ({
    id: r.id,
    grinderNickname: nameOf.get(r.grinderId) ?? 'Unknown grinder',
    machineNickname: nameOf.get(r.machineId) ?? 'Unknown machine',
    doseGrams: r.doseGrams,
    yieldGrams: r.yieldGrams,
    timeSeconds: r.timeSeconds,
    grindSetting: r.grindSetting,
    outcomeTags: r.outcomeTags,
    rating: r.rating,
    note: r.note,
    brewedAt: r.brewedAt.toISOString(),
  }))
}

export type ShotPrefill = {
  grinderId: string
  machineId: string
  doseGrams: number
  yieldGrams: number
} | null

export async function getLastShot(coffeeId: string): Promise<ShotPrefill> {
  const userId = await requireUserId()
  const rows = await db
    .select({
      grinderId: shots.grinderId,
      machineId: shots.machineId,
      doseGrams: shots.doseGrams,
      yieldGrams: shots.yieldGrams,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.coffeeId, coffeeId)))
    .orderBy(desc(shots.brewedAt))
  return rows[0] ?? null
}

function toSuggestionShots(
  rows: { grindPosition: number | null; timeSeconds: number; outcomeTags: string[] }[],
): ShotForSuggestion[] {
  return rows
    // Interpolation-eligible only when the stored position is a real finite
    // number. Non-numeric shots store NULL; a malformed write could store NaN
    // (Postgres `real` accepts it) — either would poison the OLS/median math,
    // so both are excluded here rather than leaked into the suggestion engine.
    .filter((r) => r.grindPosition !== null && Number.isFinite(r.grindPosition))
    .map((r) => ({
      grindPosition: r.grindPosition as number,
      timeSeconds: r.timeSeconds,
      outcomeTags: r.outcomeTags,
    }))
}

async function computeDialIn(
  userId: string,
  coffeeId: string,
  grinderId: string,
  machineId: string,
): Promise<DialInState> {
  const microSteps = await grinderMicroSteps(userId, grinderId)

  const comboRows = await db
    .select({
      grindPosition: shots.grindPosition,
      timeSeconds: shots.timeSeconds,
      outcomeTags: shots.outcomeTags,
    })
    .from(shots)
    .where(
      and(
        eq(shots.userId, userId),
        eq(shots.coffeeId, coffeeId),
        eq(shots.grinderId, grinderId),
        eq(shots.machineId, machineId),
      ),
    )

  const pairRows = await db
    .select({
      grindPosition: shots.grindPosition,
      timeSeconds: shots.timeSeconds,
      outcomeTags: shots.outcomeTags,
    })
    .from(shots)
    .where(
      and(
        eq(shots.userId, userId),
        eq(shots.grinderId, grinderId),
        eq(shots.machineId, machineId),
      ),
    )

  return decideDialInState(
    toSuggestionShots(comboRows),
    toSuggestionShots(pairRows),
    microSteps,
  )
}

export async function getDialInState(input: {
  coffeeId: string
  grinderId: string
  machineId: string
}): Promise<DialInState> {
  const userId = await requireUserId()
  return computeDialIn(userId, input.coffeeId, input.grinderId, input.machineId)
}

export type CoffeeDialIn = {
  grinderNickname: string
  machineNickname: string
  state: DialInState
}

export async function listCoffeeDialIns(coffeeId: string): Promise<CoffeeDialIn[]> {
  const userId = await requireUserId()

  const comboRows = await db
    .select({ grinderId: shots.grinderId, machineId: shots.machineId })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.coffeeId, coffeeId)))

  const seen = new Set<string>()
  const combos: { grinderId: string; machineId: string }[] = []
  for (const r of comboRows) {
    const key = `${r.grinderId}|${r.machineId}`
    if (!seen.has(key)) {
      seen.add(key)
      combos.push({ grinderId: r.grinderId, machineId: r.machineId })
    }
  }

  const equip = await db
    .select({ id: equipment.id, nickname: equipment.nickname })
    .from(equipment)
    .where(eq(equipment.userId, userId))
  const nameOf = new Map(equip.map((e) => [e.id, e.nickname]))

  const results: CoffeeDialIn[] = []
  for (const c of combos) {
    results.push({
      grinderNickname: nameOf.get(c.grinderId) ?? 'Unknown grinder',
      machineNickname: nameOf.get(c.machineId) ?? 'Unknown machine',
      state: await computeDialIn(userId, coffeeId, c.grinderId, c.machineId),
    })
  }
  return results
}
