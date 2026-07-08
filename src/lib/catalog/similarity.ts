export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(s: string): string[] {
  const grams: string[] = []
  for (let i = 0; i < s.length - 1; i++) {
    grams.push(s.slice(i, i + 2))
  }
  return grams
}

/** Dice's coefficient over character bigrams. 1 = identical, 0 = nothing in common. */
export function diceCoefficient(a: string, b: string): number {
  const normA = normalizeForMatch(a)
  const normB = normalizeForMatch(b)
  if (normA === normB) return 1
  const bigramsA = bigrams(normA)
  const bigramsB = bigrams(normB)
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0

  const bMap = new Map<string, number>()
  for (const bg of bigramsB) bMap.set(bg, (bMap.get(bg) ?? 0) + 1)

  let matches = 0
  for (const bg of bigramsA) {
    const count = bMap.get(bg) ?? 0
    if (count > 0) {
      matches++
      bMap.set(bg, count - 1)
    }
  }
  return (2 * matches) / (bigramsA.length + bigramsB.length)
}
