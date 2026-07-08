import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shots, equipment } from '@/lib/db/schema'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

type Row = Record<string, unknown>
const dbState = {
  equipment: [] as Row[],
  shots: [] as Row[],
}
let lastShotInsert: Row | null = null

// Reference-equality routing: the mock cannot parse Drizzle where-clauses, so
// tests preload dbState with exactly the rows a query would have matched.
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () =>
            Promise.resolve(table === equipment ? dbState.equipment : dbState.shots),
          then: (resolve: (rows: Row[]) => unknown) =>
            resolve(table === equipment ? dbState.equipment : dbState.shots),
        }),
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(dbState.shots),
            }),
          }),
          where: () => ({
            orderBy: () => Promise.resolve(dbState.shots),
          }),
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Row) => ({
        returning: () => {
          if (table !== shots) throw new Error('unexpected insert target')
          lastShotInsert = vals
          return Promise.resolve([{ id: 'shot-1', ...vals }])
        },
      }),
    }),
  },
}))

describe('logShot', () => {
  beforeEach(() => {
    dbState.equipment = [{ id: 'grinder-1', microStepsPerMacroNotch: 6 }]
    dbState.shots = []
    lastShotInsert = null
  })

  it('computes grind fields for a micro-dial grinder', async () => {
    const { logShot } = await import('./shots')
    await logShot({
      coffeeId: 'coffee-1',
      grinderId: 'grinder-1',
      machineId: 'machine-1',
      doseGrams: 18,
      yieldGrams: 36,
      timeSeconds: 28,
      macroInput: 12,
      microInput: -2,
      outcomeTags: ['balanced'],
    })
    expect(lastShotInsert).toMatchObject({
      userId: 'user-1',
      grindMacro: 12,
      grindMicro: -2,
      grindSetting: '12 / -2',
    })
    expect(lastShotInsert?.grindPosition).toBeCloseTo(12 - 2 / 6, 10)
  })

  it('stores a non-numeric free-text setting with null numeric columns', async () => {
    dbState.equipment = [{ id: 'grinder-1', microStepsPerMacroNotch: null }]
    const { logShot } = await import('./shots')
    await logShot({
      coffeeId: 'coffee-1',
      grinderId: 'grinder-1',
      machineId: 'machine-1',
      doseGrams: 18,
      yieldGrams: 36,
      timeSeconds: 28,
      textInput: 'medium-fine',
      outcomeTags: [],
    })
    expect(lastShotInsert).toMatchObject({
      grindMacro: null,
      grindMicro: null,
      grindPosition: null,
      grindSetting: 'medium-fine',
    })
  })
})
