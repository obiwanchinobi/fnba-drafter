import { expect, test } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  isDefaultWeights,
  rankByValue,
  relativeWeights,
  weightedTotalZ,
  type CatWeights,
} from './catWeights.ts'
import { SCORED_CAT_IDS, type ScoredCat } from './statBasis.ts'
import type { PlayerZScores } from './zScores.ts'

function scores(
  overrides: Partial<Record<ScoredCat, number | null>> = {},
): PlayerZScores {
  const cats = {} as Record<ScoredCat, number | null>
  let total = 0
  let anyNull = false
  for (const cat of SCORED_CAT_IDS) {
    const value = Object.prototype.hasOwnProperty.call(overrides, cat)
      ? overrides[cat]!
      : 1
    cats[cat] = value
    if (value == null) anyNull = true
    else total += value
  }
  return { cats, total: anyNull ? null : total }
}

test('weightedTotalZ with all-1 weights equals total', () => {
  const z = scores({ pts: 2.5, pf: -1.25, td: 0.4 })
  expect(z.total).not.toBeNull()
  expect(weightedTotalZ(z, DEFAULT_WEIGHTS)).toBeCloseTo(z.total as number)
})

test('a 0.8 weight on pf scales that z by 0.8, positive and negative', () => {
  for (const pf of [1.5, -2.25]) {
    const z = scores({ pf })
    const weights: CatWeights = { ...DEFAULT_WEIGHTS, pf: 0.8 }
    const weighted = weightedTotalZ(z, weights)
    expect(weighted).not.toBeNull()
    expect(weighted).toBeCloseTo((z.total as number) - 0.2 * pf)
    expect(weighted).not.toBeCloseTo(z.total as number)
  }
})

test('weightedTotalZ returns null when total is null even if some cats are present', () => {
  const z = scores({ ast: 1.2, pts: null, blk: 0.5 })
  expect(z.total).toBeNull()
  expect(z.cats.ast).toBe(1.2)
  expect(z.cats.pts).toBeNull()
  expect(weightedTotalZ(z, DEFAULT_WEIGHTS)).toBeNull()
})

test('rankByValue ranks descending, skips nulls, and breaks ties by ascending id', () => {
  const values = new Map<number, number | null>([
    [2, 10],
    [1, 10],
    [3, 5],
    [4, null],
  ])
  const ranks = rankByValue(
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }],
    (id) => values.get(id) ?? null,
  )
  expect(ranks.get(1)).toBe(1)
  expect(ranks.get(2)).toBe(2)
  expect(ranks.get(3)).toBe(3)
  expect(ranks.get(4)).toBeNull()
})

test('isDefaultWeights is true for DEFAULT_WEIGHTS and false when any cat differs', () => {
  expect(isDefaultWeights(DEFAULT_WEIGHTS)).toBe(true)
  expect(isDefaultWeights({ ...DEFAULT_WEIGHTS })).toBe(true)
  expect(isDefaultWeights({ ...DEFAULT_WEIGHTS, pf: 0.8 })).toBe(false)
})

test('relativeWeights divides each weight by the mean of the scored weights', () => {
  expect(relativeWeights(DEFAULT_WEIGHTS)).toEqual(DEFAULT_WEIGHTS)

  // 18 cats at 1 and blk at 20: sum 38, mean 2.
  const weights: CatWeights = { ...DEFAULT_WEIGHTS, blk: 20 }
  const relative = relativeWeights(weights)
  expect(relative.blk).toBeCloseTo(10)
  expect(relative.pts).toBeCloseTo(0.5)
  expect(Object.keys(relative).sort()).toEqual([...SCORED_CAT_IDS].sort())
})

test('relativeWeights is unchanged by scaling every weight', () => {
  const weights: CatWeights = { ...DEFAULT_WEIGHTS, blk: 2.5, to: 0.35 }
  const scaled = {} as CatWeights
  for (const cat of SCORED_CAT_IDS) scaled[cat] = weights[cat] * 3
  const a = relativeWeights(weights)
  const b = relativeWeights(scaled)
  for (const cat of SCORED_CAT_IDS) {
    expect(a[cat]).not.toBeNull()
    expect(b[cat]).toBeCloseTo(a[cat] as number)
  }
})

test('relativeWeights returns null per cat when the mean is zero or a weight is missing', () => {
  const zero = {} as CatWeights
  for (const cat of SCORED_CAT_IDS) zero[cat] = 0
  for (const value of Object.values(relativeWeights(zero))) {
    expect(value).toBeNull()
  }

  const missing = { ...DEFAULT_WEIGHTS } as Partial<CatWeights>
  delete missing.pts
  for (const value of Object.values(relativeWeights(missing as CatWeights))) {
    expect(value).toBeNull()
  }
})
