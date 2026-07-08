import { describe, it, expect, vi, beforeEach } from 'vitest'
import { equipment } from '@/lib/db/schema'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

type Row = Record<string, unknown>
const dbState = { equipment: [] as Row[] }
let lastInsertValues: Row | null = null

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () =>
            Promise.resolve(table === equipment ? dbState.equipment : []),
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Row) => ({
        returning: () => {
          if (table !== equipment) throw new Error('unexpected insert target')
          lastInsertValues = vals
          const row = { id: 'eq-1', ...vals }
          dbState.equipment.push(row)
          return Promise.resolve([row])
        },
      }),
    }),
  },
}))

describe('createEquipment', () => {
  beforeEach(() => {
    dbState.equipment = []
    lastInsertValues = null
  })

  it('persists a grinder with its micro-steps constant and the user id', async () => {
    const { createEquipment } = await import('./equipment')
    const result = await createEquipment({
      kind: 'grinder',
      nickname: 'Daily driver',
      microStepsPerMacroNotch: 6,
    })
    expect(result.id).toBe('eq-1')
    expect(lastInsertValues).toMatchObject({
      userId: 'user-1',
      kind: 'grinder',
      nickname: 'Daily driver',
      microStepsPerMacroNotch: 6,
    })
  })

  it('stores a machine with a null micro-steps constant', async () => {
    const { createEquipment } = await import('./equipment')
    await createEquipment({ kind: 'machine', nickname: 'Silvia' })
    expect(lastInsertValues).toMatchObject({
      kind: 'machine',
      microStepsPerMacroNotch: null,
    })
  })
})

describe('listEquipment', () => {
  beforeEach(() => {
    dbState.equipment = [
      {
        id: 'eq-1',
        kind: 'grinder',
        nickname: 'Daily driver',
        brand: null,
        model: null,
        microStepsPerMacroNotch: 6,
      },
    ]
  })

  it('returns the user\'s equipment rows', async () => {
    const { listEquipment } = await import('./equipment')
    const rows = await listEquipment()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ nickname: 'Daily driver', microStepsPerMacroNotch: 6 })
  })
})
