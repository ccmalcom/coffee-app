import {
  MIN_SHOTS_FOR_SUGGESTION,
  MIN_SHOTS_FOR_NEW_BAG_BASELINE,
  POSITIVE_OUTCOME_TAGS,
} from './constants'
import { splitGrindPosition } from './position'

export type ShotForSuggestion = {
  grindPosition: number
  timeSeconds: number
  outcomeTags: readonly string[]
}

export type GrindSuggestion =
  | {
      status: 'ok'
      suggestedPosition: number
      display: string
      targetTime: number
      evidence: ShotForSuggestion[]
    }
  | { status: 'need_more_shots'; shotsLogged: number; shotsNeeded: number }
  | { status: 'need_positive_reference' }
  | { status: 'need_variation' }

export type NewBagBaseline =
  | { status: 'ok'; position: number; display: string }
  | { status: 'insufficient_history'; shotsLogged: number; shotsNeeded: number }

export type DialInState =
  | { kind: 'combo'; suggestion: GrindSuggestion }
  | { kind: 'new_bag'; baseline: NewBagBaseline }

const POSITIVE: readonly string[] = POSITIVE_OUTCOME_TAGS

function isPositive(tags: readonly string[]): boolean {
  return tags.some((t) => POSITIVE.includes(t))
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function displayFor(position: number, microStepsPerMacroNotch: number | null): string {
  const { macro, micro } = splitGrindPosition(position, microStepsPerMacroNotch)
  return micro === null ? macro.toFixed(1) : `${macro} / ${micro}`
}

export function suggestGrind(
  shots: ShotForSuggestion[],
  microStepsPerMacroNotch: number | null,
): GrindSuggestion {
  if (shots.length < MIN_SHOTS_FOR_SUGGESTION) {
    return {
      status: 'need_more_shots',
      shotsLogged: shots.length,
      shotsNeeded: MIN_SHOTS_FOR_SUGGESTION,
    }
  }

  const positives = shots.filter((s) => isPositive(s.outcomeTags))
  if (positives.length === 0) return { status: 'need_positive_reference' }

  const distinct = new Set(shots.map((s) => s.grindPosition))
  if (distinct.size < 2) return { status: 'need_variation' }

  // Ordinary least squares: timeSeconds ~ grindPosition.
  const xs = shots.map((s) => s.grindPosition)
  const ys = shots.map((s) => s.timeSeconds)
  const xBar = mean(xs)
  const yBar = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < shots.length; i++) {
    num += (xs[i] - xBar) * (ys[i] - yBar)
    den += (xs[i] - xBar) ** 2
  }
  const slope = num / den
  const intercept = yBar - slope * xBar

  const targetTime = mean(positives.map((s) => s.timeSeconds))
  const suggestedPosition = (targetTime - intercept) / slope

  // A flat fit (slope 0) makes the inversion non-finite even with ≥2 distinct
  // positions — treat it as "need more varied data" rather than leaking NaN.
  if (!Number.isFinite(suggestedPosition)) return { status: 'need_variation' }

  return {
    status: 'ok',
    suggestedPosition,
    display: displayFor(suggestedPosition, microStepsPerMacroNotch),
    targetTime,
    evidence: shots,
  }
}

export function newBagBaseline(
  shots: ShotForSuggestion[],
  microStepsPerMacroNotch: number | null,
): NewBagBaseline {
  if (shots.length < MIN_SHOTS_FOR_NEW_BAG_BASELINE) {
    return {
      status: 'insufficient_history',
      shotsLogged: shots.length,
      shotsNeeded: MIN_SHOTS_FOR_NEW_BAG_BASELINE,
    }
  }
  const positives = shots.filter((s) => isPositive(s.outcomeTags))
  if (positives.length === 0) {
    return {
      status: 'insufficient_history',
      shotsLogged: shots.length,
      shotsNeeded: MIN_SHOTS_FOR_NEW_BAG_BASELINE,
    }
  }
  const position = median(positives.map((s) => s.grindPosition))
  return { status: 'ok', position, display: displayFor(position, microStepsPerMacroNotch) }
}

export function decideDialInState(
  comboShots: ShotForSuggestion[],
  pairShots: ShotForSuggestion[],
  microStepsPerMacroNotch: number | null,
): DialInState {
  if (comboShots.length > 0) {
    return { kind: 'combo', suggestion: suggestGrind(comboShots, microStepsPerMacroNotch) }
  }
  return { kind: 'new_bag', baseline: newBagBaseline(pairShots, microStepsPerMacroNotch) }
}
