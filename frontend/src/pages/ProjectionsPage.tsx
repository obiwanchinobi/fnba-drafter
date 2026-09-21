import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  DEFAULT_PROJECTION_SEASON,
  DEFAULT_PROJECTION_SOURCE,
  fetchProjections,
  fetchSeasonStats,
  refreshProjections,
  type Dataset,
  type Projection,
  type ProjectionRefresh,
} from '../api/projections.ts'
import ProjectionsTable, {
  type SortColumn,
  type SortDirection,
} from '../components/ProjectionsTable.tsx'
import ProjectionsToolbar, {
  type PositionFilter,
  type StatView,
} from '../components/ProjectionsToolbar.tsx'
import {
  basisValue,
  isScoredCat,
  perGame,
  toNumber,
  type Basis,
} from '../lib/statBasis.ts'
import { computeZScores, type ZScoresResult } from '../lib/zScores.ts'

const ASC_FIRST_SORT_COLUMNS = new Set<SortColumn>([
  'player',
  'pos',
  'team',
  'rank',
])

type SortState = {
  column: SortColumn
  direction: SortDirection
}

function playerMatchesSearch(fullName: string, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return fullName.toLowerCase().includes(needle)
}

function playerMatchesPosition(
  positions: string[],
  position: PositionFilter,
): boolean {
  if (position === 'All') return true
  if (position === 'G') return positions.includes('PG') || positions.includes('SG')
  if (position === 'F/C') {
    return (
      positions.includes('SF') ||
      positions.includes('PF') ||
      positions.includes('C')
    )
  }
  return positions.includes(position)
}

function playerMatchesTeams(nbaTeam: string, teams: string[]): boolean {
  if (teams.length === 0) return true
  return teams.includes(nbaTeam)
}

function getSortValue(
  row: Projection,
  column: SortColumn,
  options: {
    view: StatView
    basis: Basis
    zScores: ZScoresResult
  },
): number | string | null {
  const { view, basis, zScores } = options
  if (column === 'z_total') {
    return zScores.scores.get(row.id)?.total ?? null
  }
  if (view === 'z' && isScoredCat(column)) {
    return zScores.scores.get(row.id)?.cats[column] ?? null
  }
  const gp = toNumber(row.gp)
  switch (column) {
    case 'player':
      return row.full_name
    case 'pos':
      return row.positions.join(', ')
    case 'team':
      return row.nba_team
    case 'rank':
      return row.espn_roto_rank
    case 'gp':
      return gp
    case 'min':
      return perGame(row.min, gp)
    case 'fgm':
      return basisValue(row, 'fgm', basis)
    case 'fg_pct':
      return toNumber(row.fg_pct)
    case 'ftm':
      return basisValue(row, 'ftm', basis)
    case 'ft_pct':
      return toNumber(row.ft_pct)
    case 'tpm':
      return basisValue(row, 'tpm', basis)
    case 'tp_pct':
      return toNumber(row.tp_pct)
    case 'oreb':
      return basisValue(row, 'oreb', basis)
    case 'dreb':
      return basisValue(row, 'dreb', basis)
    case 'ast':
      return basisValue(row, 'ast', basis)
    case 'ato':
      return toNumber(row.ato)
    case 'stl':
      return basisValue(row, 'stl', basis)
    case 'str':
      return toNumber(row.str)
    case 'blk':
      return basisValue(row, 'blk', basis)
    case 'to':
      return basisValue(row, 'to', basis)
    case 'pf':
      return basisValue(row, 'pf', basis)
    case 'dd':
      return basisValue(row, 'dd', basis)
    case 'td':
      return basisValue(row, 'td', basis)
    case 'pts':
      return basisValue(row, 'pts', basis)
    case 'ppm':
      return toNumber(row.ppm)
  }
}

function compareSortValues(
  a: number | string | null,
  b: number | string | null,
  direction: SortDirection,
): number {
  const aMissing = a == null || a === ''
  const bMissing = b == null || b === ''
  // Missing (NULL) sorts last in both directions so zeros and gaps stay distinct.
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  if (typeof a === 'string' || typeof b === 'string') {
    const cmp = String(a).localeCompare(String(b), undefined, {
      sensitivity: 'base',
    })
    return direction === 'asc' ? cmp : -cmp
  }
  const cmp = a - b
  return direction === 'asc' ? cmp : -cmp
}

function latestImportedAt(rows: Projection[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    if (!row.imported_at) return latest
    if (!latest || row.imported_at > latest) return row.imported_at
    return latest
  }, null)
}

function loadDataset(
  dataset: Dataset,
  source: string,
): Promise<Projection[]> {
  if (dataset === 'actual') {
    return fetchSeasonStats({
      source,
      season: DEFAULT_PROJECTION_SEASON - 1,
    })
  }
  return fetchProjections({ source, season: DEFAULT_PROJECTION_SEASON })
}

