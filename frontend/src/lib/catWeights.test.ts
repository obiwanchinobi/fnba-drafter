import { expect, test } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  isDefaultWeights,
  rankByValue,
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
