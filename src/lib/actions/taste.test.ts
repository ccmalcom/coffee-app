import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

const { generateProfileSummaryMock } = vi.hoisted(() => ({
  generateProfileSummaryMock: vi.fn(),
}))
vi.mock('@/lib/taste/prose', () => ({
  generateProfileSummary: generateProfileSummaryMock,
  ProseGenerationError: class ProseGenerationError extends Error {},
}))

const { dbState } = vi.hoisted(() => ({
  dbState: {
    rated: [] as Record<string, unknown>[],
    profiles: [] as Record<string, unknown>[],
    directives: [] as Record<string, unknown>[],
    lastInsert: null as { table: string; values: Record<string, unknown> } | null,
    lastUpdate: null as { table: string; values: Record<string, unknown> } | null,
  },
}))

// Import schema INSIDE the async factory (never reference statically-imported
// bindings from a hoisted factory — that is the TDZ trap Plan 2 hit).
vi.mock('@/lib/db', async () => {
  const { libraryEntries, tasteProfile, directives } = await import('@/lib/db/schema')
  const route = (table: unknown) =>
    table === libraryEntries
      ? dbState.rated
      : table === tasteProfile
        ? dbState.profiles
        : table === directives
          ? dbState.directives
          : []
  // A thenable that also exposes the chain methods, so BOTH
  // `await select().from(t).where(...)` and
  // `select().from(t).innerJoin(...).where(...).orderBy(...)` resolve to rows.
  const chain = (rows: unknown[]) => {
    const p = Promise.resolve(rows) as Promise<unknown[]> & Record<string, unknown>
    p.innerJoin = () => chain(rows)
    p.where = () => chain(rows)
    p.orderBy = () => chain(rows)
    return p
  }
  const label = (table: unknown) =>
    table === tasteProfile ? 'tasteProfile' : table === directives ? 'directives' : 'other'
  return {
    db: {
      select: () => ({ from: (table: unknown) => chain(route(table)) }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          returning: () => {
            dbState.lastInsert = { table: label(table), values }
            const row = { id: 'row-1', ...values }
            if (table === tasteProfile) dbState.profiles.unshift(row)
            if (table === directives) dbState.directives.push(row)
            return Promise.resolve([row])
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            dbState.lastUpdate = { table: label(table), values }
            if (table === directives && dbState.directives[0]) {
              Object.assign(dbState.directives[0], values)
            }
            return Promise.resolve(undefined)
          },
        }),
      }),
    },
  }
})

function ratedRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    rating: 5,
    review: null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    tastingNotes: ['jasmine'],
    process: 'washed',
    flavorOrigin: 'process',
    ...over,
  }
}

beforeEach(() => {
  dbState.rated = []
  dbState.profiles = []
  dbState.directives = []
  dbState.lastInsert = null
  dbState.lastUpdate = null
  generateProfileSummaryMock.mockReset()
})

describe('getProfileView', () => {
  it('reports cold_start below the rated-coffee threshold', async () => {
    dbState.rated = [ratedRow(), ratedRow(), ratedRow()] // 3 < 5
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('cold_start')
    expect(view.ratedCount).toBe(3)
    expect(view.profile).toBeNull()
  })

  it('reports never_built with enough ratings but no stored row', async () => {
    dbState.rated = Array.from({ length: 5 }, () => ratedRow())
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('never_built')
  })

  it('reports fresh when the stored row is newer than every rating', async () => {
    dbState.rated = Array.from({ length: 5 }, () => ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }))
    dbState.profiles = [{ builtAt: new Date('2026-02-01T00:00:00Z'), profile: { version: 1, ratedCount: 5, clusters: [], processes: [], summary: 'hi' } }]
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('fresh')
    expect(view.newRatingsSince).toBe(0)
    expect(view.profile?.summary).toBe('hi')
  })

  it('reports stale and counts ratings changed since the build', async () => {
    dbState.rated = [
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-03-01T00:00:00Z') }), // newer than build
    ]
    dbState.profiles = [{ builtAt: new Date('2026-02-01T00:00:00Z'), profile: { version: 1, ratedCount: 4, clusters: [], processes: [], summary: '' } }]
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('stale')
    expect(view.newRatingsSince).toBe(1)
  })
})

describe('rebuildProfile', () => {
  it('computes the profile, attaches the LLM summary, and inserts a fresh row', async () => {
    dbState.rated = [
      ratedRow({ rating: 5, tastingNotes: ['watermelon bubble gum'], process: 'anaerobic', review: 'insane strawberry' }),
      ratedRow({ rating: 4, tastingNotes: ['strawberry yogurt candy'], process: 'natural' }),
      ratedRow({ rating: 5, tastingNotes: ['jasmine'], process: 'washed' }),
      ratedRow({ rating: 4, tastingNotes: ['pineapple'], process: 'natural' }),
      ratedRow({ rating: 5, tastingNotes: ['lychee'], process: 'natural' }),
    ]
    generateProfileSummaryMock.mockResolvedValue('You love funky naturals.')
    const { rebuildProfile } = await import('./taste')
    const view = await rebuildProfile()

    expect(dbState.lastInsert?.table).toBe('tasteProfile')
    const stored = dbState.lastInsert?.values.profile as { ratedCount: number; summary: string }
    expect(stored.ratedCount).toBe(5)
    expect(stored.summary).toBe('You love funky naturals.')
    expect(dbState.lastInsert?.values.stale).toBe(false)
    expect(view.state).toBe('fresh')
    // reviews reach the prose step, not the compute step
    expect(generateProfileSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ ratedCount: 5 }),
      expect.arrayContaining(['insane strawberry']),
    )
  })

  it('still saves the profile with an empty summary when prose fails', async () => {
    dbState.rated = Array.from({ length: 5 }, () => ratedRow({ tastingNotes: ['jasmine'], process: 'washed' }))
    const { ProseGenerationError } = await import('@/lib/taste/prose')
    generateProfileSummaryMock.mockRejectedValue(new ProseGenerationError('down'))
    const { rebuildProfile } = await import('./taste')
    await rebuildProfile()
    const stored = dbState.lastInsert?.values.profile as { summary: string }
    expect(stored.summary).toBe('')
  })
})

describe('directives', () => {
  it('returns sensible defaults when no directive exists', async () => {
    const { getDirective } = await import('./taste')
    const d = await getDirective()
    expect(d).toEqual({ goals: [], freeText: null, excludeAddedFlavor: true })
  })

  it('inserts a new directive when none exists', async () => {
    const { saveDirective } = await import('./taste')
    await saveDirective({ goals: ['wild_process'], freeText: 'lots of fruit', excludeAddedFlavor: false })
    expect(dbState.lastInsert?.table).toBe('directives')
    expect(dbState.lastInsert?.values).toMatchObject({
      userId: 'user-1',
      goals: ['wild_process'],
      freeText: 'lots of fruit',
      excludeAddedFlavor: false,
    })
  })

  it('updates the existing directive in place', async () => {
    dbState.directives = [{ userId: 'user-1', goals: [], freeText: null, excludeAddedFlavor: true }]
    const { saveDirective } = await import('./taste')
    await saveDirective({ goals: ['daily_drinkers'], excludeAddedFlavor: true })
    expect(dbState.lastUpdate?.table).toBe('directives')
    expect(dbState.directives[0]).toMatchObject({ goals: ['daily_drinkers'] })
  })
})
