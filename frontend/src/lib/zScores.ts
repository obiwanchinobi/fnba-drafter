/**
 * Per-category z-scores and Total Z for this league's 19 scored cats.
 * Formula: docs/context/20260912-131755-draft-night-analysis-and-requirements.md
 * sections 3.2–3.3.
 *
 * POOL_SIZE = 136 = 8 teams × 17 roster spots (IR excluded; ESPN mSettings 2026-09-21),
 * shared from ./league.ts and re-exported here for existing imports.
 * POOL_MIN_GP = 20, the games-played floor for the rostered-player pool.
 */
import type { Projection } from '../api/projections.ts'
import { POOL_SIZE } from './league.ts'
import {
  SCORED_CAT_IDS,
  SCORED_CATS,
  basisRatioParts,
  basisValue,
  toNumber,
  type Basis,
  type ScoredCat,
} from './statBasis.ts'

export { POOL_SIZE }
export const POOL_MIN_GP = 20

export type PlayerZScores = {
  cats: Record<ScoredCat, number | null>
  total: number | null
}

export type ZScoresResult = {
  scores: Map<number, PlayerZScores>
  poolSize: number
}

type PoolStats = {
  referenceRatio: Partial<Record<ScoredCat, number>>
  mean: Record<ScoredCat, number | null>
  sd: Record<ScoredCat, number | null>
}

type ComputeZOptions = {
  poolSize?: number
  poolMinGp?: number
}

export function computeZScores(
  rows: Projection[],
  basis: Basis = 'per_game',
  options: ComputeZOptions = {},
): ZScoresResult {
  const poolSize = options.poolSize ?? POOL_SIZE
  const poolMinGp = options.poolMinGp ?? POOL_MIN_GP

  const eligible = rows.filter((row) => {
    const gp = toNumber(row.gp)
    if (gp == null || gp < poolMinGp) return false
    return hasCompleteCatValues(row, basis)
  })

  let pool = eligible
  for (let i = 0; i < 10; i += 1) {
    const stats = computePoolStats(pool, basis)
    const next = topPool(eligible, stats, basis, poolSize)
    if (sameMembership(pool, next)) {
      pool = next
      break
    }
    pool = next
  }

  const stats = computePoolStats(pool, basis)
  const scores = new Map<number, PlayerZScores>()
  for (const row of rows) {
    scores.set(row.id, scoreRow(row, stats, basis))
  }

  return { scores, poolSize: pool.length }
}

function hasCompleteCatValues(row: Projection, basis: Basis): boolean {
  for (const cat of SCORED_CAT_IDS) {
    const def = SCORED_CATS[cat]
    if (def.kind === 'counting') {
      if (basisValue(row, cat, basis) == null) return false
    } else {
      const parts = basisRatioParts(row, cat, basis)
      if (parts.numerator == null || parts.denominator == null) return false
    }
  }
  return true
}

function catRawValue(
  row: Projection,
  cat: ScoredCat,
  basis: Basis,
  referenceRatio: number | undefined,
): number | null {
  const def = SCORED_CATS[cat]
  if (def.kind === 'counting') {
    return basisValue(row, cat, basis)
  }
  const parts = basisRatioParts(row, cat, basis)
  if (parts.numerator == null || parts.denominator == null) return null
  const ref = referenceRatio ?? 0
  return parts.numerator - ref * parts.denominator
}

function computePoolStats(pool: Projection[], basis: Basis): PoolStats {
  const referenceRatio: Partial<Record<ScoredCat, number>> = {}
  for (const cat of SCORED_CAT_IDS) {
    if (SCORED_CATS[cat].kind !== 'ratio') continue
    let numSum = 0
    let denSum = 0
    let any = false
    for (const row of pool) {
      const parts = basisRatioParts(row, cat, basis)
      if (parts.numerator == null || parts.denominator == null) continue
      numSum += parts.numerator
      denSum += parts.denominator
      any = true
    }
    if (any) {
      referenceRatio[cat] = denSum === 0 ? 0 : numSum / denSum
    }
  }

  const mean = {} as Record<ScoredCat, number | null>
  const sd = {} as Record<ScoredCat, number | null>
  for (const cat of SCORED_CAT_IDS) {
    const values: number[] = []
    for (const row of pool) {
      const value = catRawValue(row, cat, basis, referenceRatio[cat])
      if (value != null) values.push(value)
    }
    if (values.length === 0) {
      mean[cat] = null
      sd[cat] = null
      continue
    }
    const m = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance =
      values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length
    mean[cat] = m
    sd[cat] = Math.sqrt(variance)
  }
  return { referenceRatio, mean, sd }
}

function zFor(value: number | null, cat: ScoredCat, stats: PoolStats): number | null {
  if (value == null) return null
  const mean = stats.mean[cat]
  const sd = stats.sd[cat]
  if (mean == null || sd == null) return null
  if (sd === 0) return 0
  return SCORED_CATS[cat].inverse === true
    ? (mean - value) / sd
    : (value - mean) / sd
}

function scoreRow(row: Projection, stats: PoolStats, basis: Basis): PlayerZScores {
  const cats = {} as Record<ScoredCat, number | null>
  let total = 0
  let anyNull = false
  for (const cat of SCORED_CAT_IDS) {
    const value = catRawValue(row, cat, basis, stats.referenceRatio[cat])
    const z = zFor(value, cat, stats)
    cats[cat] = z
    if (z == null) anyNull = true
    else total += z
  }
  return { cats, total: anyNull ? null : total }
}

function topPool(
  eligible: Projection[],
  stats: PoolStats,
  basis: Basis,
  poolSize: number,
): Projection[] {
  return [...eligible]
    .map((row) => ({ row, total: scoreRow(row, stats, basis).total }))
    .sort((a, b) => {
      const aMissing = a.total == null
      const bMissing = b.total == null
      if (aMissing && bMissing) return a.row.id - b.row.id
      if (aMissing) return 1
      if (bMissing) return -1
      if (a.total !== b.total) return (b.total as number) - (a.total as number)
      return a.row.id - b.row.id
    })
    .slice(0, poolSize)
    .map((entry) => entry.row)
}

function sameMembership(a: Projection[], b: Projection[]): boolean {
  if (a.length !== b.length) return false
  const ids = new Set(a.map((row) => row.id))
  return b.every((row) => ids.has(row.id))
}
