export function computeGrindPosition(
  macro: number | null,
  micro: number | null,
  microStepsPerMacroNotch: number | null,
): number | null {
  if (macro === null) return null
  if (microStepsPerMacroNotch === null || micro === null) return macro
  return macro + micro / microStepsPerMacroNotch
}

export function formatGrindSetting(
  macro: number,
  micro: number | null,
  microStepsPerMacroNotch: number | null,
): string {
  if (microStepsPerMacroNotch === null || micro === null) return String(macro)
  return `${macro} / ${micro}`
}

export function splitGrindPosition(
  position: number,
  microStepsPerMacroNotch: number | null,
): { macro: number; micro: number | null } {
  if (microStepsPerMacroNotch === null) return { macro: position, micro: null }
  const macro = Math.round(position)
  const micro = Math.round((position - macro) * microStepsPerMacroNotch)
  return { macro, micro }
}

export type GrindFields = {
  grindMacro: number | null
  grindMicro: number | null
  grindPosition: number | null
  grindSetting: string
}

export function deriveGrindFields(input: {
  microStepsPerMacroNotch: number | null
  macroInput?: number | null
  microInput?: number | null
  textInput?: string
}): GrindFields {
  const { microStepsPerMacroNotch, macroInput, microInput, textInput } = input

  // Two-dial numeric path: a micro-configured grinder with a macro reading.
  if (microStepsPerMacroNotch !== null && macroInput != null) {
    const micro = microInput ?? 0
    return {
      grindMacro: macroInput,
      grindMicro: micro,
      grindPosition: computeGrindPosition(macroInput, micro, microStepsPerMacroNotch),
      grindSetting: formatGrindSetting(macroInput, micro, microStepsPerMacroNotch),
    }
  }

  // Single-input path: single-dial/unconfigured grinder. Numeric if it parses,
  // otherwise a free-text label that stays interpolation-ineligible.
  const text = (textInput ?? '').trim()
  const n = Number.parseFloat(text)
  if (Number.isFinite(n)) {
    return { grindMacro: n, grindMicro: null, grindPosition: n, grindSetting: text }
  }
  return { grindMacro: null, grindMicro: null, grindPosition: null, grindSetting: text }
}
