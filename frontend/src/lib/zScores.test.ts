import { expect, test } from 'vitest'
import type { Projection } from '../api/projections.ts'
import { computeZScores } from './zScores.ts'

function row(
  id: number,
  overrides: Partial<Projection> = {},
): Projection {
  return {
    id,
    player_id: id,
    espn_player_id: id,
    first_name: 'P',
    last_name: String(id),
    full_name: `Player ${id}`,
    positions: ['C'],
    nba_team: 'DEN',
    injury_status: null,
    source: 'espn',
    season: 2027,
    gp: 80,
    min: 2400,
    fgm: 400,
    fga: 800,
    fg_pct: 0.5,
    ftm: 200,
    fta: 250,
    ft_pct: 0.8,
    tpm: 80,
    tpa: 240,
    tp_pct: 80 / 240,
    oreb: 80,
    dreb: 320,
    ast: 240,
    ato: 2,
    stl: 80,
    str: 1,
    blk: 40,
    to: 120,
    pf: 160,
    dd: 20,
    td: 4,
    pts: 1080,
    ppm: 1080 / 2400,
    imported_at: '2026-09-18T12:00:00.000Z',
    missing_stat_keys: [],
    estimated_stat_keys: [],
    espn_roto_rank: id,
    dataset: 'projection',
    prior_season: null,
    ...overrides,
  }
}

function populationZ(values: number[], x: number, inverse = false): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const sd = Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
  )
  if (sd === 0) return 0
  return inverse ? (mean - x) / sd : (x - mean) / sd
}

test('counting cat z on three rows equals (x − mean) / population sd', () => {
  const rows = [
    row(1, { blk: 80 }),
    row(2, { blk: 160 }),
    row(3, { blk: 240 }),
  ]
  const { scores } = computeZScores(rows, 'per_game')
  const values = [1, 2, 3]
  expect(scores.get(1)?.cats.blk).toBeCloseTo(populationZ(values, 1))
  expect(scores.get(2)?.cats.blk).toBeCloseTo(populationZ(values, 2))
  expect(scores.get(3)?.cats.blk).toBeCloseTo(populationZ(values, 3))
})

test('TO and PF z is reversed so fewest is highest z', () => {
  const rows = [
    row(1, { to: 80, pf: 80 }),
    row(2, { to: 160, pf: 160 }),
    row(3, { to: 240, pf: 240 }),
  ]
  const { scores } = computeZScores(rows, 'per_game')
  const values = [1, 2, 3]
  expect(scores.get(1)?.cats.to).toBeCloseTo(populationZ(values, 1, true))
  expect(scores.get(3)?.cats.to).toBeCloseTo(populationZ(values, 3, true))
  expect(scores.get(1)?.cats.to).toBeGreaterThan(scores.get(3)?.cats.to ?? 0)
  expect(scores.get(1)?.cats.pf).toBeGreaterThan(scores.get(3)?.cats.pf ?? 0)
})

test('FG% impact uses numerator − referenceRatio × denominator', () => {
  const rows = [
    row(1, { fgm: 400, fga: 800 }),
    row(2, { fgm: 640, fga: 800 }),
    row(3, { fgm: 0, fga: 0 }),
    row(4, { fgm: null, fga: null }),
  ]
  const { scores } = computeZScores(rows, 'per_game')
  const impacts = [-1.5, 1.5, 0]
  expect(scores.get(1)?.cats.fg_pct).toBeCloseTo(populationZ(impacts, -1.5))
  expect(scores.get(2)?.cats.fg_pct).toBeCloseTo(populationZ(impacts, 1.5))
  expect(scores.get(3)?.cats.fg_pct).toBeCloseTo(populationZ(impacts, 0))
  expect(scores.get(3)?.cats.fg_pct).not.toBeNull()
  expect(scores.get(4)?.cats.fg_pct).toBeNull()
})

test('sd === 0 yields z = 0, not NaN', () => {
  const rows = [row(1, { blk: 40 }), row(2, { blk: 40 })]
  const { scores } = computeZScores(rows, 'per_game')
  expect(scores.get(1)?.cats.blk).toBe(0)
  expect(scores.get(2)?.cats.blk).toBe(0)
  expect(Number.isNaN(scores.get(1)?.cats.blk)).toBe(false)
})

test('Total Z is null when any cat z is null, and the sum otherwise', () => {
  const complete = [row(1, { blk: 80 }), row(2, { blk: 160 })]
  const { scores: completeScores } = computeZScores(complete, 'per_game')
  const first = completeScores.get(1)
  expect(first?.total).not.toBeNull()
  const summed = Object.values(first?.cats ?? {}).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  )
  expect(first?.total).toBeCloseTo(summed)

  const missing = [row(1, { pts: null }), row(2)]
  const { scores: missingScores } = computeZScores(missing, 'per_game')
  expect(missingScores.get(1)?.cats.pts).toBeNull()
  expect(missingScores.get(1)?.total).toBeNull()
  expect(missingScores.get(2)?.total).not.toBeNull()
})

test('pool iteration uses the top poolSize by Total Z and still scores low-GP rows', () => {
  const rows = [
    row(1, { blk: 320 }),
    row(2, { blk: 240 }),
    row(3, { blk: 160 }),
    row(4, { blk: 80 }),
    row(5, { gp: 10, blk: 200 }),
  ]
  const { scores, poolSize } = computeZScores(rows, 'per_game', {
    poolSize: 2,
    poolMinGp: 20,
  })

  expect(poolSize).toBe(2)
  expect(scores.get(3)?.cats.blk).toBeCloseTo(-3)
  expect(scores.get(5)?.cats.blk).toBeCloseTo(33)
  expect(scores.get(5)?.total).not.toBeNull()
})

test("basis 'total' and 'per_game' give different z for equal rates and different GP", () => {
  const highGp = row(1, { gp: 80 })
  const lowGp = row(2, {
    gp: 40,
    min: 1200,
    fgm: 200,
    fga: 400,
    ftm: 100,
    fta: 125,
    tpm: 40,
    tpa: 120,
    oreb: 40,
    dreb: 160,
    ast: 120,
    stl: 40,
    blk: 20,
    to: 60,
    pf: 80,
    dd: 10,
    td: 2,
    pts: 540,
  })
  const rows = [highGp, lowGp]

  const perGameScores = computeZScores(rows, 'per_game')
  const totalScores = computeZScores(rows, 'total')

  expect(perGameScores.scores.get(1)?.cats.pts).toBe(0)
  expect(perGameScores.scores.get(2)?.cats.pts).toBe(0)
  expect(totalScores.scores.get(1)?.cats.pts).toBeCloseTo(1)
  expect(totalScores.scores.get(2)?.cats.pts).toBeCloseTo(-1)
  expect(totalScores.scores.get(1)?.cats.pts).not.toBe(
    perGameScores.scores.get(1)?.cats.pts,
  )
})
