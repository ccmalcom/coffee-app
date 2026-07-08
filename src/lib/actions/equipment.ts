'use server'

import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { equipment, type equipmentKindEnum } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'

export type EquipmentKind = (typeof equipmentKindEnum.enumValues)[number]

export type EquipmentInput = {
  kind: EquipmentKind
  nickname: string
  brand?: string
  model?: string
  notes?: string
  microStepsPerMacroNotch?: number | null
}

export async function createEquipment(input: EquipmentInput): Promise<{ id: string }> {
  const userId = await requireUserId()

  // Only grinders carry a micro-steps constant; force machines to NULL.
  const microSteps =
    input.kind === 'grinder' ? (input.microStepsPerMacroNotch ?? null) : null

  const [created] = await db
    .insert(equipment)
    .values({
      userId,
      kind: input.kind,
      nickname: input.nickname,
      brand: input.brand ?? null,
      model: input.model ?? null,
      notes: input.notes ?? null,
      microStepsPerMacroNotch: microSteps,
    })
    .returning()

  return { id: created.id }
}

export type EquipmentItem = {
  id: string
  kind: EquipmentKind
  nickname: string
  brand: string | null
  model: string | null
  microStepsPerMacroNotch: number | null
}

export async function listEquipment(kind?: EquipmentKind): Promise<EquipmentItem[]> {
  const userId = await requireUserId()
  const whereClause = kind
    ? and(eq(equipment.userId, userId), eq(equipment.kind, kind))
    : eq(equipment.userId, userId)

  const rows = await db
    .select({
      id: equipment.id,
      kind: equipment.kind,
      nickname: equipment.nickname,
      brand: equipment.brand,
      model: equipment.model,
      microStepsPerMacroNotch: equipment.microStepsPerMacroNotch,
    })
    .from(equipment)
    .where(whereClause)
    .orderBy(asc(equipment.nickname))

  return rows
}
