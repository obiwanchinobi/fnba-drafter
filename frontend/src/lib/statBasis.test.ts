import { expect, test } from 'vitest'
import type { Projection } from '../api/projections.ts'
import { basisRatioParts, basisValue, perGame, toNumber } from './statBasis.ts'

function row(overrides: Partial<Projection> = {}): Projection {
  return {
    id: 1,
    player_id: 1,
    espn_player_id: 1,
    first_name: 'Nikola',
    last_name: 'Jokic',
    full_name: 'Nikola Jokic',
    positions: ['C'],
    nba_team: 'DEN',
    injury_status: null,
    source: 'espn',
    season: 2027,
    gp: 82,
    min: 2870,
    fgm: 820,
    fga: 1400,
    fg_pct: 820 / 1400,
    ftm: 410,
    fta: 500,
    ft_pct: 410 / 500,
    tpm: 164,
    tpa: 410,
    tp_pct: 164 / 410,
    oreb: 160,
    dreb: 640,
    ast: 820,
    ato: 820 / 246,
    stl: 123,
    str: 123 / 246,
    blk: 64,
    to: 246,
    pf: 200,
    dd: 40,
    td: 5,
    pts: 2050,
    ppm: 2050 / 2870,
    imported_at: '2026-09-18T12:00:00.000Z',
    missing_stat_keys: [],
    estimated_stat_keys: [],
    espn_roto_rank: 1,
    dataset: 'projection',
    prior_season: null,
    ...overrides,
  }
}

test('toNumber parses finite numbers and rejects empty or non-numeric values', () => {
  expect(toNumber(12.5)).toBe(12.5)
  expect(toNumber('8')).toBe(8)
  expect(toNumber(null)).toBeNull()
  expect(toNumber(undefined)).toBeNull()
  expect(toNumber('')).toBeNull()
  expect(toNumber('nope')).toBeNull()
})

test('perGame divides a counting total by GP', () => {
  expect(perGame(2050, 82)).toBeCloseTo(2050 / 82)
  expect(perGame(0, 82)).toBe(0)
})

test('counting cat per-game is total / gp and total is the raw total', () => {
  const jokic = row({ pts: 2050, gp: 82 })
  expect(basisValue(jokic, 'pts', 'per_game')).toBeCloseTo(2050 / 82)
  expect(basisValue(jokic, 'pts', 'total')).toBe(2050)
})

test('null GP yields null per-game but a non-null total', () => {
  const jokic = row({ pts: 2050, gp: null })
  expect(basisValue(jokic, 'pts', 'per_game')).toBeNull()
  expect(basisValue(jokic, 'pts', 'total')).toBe(2050)
})

test('zero GP yields null per-game but a non-null total', () => {
  const jokic = row({ pts: 2050, gp: 0 })
  expect(basisValue(jokic, 'pts', 'per_game')).toBeNull()
  expect(basisValue(jokic, 'pts', 'total')).toBe(2050)
})

test('ratio parts use numerator and denominator on the active basis', () => {
  const jokic = row({ fgm: 820, fga: 1400, gp: 82 })

  expect(basisRatioParts(jokic, 'fg_pct', 'total')).toEqual({
    numerator: 820,
    denominator: 1400,
  })
  expect(basisRatioParts(jokic, 'fg_pct', 'per_game')).toEqual({
    numerator: 820 / 82,
    denominator: 1400 / 82,
  })

  expect(basisRatioParts(jokic, 'ato', 'total')).toEqual({
    numerator: 820,
    denominator: 246,
  })
  expect(basisRatioParts(jokic, 'str', 'total')).toEqual({
    numerator: 123,
    denominator: 246,
  })
  expect(basisRatioParts(jokic, 'ppm', 'total')).toEqual({
    numerator: 2050,
    denominator: 2870,
  })
})

test('ratio parts are null per-game when GP is null, and still present as totals', () => {
  const jokic = row({ gp: null, fgm: 820, fga: 1400 })
  expect(basisRatioParts(jokic, 'fg_pct', 'per_game')).toEqual({
    numerator: null,
    denominator: null,
  })
  expect(basisRatioParts(jokic, 'fg_pct', 'total')).toEqual({
    numerator: 820,
    denominator: 1400,
  })
})
