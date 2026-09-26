import type { Projection } from '../api/projections.ts'

export type Basis = 'per_game' | 'total'

export const SCORED_CAT_IDS = [
  'fgm',
  'fg_pct',
  'ftm',
  'ft_pct',
  'tpm',
  'tp_pct',
  'oreb',
  'dreb',
  'ast',
  'ato',
  'stl',
  'str',
  'blk',
  'to',
  'pf',
  'dd',
  'td',
  'pts',
  'ppm',
] as const

export type ScoredCat = (typeof SCORED_CAT_IDS)[number]

export const SCORED_CAT_LABELS: Record<ScoredCat, string> = {
  fgm: 'FGM',
  fg_pct: 'FG%',
  ftm: 'FTM',
  ft_pct: 'FT%',
  tpm: '3PM',
  tp_pct: '3P%',
  oreb: 'OREB',
  dreb: 'DREB',
  ast: 'AST',
  ato: 'A/TO',
  stl: 'STL',
  str: 'STR',
  blk: 'BLK',
  to: 'TO',
  pf: 'PF',
  dd: 'DD',
  td: 'TD',
  pts: 'PTS',
  ppm: 'PPM',
}

type NumericField = {
  [K in keyof Projection]: Projection[K] extends number | null ? K : never
}[keyof Projection]

export type ScoredCatDef =
  | {
      kind: 'counting'
      inverse?: boolean
      numerator: NumericField
    }
  | {
      kind: 'ratio'
      inverse?: boolean
      numerator: NumericField
      denominator: NumericField
    }

export const SCORED_CATS: Record<ScoredCat, ScoredCatDef> = {
  fgm: { kind: 'counting', numerator: 'fgm' },
  fg_pct: { kind: 'ratio', numerator: 'fgm', denominator: 'fga' },
  ftm: { kind: 'counting', numerator: 'ftm' },
  ft_pct: { kind: 'ratio', numerator: 'ftm', denominator: 'fta' },
  tpm: { kind: 'counting', numerator: 'tpm' },
  tp_pct: { kind: 'ratio', numerator: 'tpm', denominator: 'tpa' },
  oreb: { kind: 'counting', numerator: 'oreb' },
  dreb: { kind: 'counting', numerator: 'dreb' },
  ast: { kind: 'counting', numerator: 'ast' },
  ato: { kind: 'ratio', numerator: 'ast', denominator: 'to' },
  stl: { kind: 'counting', numerator: 'stl' },
  str: { kind: 'ratio', numerator: 'stl', denominator: 'to' },
  blk: { kind: 'counting', numerator: 'blk' },
  to: { kind: 'counting', inverse: true, numerator: 'to' },
  pf: { kind: 'counting', inverse: true, numerator: 'pf' },
  dd: { kind: 'counting', numerator: 'dd' },
  td: { kind: 'counting', numerator: 'td' },
  pts: { kind: 'counting', numerator: 'pts' },
  ppm: { kind: 'ratio', numerator: 'pts', denominator: 'min' },
}

export function isScoredCat(id: string): id is ScoredCat {
  return Object.prototype.hasOwnProperty.call(SCORED_CATS, id)
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function perGame(
  total: number | string | null | undefined,
  gp: number | string | null | undefined,
): number | null {
  const value = toNumber(total)
  const games = toNumber(gp)
  if (value == null || games == null || games === 0) return null
  return value / games
}

export type RatioParts = {
  numerator: number | null
  denominator: number | null
}

export function basisValue(
  row: Projection,
  cat: ScoredCat,
  basis: Basis,
): number | null {
  const def = SCORED_CATS[cat]
  if (def.kind === 'counting') {
    const total = toNumber(row[def.numerator])
    return basis === 'total' ? total : perGame(total, row.gp)
  }
  const parts = basisRatioParts(row, cat, basis)
  if (parts.numerator == null || parts.denominator == null) return null
  if (parts.denominator === 0) return null
  return parts.numerator / parts.denominator
}

export function basisRatioParts(
  row: Projection,
  cat: ScoredCat,
  basis: Basis,
): RatioParts {
  const def = SCORED_CATS[cat]
  if (def.kind !== 'ratio') {
    return { numerator: null, denominator: null }
  }
  const numerator = toNumber(row[def.numerator])
  const denominator = toNumber(row[def.denominator])
  if (basis === 'total') {
    return { numerator, denominator }
  }
  return {
    numerator: perGame(numerator, row.gp),
    denominator: perGame(denominator, row.gp),
  }
}
