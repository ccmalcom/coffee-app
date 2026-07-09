import { PROFILE_VERSION, POSITIVE_RATING_THRESHOLD } from './constants'
import { clusterForPhrase, UNCATEGORIZED } from './clusters'

export type RatedCoffee = {
  rating: number // 1..5, guaranteed non-null by the caller
  tastingNotes: string[]
  process: string | null
  flavorOrigin: string | null
}

export type TasteProfileData = {
  version: number
  ratedCount: number
  clusters: { cluster: string; affinity: number; evidence: string }[]
  processes: { process: string; affinity: number; evidence: string }[]
  summary: string // the ONLY LLM-authored field; '' until prose runs (or if it fails)
}

// Rating-centered weight: 5→+2, 4→+1, 3→0, 2→-1, 1→-2. A liked coffee lifts its
// clusters/process, a disliked one pushes them down, a neutral one abstains.
function weightFor(rating: number): number {
  return rating - 3
}

export function computeProfile(ratedCoffees: RatedCoffee[]): TasteProfileData {
  const clusterAffinity = new Map<string, number>()
  const clusterLiked = new Map<string, number>()
  const clusterTotal = new Map<string, number>()
  const processAffinity = new Map<string, number>()
  const processLiked = new Map<string, number>()
  const processTotal = new Map<string, number>()

  for (const c of ratedCoffees) {
    const weight = weightFor(c.rating)
    const liked = c.rating >= POSITIVE_RATING_THRESHOLD ? 1 : 0

    // A coffee contributes once per DISTINCT cluster its notes map to, so a
    // verbose listing can't dominate. Uncategorized notes are ignored.
    const clusters = new Set<string>()
    for (const note of c.tastingNotes) {
      const cluster = clusterForPhrase(note)
      if (cluster !== UNCATEGORIZED) clusters.add(cluster)
    }
    for (const cluster of clusters) {
      clusterAffinity.set(cluster, (clusterAffinity.get(cluster) ?? 0) + weight)
      clusterTotal.set(cluster, (clusterTotal.get(cluster) ?? 0) + 1)
      clusterLiked.set(cluster, (clusterLiked.get(cluster) ?? 0) + liked)
    }

    if (c.process) {
      processAffinity.set(c.process, (processAffinity.get(c.process) ?? 0) + weight)
      processTotal.set(c.process, (processTotal.get(c.process) ?? 0) + 1)
      processLiked.set(c.process, (processLiked.get(c.process) ?? 0) + liked)
    }
  }

  const clusterPositives = [...clusterAffinity.entries()]
    .filter(([, aff]) => aff > 0)
    .sort((a, b) => b[1] - a[1])
  const maxCluster = clusterPositives[0]?.[1] ?? 1
  const clusters = clusterPositives.map(([cluster, aff]) => ({
    cluster,
    affinity: Math.round((aff / maxCluster) * 100) / 100,
    evidence: `${clusterLiked.get(cluster) ?? 0} of ${clusterTotal.get(cluster) ?? 0} ${cluster.replace(/_/g, '-')} coffees rated ${POSITIVE_RATING_THRESHOLD}★+`,
  }))

  const processPositives = [...processAffinity.entries()]
    .filter(([, aff]) => aff > 0)
    .sort((a, b) => b[1] - a[1])
  const maxProcess = processPositives[0]?.[1] ?? 1
  const processes = processPositives.map(([process, aff]) => ({
    process,
    affinity: Math.round((aff / maxProcess) * 100) / 100,
    evidence: `rated ${processLiked.get(process) ?? 0} of ${processTotal.get(process) ?? 0} ${process} coffees ${POSITIVE_RATING_THRESHOLD}★+`,
  }))

  return {
    version: PROFILE_VERSION,
    ratedCount: ratedCoffees.length,
    clusters,
    processes,
    summary: '',
  }
}
