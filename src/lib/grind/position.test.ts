import { describe, it, expect } from 'vitest'
import {
  computeGrindPosition,
  formatGrindSetting,
  splitGrindPosition,
  deriveGrindFields,
} from './position'

describe('computeGrindPosition', () => {
  it('folds micro into macro via steps-per-notch', () => {
    expect(computeGrindPosition(12, -2, 6)).toBeCloseTo(12 - 2 / 6, 10)
  })
  it('passes macro through when there is no micro dial', () => {
    expect(computeGrindPosition(12, null, null)).toBe(12)
  })
  it('passes macro through when micro is null even if steps are set', () => {
    expect(computeGrindPosition(12, null, 6)).toBe(12)
  })
  it('returns null for a non-numeric (null macro) setting', () => {
    expect(computeGrindPosition(null, null, 6)).toBeNull()
  })
})

describe('formatGrindSetting', () => {
  it('renders "macro / micro" when the grinder has a micro dial', () => {
    expect(formatGrindSetting(12.3, -2, 6)).toBe('12.3 / -2')
  })
  it('renders a plain number for single-dial grinders', () => {
    expect(formatGrindSetting(12, null, null)).toBe('12')
  })
})

describe('splitGrindPosition', () => {
  it('splits a scalar into nearest macro notch and signed micro', () => {
    expect(splitGrindPosition(11.7, 6)).toEqual({ macro: 12, micro: -2 })
  })
  it('returns the raw position as macro for single-dial grinders', () => {
    expect(splitGrindPosition(11.73, null)).toEqual({ macro: 11.73, micro: null })
  })
})

describe('deriveGrindFields', () => {
  it('two-dial numeric path computes position and display', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: 6, macroInput: 12, microInput: -2 }),
    ).toEqual({
      grindMacro: 12,
      grindMicro: -2,
      grindPosition: 12 - 2 / 6,
      grindSetting: '12 / -2',
    })
  })
  it('single-dial numeric text path sets macro = position, micro null', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: null, textInput: '12.5' }),
    ).toEqual({
      grindMacro: 12.5,
      grindMicro: null,
      grindPosition: 12.5,
      grindSetting: '12.5',
    })
  })
  it('non-numeric text path leaves all numeric columns null but keeps the label', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: null, textInput: 'medium-fine' }),
    ).toEqual({
      grindMacro: null,
      grindMicro: null,
      grindPosition: null,
      grindSetting: 'medium-fine',
    })
  })
  it('defaults a missing micro input to 0 on the two-dial path', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: 6, macroInput: 10 }),
    ).toEqual({
      grindMacro: 10,
      grindMicro: 0,
      grindPosition: 10,
      grindSetting: '10 / 0',
    })
  })
})
