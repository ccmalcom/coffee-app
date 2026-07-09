import { normalizeForMatch, diceCoefficient } from '@/lib/catalog/similarity'

// Mirrors knowledge/tasting-note-vocabulary.md (v1). The markdown is the human
// source of truth: add new phrases THERE first, then mirror them here.
export const CLUSTER_PHRASES: Record<string, string[]> = {
  fruit_candied: [
    'watermelon bubble gum', 'strawberry yogurt candy', 'mango creamsicle',
    'pink lemonade', 'tropical candy', 'fruit punch', 'bubblegum',
    'cotton candy', 'jolly rancher', 'skittles',
  ],
  fruit_fresh: [
    'strawberry', 'blueberry', 'raspberry', 'cherry', 'red apple',
    'green apple', 'pear', 'peach', 'apricot', 'plum', 'grape',
  ],
  fruit_dried_wine: [
    'raisin', 'fig', 'date', 'dried cherry', 'port wine', 'red wine',
    'tannic', 'boozy', 'fermented fruit',
  ],
  citrus: ['lemon', 'lime', 'orange', 'grapefruit', 'bergamot', 'mandarin', 'tangerine'],
  floral: ['jasmine', 'rose', 'hibiscus', 'lavender', 'orange blossom', 'chamomile', 'bergamot floral'],
  tropical: ['pineapple', 'papaya', 'passionfruit', 'guava', 'lychee', 'mango'],
  nutty_cocoa: ['almond', 'hazelnut', 'walnut', 'peanut', 'cocoa', 'dark chocolate', 'milk chocolate', 'cocoa nib'],
  sweet_dessert: ['caramel', 'brown sugar', 'molasses', 'maple syrup', 'honey', 'vanilla', 'toffee', 'marshmallow'],
  spice: ['cinnamon', 'clove', 'nutmeg', 'black pepper', 'ginger', 'allspice'],
  funky_savory: ['funky', 'barnyard', 'umami', 'olive', 'soy', 'fermented', 'cheesy', 'gamey'],
}

export const UNCATEGORIZED = 'uncategorized'

// Best-match dice score below this leaves a phrase uncategorized rather than
// forcing it into a loosely-related cluster.
const FUZZY_THRESHOLD = 0.7

// Precompute normalized phrase → cluster for exact lookup.
const exactIndex = new Map<string, string>()
for (const [cluster, phrases] of Object.entries(CLUSTER_PHRASES)) {
  for (const phrase of phrases) exactIndex.set(normalizeForMatch(phrase), cluster)
}

export function clusterForPhrase(phrase: string): string {
  const norm = normalizeForMatch(phrase)
  if (norm.length === 0) return UNCATEGORIZED

  const exact = exactIndex.get(norm)
  if (exact) return exact

  let bestCluster = UNCATEGORIZED
  let bestScore = 0
  for (const [candidate, cluster] of exactIndex) {
    const score = diceCoefficient(norm, candidate)
    if (score > bestScore) {
      bestScore = score
      bestCluster = cluster
    }
  }
  return bestScore >= FUZZY_THRESHOLD ? bestCluster : UNCATEGORIZED
}