export default function ProjectionsPage() {
  const [source, setSource] = useState(DEFAULT_PROJECTION_SOURCE)
  const [dataset, setDataset] = useState<Dataset>('projection')
  const [rows, setRows] = useState<Projection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [refreshResult, setRefreshResult] = useState<ProjectionRefresh | null>(
    null,
  )
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<PositionFilter>('All')
  const [teams, setTeams] = useState<string[]>([])
  const [sort, setSort] = useState<SortState | null>(null)
  const [view, setView] = useState<StatView>('values')
  const basis: Basis = 'per_game'

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)
    setRefreshResult(null)

    loadDataset(dataset, source)
      .then((data) => {
        if (!cancelled) {
          setRows(data)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRows([])
          setError(
            err instanceof Error ? err.message : 'Failed to load projections',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [source, dataset])

  const extraTeams = useMemo(() => {
    const unique = new Set<string>()
    for (const row of rows) {
      if (row.nba_team) unique.add(row.nba_team)
    }
    return [...unique]
  }, [rows])

  const zScores = useMemo(
    () => computeZScores(rows, basis),
    [rows, basis],
  )

  const visibleRows = useMemo(() => {
    const filtered = rows.filter(
      (row) =>
        playerMatchesSearch(row.full_name, search) &&
        playerMatchesPosition(row.positions, position) &&
        playerMatchesTeams(row.nba_team, teams),
    )
    if (!sort) return filtered
    return [...filtered].sort((a, b) => {
      const cmp = compareSortValues(
        getSortValue(a, sort.column, { view, basis, zScores }),
        getSortValue(b, sort.column, { view, basis, zScores }),
        sort.direction,
      )
      return cmp !== 0 ? cmp : a.id - b.id
    })
  }, [rows, search, position, teams, sort, view, basis, zScores])

  const lastImported = latestImportedAt(rows)
  const hasEstimates =
    dataset === 'projection' &&
    rows.some((row) => (row.estimated_stat_keys ?? []).length > 0)

  async function handleUpdateFromSource() {
    setUpdating(true)
    setError(null)
    try {
      const result = await refreshProjections({
        source,
        season: DEFAULT_PROJECTION_SEASON,
      })
      setRefreshResult(result)
      const data = await loadDataset(dataset, source)
      setRows(data)
    } catch (err: unknown) {
      setRefreshResult(null)
      setError(
        err instanceof Error ? err.message : 'Failed to refresh projections',
      )
    } finally {
      setUpdating(false)
    }
  }

  function handleDatasetChange(next: Dataset) {
    setDataset(next)
    if (next === 'actual') {
      setSort({ column: 'pts', direction: 'desc' })
    }
  }

  function handleSort(column: SortColumn) {
    setSort((current) => {
      if (current?.column === column) {
        return {
          column,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      return {
        column,
        direction: ASC_FIRST_SORT_COLUMNS.has(column) ? 'asc' : 'desc',
      }
    })
  }

  return (
    <Container
      component="main"
      maxWidth={false}
      sx={{
        py: 4,
        maxWidth: 1536,
        '@media (min-width: 1920px)': { maxWidth: 'none' },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Typography variant="h4" component="h1">
            2026–27 projections
          </Typography>
          <Chip
            data-testid="dataset-chip"
            label={dataset === 'projection' ? 'Projection' : 'Actual'}
            color={dataset === 'projection' ? 'primary' : 'default'}
            size="small"
          />
        </Stack>
        <ProjectionsToolbar
          source={source}
          onSourceChange={setSource}
          dataset={dataset}
          onDatasetChange={handleDatasetChange}
          search={search}
          onSearchChange={setSearch}
          position={position}
          onPositionChange={setPosition}
          teams={teams}
          onTeamsChange={setTeams}
          extraTeams={extraTeams}
          onUpdateFromSource={handleUpdateFromSource}
          updating={updating}
          view={view}
          onViewChange={setView}
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
        {refreshResult && !error ? (
          <Typography>
            Imported {refreshResult.player_count} players. Last imported:{' '}
            {new Date(refreshResult.imported_at).toLocaleString()}
          </Typography>
        ) : lastImported ? (
          <Typography>
            Last imported: {new Date(lastImported).toLocaleString()}
          </Typography>
        ) : null}
        {loading ? (
          <Typography>Loading projections…</Typography>
        ) : (
          <>
            <ProjectionsTable
              dataset={dataset}
              rows={visibleRows}
              sortBy={sort?.column ?? null}
              sortDirection={sort?.direction ?? 'desc'}
              onSort={handleSort}
              view={view}
              basis={basis}
              zScores={zScores}
              emptyMessage={
                rows.length === 0
                  ? dataset === 'actual'
                    ? 'No actuals yet. Use Update from source.'
                    : 'No projections yet. Use Update from source.'
                  : 'No matching players.'
              }
            />
            {view === 'z' ? (
              <Typography variant="caption">
                {`Z-scores vs the top ${zScores.poolSize} rostered players (8 teams × 16 roster spots, ≥ 20 GP). TO and PF are reversed so positive is better.`}
              </Typography>
            ) : null}
            {hasEstimates ? (
              <Typography variant="caption">
                Italic values are FNBA estimates. ESPN does not project OREB, DREB, PF, DD or TD.
              </Typography>
            ) : null}
          </>
        )}
      </Stack>
    </Container>
  )
}
