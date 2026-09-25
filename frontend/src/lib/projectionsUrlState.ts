import { DATASET_OPTIONS, type Dataset } from '../api/projections.ts'
import type { SortColumn, SortDirection } from '../components/ProjectionsTable.tsx'
import {
  POSITION_FILTERS,
  type PositionFilter,
  type StatView,
} from '../components/ProjectionsToolbar.tsx'
import type { Basis } from '../lib/statBasis.ts'

export type ProjectionsUrlState = {
  dataset: Dataset
  view: StatView
  basis: Basis
  weights: number | 'default'
  position: PositionFilter
  teams: string[]
  search: string
  sort: { column: SortColumn; direction: SortDirection } | null
  heat: boolean
}

// Name, position, team, and ESPN rank ascend on the first click.
// Counting stats and z columns descend.
const ASC_FIRST_SORT_COLUMNS = new Set<SortColumn>([
  'player',
  'pos',
  'team',
  'rank',
])

const SORT_COLUMNS: Record<SortColumn, true> = {
  player: true,
  pos: true,
  team: true,
  rank: true,
  gp: true,
  min: true,
  fgm: true,
  fg_pct: true,
  ftm: true,
  ft_pct: true,
  tpm: true,
  tp_pct: true,
  oreb: true,
  dreb: true,
  ast: true,
  ato: true,
  stl: true,
  str: true,
  blk: true,
  to: true,
  pf: true,
  dd: true,
  td: true,
  pts: true,
  ppm: true,
  z_total: true,
  z_weighted: true,
  z_rank_delta: true,
}

const VIEWS: Record<StatView, true> = {
  values: true,
  z: true,
}

const BASES: Record<Basis, true> = {
  per_game: true,
  total: true,
}

export function defaultSortDirection(column: SortColumn): SortDirection {
  return ASC_FIRST_SORT_COLUMNS.has(column) ? 'asc' : 'desc'
}

function isSortColumn(value: string): value is SortColumn {
  return Object.hasOwn(SORT_COLUMNS, value)
}

function isStatView(value: string): value is StatView {
  return Object.hasOwn(VIEWS, value)
}

function isBasis(value: string): value is Basis {
  return Object.hasOwn(BASES, value)
}

function isPositionFilter(value: string): value is PositionFilter {
  for (const position of POSITION_FILTERS) {
    if (position === value) return true
  }
  return false
}

function parseDataset(value: string | null): Dataset {
  const match = DATASET_OPTIONS.find((option) => option.value === value)
  return match ? match.value : 'projection'
}

function parseWeights(value: string | null): number | 'default' {
  if (value == null || value === '' || value === 'default') return 'default'
  if (!/^[1-9]\d*$/.test(value)) return 'default'
  const id = Number(value)
  if (!Number.isSafeInteger(id)) return 'default'
  return id
}

function parseTeams(value: string | null): string[] {
  if (value == null || value === '') return []
  return value
    .split(',')
    .map((team) => team.trim())
    .filter((team) => team !== '')
}

function parseSort(params: URLSearchParams): ProjectionsUrlState['sort'] {
  const column = params.get('sort')
  if (column == null || !isSortColumn(column)) return null
  const dir = params.get('dir')
  const direction =
    dir === 'asc' || dir === 'desc' ? dir : defaultSortDirection(column)
  return { column, direction }
}

export function parseProjectionsSearch(
  params: URLSearchParams,
): ProjectionsUrlState {
  const viewParam = params.get('view')
  const basisParam = params.get('basis')
  const positionParam = params.get('pos')
  return {
    dataset: parseDataset(params.get('dataset')),
    view: viewParam != null && isStatView(viewParam) ? viewParam : 'values',
    basis: basisParam != null && isBasis(basisParam) ? basisParam : 'per_game',
    weights: parseWeights(params.get('weights')),
    position:
      positionParam != null && isPositionFilter(positionParam)
        ? positionParam
        : 'All',
    teams: parseTeams(params.get('teams')),
    search: params.get('q') ?? '',
    sort: parseSort(params),
    heat: params.get('heat') === '1',
  }
}

export function serializeProjectionsSearch(
  state: ProjectionsUrlState,
): URLSearchParams {
  const params = new URLSearchParams()
  if (state.dataset !== 'projection') params.set('dataset', state.dataset)
  if (state.view !== 'values') params.set('view', state.view)
  if (state.basis !== 'per_game') params.set('basis', state.basis)
  if (state.weights !== 'default') params.set('weights', String(state.weights))
  if (state.position !== 'All') params.set('pos', state.position)
  if (state.teams.length > 0) params.set('teams', state.teams.join(','))
  if (state.search !== '') params.set('q', state.search)
  if (state.sort) {
    params.set('sort', state.sort.column)
    if (state.sort.direction !== defaultSortDirection(state.sort.column)) {
      params.set('dir', state.sort.direction)
    }
  }
  if (state.heat) params.set('heat', '1')
  return params
}
