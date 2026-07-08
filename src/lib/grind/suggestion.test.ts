import { describe, it, expect } from 'vitest'
import {
  suggestGrind,
  newBagBaseline,
  decideDialInState,
  type ShotForSuggestion,
} from './suggestion'

function shot(
  grindPosition: number,
  timeSeconds: number,
  outcomeTags: string[] = [],
): ShotForSuggestion {
  return { grindPosition, timeSeconds, outcomeTags }
}

describe('suggestGrind', () => {
  it('returns need_more_shots below the 5-shot threshold', () => {
    const result = suggestGrind([shot(10, 25, ['balanced']), shot(11, 27)], null)
    expect(result).toEqual({ status: 'need_more_shots', shotsLogged: 2, shotsNeeded: 5 })
  })

  it('returns need_positive_reference when no shot is balanced/excellent', () => {
    const shots = [
      shot(10, 22, ['sour']),
      shot(11, 24, ['sour']),
      shot(12, 26, ['bitter']),
      shot(13, 28, ['weak']),
      shot(14, 30, ['harsh']),
    ]
    expect(suggestGrind(shots, null)).toEqual({ status: 'need_positive_reference' })
  })

  it('returns need_variation when all eligible shots share one position', () => {
    const shots = [
      shot(10, 22, ['balanced']),
      shot(10, 23),
      shot(10, 24),
      shot(10, 25),
      shot(10, 26),
    ]
    expect(suggestGrind(shots, null)).toEqual({ status: 'need_variation' })
  })

  it('returns need_variation when the fit is flat (would divide by zero)', () => {
    const shots = [
      shot(10, 25, ['balanced']),
      shot(11, 25),
      shot(12, 25),
      shot(13, 25),
      shot(14, 25),
    ]
    expect(suggestGrind(shots, null)).toEqual({ status: 'need_variation' })
  })

  it('fits OLS and inverts at target time from positive shots', () => {
    // time = 2*position + 2. Positives at position 10 (t=22) and 12 (t=26) -> targetTime 24.
    // Invert: position = (24 - 2) / 2 = 11.
    const shots = [
      shot(10, 22, ['balanced']),
      shot(11, 24),
      shot(12, 26, ['excellent']),
      shot(13, 28),
      shot(14, 30),
    ]
    const result = suggestGrind(shots, null)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.suggestedPosition).toBeCloseTo(11, 6)
    expect(result.targetTime).toBeCloseTo(24, 6)
    expect(result.display).toBe('11.0')
    expect(result.evidence).toHaveLength(5)
  })

  it('formats the suggestion as macro / micro for a micro-dial grinder', () => {
    const shots = [
      shot(10, 22, ['balanced']),
      shot(11, 24),
      shot(12, 26, ['excellent']),
      shot(13, 28),
      shot(14, 30),
    ]
    const result = suggestGrind(shots, 6)
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.display).toBe('11 / 0')
  })
})

describe('newBagBaseline', () => {
  it('returns insufficient_history below the 15-shot threshold', () => {
    const shots = Array.from({ length: 14 }, (_, i) => shot(10 + i * 0.1, 25, ['balanced']))
    expect(newBagBaseline(shots, null)).toEqual({
      status: 'insufficient_history',
      shotsLogged: 14,
      shotsNeeded: 15,
    })
  })

  it('returns insufficient_history when there are no positive shots', () => {
    const shots = Array.from({ length: 20 }, () => shot(10, 25, ['sour']))
    expect(newBagBaseline(shots, null)).toEqual({
      status: 'insufficient_history',
      shotsLogged: 20,
      shotsNeeded: 15,
    })
  })

  it('returns the median position of positive shots when eligible', () => {
    const positives = [
      shot(10, 25, ['balanced']),
      shot(12, 25, ['excellent']),
      shot(14, 25, ['balanced']),
    ]
    const filler = Array.from({ length: 12 }, () => shot(9, 30, ['sour']))
    const result = newBagBaseline([...positives, ...filler], null)
    expect(result).toEqual({ status: 'ok', position: 12, display: '12.0' })
  })
})

describe('decideDialInState', () => {
  it('uses the combo suggestion when the combo has any shots', () => {
    const combo = [shot(10, 25, ['balanced'])]
    const result = decideDialInState(combo, [], null)
    expect(result.kind).toBe('combo')
  })

  it('falls back to the new-bag baseline when the combo is empty', () => {
    const pair = Array.from({ length: 15 }, () => shot(11, 25, ['balanced']))
    const result = decideDialInState([], pair, null)
    expect(result).toEqual({
      kind: 'new_bag',
      baseline: { status: 'ok', position: 11, display: '11.0' },
    })
  })
})
