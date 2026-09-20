import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  DEFAULT_PROJECTION_SEASON,
  DEFAULT_PROJECTION_SOURCE,
  fetchProjections,
  refreshProjections,
  type Projection,
  type ProjectionRefresh,
} from '../api/projections.ts'
import ProjectionsTable, {
  type SortColumn,
  type SortDirection,
} from '../components/ProjectionsTable.tsx'
import ProjectionsToolbar, {
  type PositionFilter,
} from '../components/ProjectionsToolbar.tsx'

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

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function perGame(
  total: number | string | null | undefined,
  gp: number | string | null | undefined,
): number | null {
  const value = toNumber(total)
  const games = toNumber(gp)
  if (value == null || games == null || games === 0) return null
  return value / games
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
): number | string | null {
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
      return perGame(row.fgm, gp)
    case 'fg_pct':
      return toNumber(row.fg_pct)
    case 'ftm':
      return perGame(row.ftm, gp)
    case 'ft_pct':
      return toNumber(row.ft_pct)
    case 'tpm':
      return perGame(row.tpm, gp)
    case 'tp_pct':
      return toNumber(row.tp_pct)
    case 'oreb':
      return perGame(row.oreb, gp)
    case 'dreb':
      return perGame(row.dreb, gp)
    case 'ast':
      return perGame(row.ast, gp)
    case 'ato':
      return toNumber(row.ato)
    case 'stl':
      return perGame(row.stl, gp)
    case 'str':
      return toNumber(row.str)
    case 'blk':
      return perGame(row.blk, gp)
    case 'to':
      return perGame(row.to, gp)
    case 'pf':
      return perGame(row.pf, gp)
    case 'dd':
      return perGame(row.dd, gp)
    case 'td':
      return perGame(row.td, gp)
    case 'pts':
      return perGame(row.pts, gp)
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

export default function ProjectionsPage() {
  const [source, setSource] = useState(DEFAULT_PROJECTION_SOURCE)
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

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)
    setRefreshResult(null)

    fetchProjections({ source, season: DEFAULT_PROJECTION_SEASON })
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
  }, [source])

  const extraTeams = useMemo(() => {
    const unique = new Set<string>()
    for (const row of rows) {
      if (row.nba_team) unique.add(row.nba_team)
    }
    return [...unique]
  }, [rows])

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
        getSortValue(a, sort.column),
        getSortValue(b, sort.column),
        sort.direction,
      )
      return cmp !== 0 ? cmp : a.id - b.id
    })
  }, [rows, search, position, teams, sort])

  const lastImported = latestImportedAt(rows)
  const hasEstimates = rows.some(
    (row) => (row.estimated_stat_keys ?? []).length > 0,
  )

  async function handleUpdateFromSource() {
    setUpdating(true)
    setError(null)
    try {
      const result = await refreshProjections({
        source,
        season: DEFAULT_PROJECTION_SEASON,
      })
      setRefreshResult(result)
      const data = await fetchProjections({
        source,
        season: DEFAULT_PROJECTION_SEASON,
      })
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
        <Typography variant="h4" component="h1">
          2026–27 projections
        </Typography>
        <ProjectionsToolbar
          source={source}
          onSourceChange={setSource}
          search={search}
          onSearchChange={setSearch}
          position={position}
          onPositionChange={setPosition}
          teams={teams}
          onTeamsChange={setTeams}
          extraTeams={extraTeams}
          onUpdateFromSource={handleUpdateFromSource}
          updating={updating}
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
              rows={visibleRows}
              sortBy={sort?.column ?? null}
              sortDirection={sort?.direction ?? 'desc'}
              onSort={handleSort}
              emptyMessage={
                rows.length === 0
                  ? 'No projections yet. Use Update from source.'
                  : 'No matching players.'
              }
            />
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
