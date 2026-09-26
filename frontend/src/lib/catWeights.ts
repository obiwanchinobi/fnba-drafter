/**
 * Category multipliers for the composite only.
 * Per-cat z and pool membership stay on unweighted computeZScores.
 */
import { SCORED_CAT_IDS, type ScoredCat } from './statBasis.ts'
import type { PlayerZScores } from './zScores.ts'

export type CatWeights = Record<ScoredCat, number>

function everyCatOne(): CatWeights {
  const weights = {} as CatWeights
  for (const cat of SCORED_CAT_IDS) weights[cat] = 1
  return weights
}

export const DEFAULT_WEIGHTS: CatWeights = everyCatOne()

export const WEIGHT_MIN = 0
export const WEIGHT_MAX = 5
export const WEIGHT_STEP = 0.05

export function isDefaultWeights(weights: CatWeights): boolean {
  return SCORED_CAT_IDS.every((cat) => weights[cat] === 1)
}

export function weightedTotalZ(
  scores: PlayerZScores,
  weights: CatWeights,
): number | null {
  if (scores.total == null) return null
  let sum = 0
  for (const cat of SCORED_CAT_IDS) {
    const z = scores.cats[cat]
    if (z == null) return null
    sum += weights[cat] * z
  }
  return sum
}

export function rankByValue(
  rows: { id: number }[],
  value: (id: number) => number | null,
): Map<number, number | null> {
  const ranked: { id: number; value: number }[] = []
  const ranks = new Map<number, number | null>()
  for (const row of rows) {
    ranks.set(row.id, null)
    const current = value(row.id)
    if (current != null) ranked.push({ id: row.id, value: current })
  }
  ranked.sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value
    return a.id - b.id
  })
  ranked.forEach((entry, index) => {
    ranks.set(entry.id, index + 1)
  })
  return ranks
}

// Each weight divided by the mean of the scored weights, so 1 means average
// emphasis and the row is unchanged by scaling every weight. Null per cat when
// a weight is missing or the mean is not positive.
export function relativeWeights(
  weights: CatWeights,
): Record<ScoredCat, number | null> {
  const relative = {} as Record<ScoredCat, number | null>
  let sum = 0
  let valid = true
  for (const cat of SCORED_CAT_IDS) {
    const value = weights[cat]
    if (typeof value !== 'number' || !Number.isFinite(value)) valid = false
    else sum += value
  }
  const mean = sum / SCORED_CAT_IDS.length
  for (const cat of SCORED_CAT_IDS) {
    relative[cat] = valid && mean > 0 ? weights[cat] / mean : null
  }
  return relative
}
