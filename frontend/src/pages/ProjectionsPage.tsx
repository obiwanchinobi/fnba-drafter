import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
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
import { fetchWeightSets, type WeightSet } from '../api/weightSets.ts'
import ProjectionsTable, {
  type SortColumn,
  type SortDirection,
} from '../components/ProjectionsTable.tsx'
import ProjectionsToolbar, {
  type PositionFilter,
  type StatView,
} from '../components/ProjectionsToolbar.tsx'
import WeightSetDialog from '../components/WeightSetDialog.tsx'
import {
  DEFAULT_WEIGHTS,
  isDefaultWeights,
  rankByValue,
  weightedTotalZ,
} from '../lib/catWeights.ts'
import {
  basisValue,
  isScoredCat,
  perGame,
  toNumber,
  type Basis,
} from '../lib/statBasis.ts'
import {
  defaultSortDirection,
  parseProjectionsSearch,
  serializeProjectionsSearch,
  type ProjectionsUrlState,
} from '../lib/projectionsUrlState.ts'
import { computeZScores, type ZScoresResult } from '../lib/zScores.ts'

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
    weightedTotals: Map<number, number | null>
    rankDelta: Map<number, number | null>
  },
): number | string | null {
  const { view, basis, zScores, weightedTotals, rankDelta } = options
  if (column === 'z_total') {
    return zScores.scores.get(row.id)?.total ?? null
  }
  if (column === 'z_weighted') {
    return weightedTotals.get(row.id) ?? null
  }
  if (column === 'z_rank_delta') {
    return rankDelta.get(row.id) ?? null
  }
  if (view === 'z' && isScoredCat(column)) {
    return zScores.scores.get(row.id)?.cats[column] ?? null
  }
  if (isScoredCat(column)) {
    return basisValue(row, column, basis)
  }
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
      return toNumber(row.gp)
    case 'min':
      return basis === 'total' ? toNumber(row.min) : perGame(row.min, row.gp)
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

function nextSort(
  current: ProjectionsUrlState['sort'],
  column: SortColumn,
): NonNullable<ProjectionsUrlState['sort']> {
  if (current?.column === column) {
    return {
      column,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    }
  }
  return { column, direction: defaultSortDirection(column) }
}

function withoutWeightedSort(
  current: ProjectionsUrlState['sort'],
): ProjectionsUrlState['sort'] {
  if (current?.column !== 'z_weighted' && current?.column !== 'z_rank_delta') {
    return current
  }
  return { column: 'z_total', direction: 'desc' }
}

export default function ProjectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const setSearchParamsRef = useRef(setSearchParams)
  // Latest setter, so a handler that awaits still merges onto the current query.
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams
  }, [setSearchParams])
  const urlState = useMemo(
    () => parseProjectionsSearch(searchParams),
    [searchParams],
  )
  const {
    dataset,
    view,
    basis,
    weights: activeWeightSetId,
    position,
    teams,
    search,
    sort,
    heat,
  } = urlState

  function updateUrl(
    patch:
      | Partial<ProjectionsUrlState>
      | ((current: ProjectionsUrlState) => Partial<ProjectionsUrlState>),
  ) {
    setSearchParamsRef.current(
      (prev) => {
        const current = parseProjectionsSearch(prev)
        const resolved = typeof patch === 'function' ? patch(current) : patch
        // Spread the parsed query, including heat, so a partial edit cannot drop it.
        return serializeProjectionsSearch({ ...current, ...resolved })
      },
      { replace: true },
    )
  }

  const [source, setSource] = useState(DEFAULT_PROJECTION_SOURCE)
  const [rows, setRows] = useState<Projection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [refreshResult, setRefreshResult] = useState<ProjectionRefresh | null>(
    null,
  )
  const [weightSets, setWeightSets] = useState<WeightSet[]>([])
  const [weightDialog, setWeightDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
  }>({ open: false, mode: 'create' })

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)
    setRefreshResult(null)

    const projectionsPromise = loadDataset(dataset, source)
    const weightSetsPromise = fetchWeightSets()

    Promise.allSettled([projectionsPromise, weightSetsPromise])
      .then(([projectionResult, weightSetResult]) => {
        if (cancelled) return
        if (projectionResult.status === 'fulfilled') {
          setRows(projectionResult.value)
        } else {
          setRows([])
        }
        if (weightSetResult.status === 'fulfilled') {
          setWeightSets(weightSetResult.value)
        } else {
          setWeightSets([])
        }
        const reason =
          projectionResult.status === 'rejected'
            ? projectionResult.reason
            : weightSetResult.status === 'rejected'
              ? weightSetResult.reason
              : null
        if (reason) {
          setError(
            reason instanceof Error ? reason.message : 'Failed to load projections',
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

  const activeWeightSet =
    activeWeightSetId === 'default'
      ? null
      : (weightSets.find((set) => set.id === activeWeightSetId) ?? null)
  const activeWeights = activeWeightSet?.weights ?? DEFAULT_WEIGHTS
  // Unknown ids display as Default but stay in the query so a set that
  // loads later, or a shared link, is not dropped on the first paint.
  const displayedWeightSetId =
    activeWeightSet == null ? 'default' : activeWeightSetId

  const weightedTotals = useMemo(() => {
    const totals = new Map<number, number | null>()
    for (const row of rows) {
      const scores = zScores.scores.get(row.id)
      totals.set(
        row.id,
        scores == null ? null : weightedTotalZ(scores, activeWeights),
      )
    }
    return totals
  }, [rows, zScores, activeWeights])

  const defaultRanks = useMemo(
    () => rankByValue(rows, (id) => zScores.scores.get(id)?.total ?? null),
    [rows, zScores],
  )

  const weightedRanks = useMemo(
    () => rankByValue(rows, (id) => weightedTotals.get(id) ?? null),
    [rows, weightedTotals],
  )

  // Ranks use every loaded row so a position or team filter does not change Δ Rank.
  const rankDelta = useMemo(() => {
    const deltas = new Map<number, number | null>()
    for (const row of rows) {
      const defaultRank = defaultRanks.get(row.id) ?? null
      const weightedRank = weightedRanks.get(row.id) ?? null
      deltas.set(
        row.id,
        defaultRank == null || weightedRank == null
          ? null
          : defaultRank - weightedRank,
      )
    }
    return deltas
  }, [rows, defaultRanks, weightedRanks])

  const weighted =
    view === 'z' &&
    activeWeightSet != null &&
    (!isDefaultWeights(activeWeights) || activeWeightSetId !== 'default')
      ? {
          name: activeWeightSet.name,
          totals: weightedTotals,
          rankDelta,
        }
      : null

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
        getSortValue(a, sort.column, {
          view,
          basis,
          zScores,
          weightedTotals,
          rankDelta,
        }),
        getSortValue(b, sort.column, {
          view,
          basis,
          zScores,
          weightedTotals,
          rankDelta,
        }),
        sort.direction,
      )
      return cmp !== 0 ? cmp : a.id - b.id
    })
  }, [
    rows,
    search,
    position,
    teams,
    sort,
    view,
    basis,
    zScores,
    weightedTotals,
    rankDelta,
  ])

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
    updateUrl((current) => ({
      dataset: next,
      sort:
        next === 'actual'
          ? { column: 'pts', direction: 'desc' }
          : current.sort,
    }))
  }

  function handleSort(column: SortColumn) {
    updateUrl((current) => ({ sort: nextSort(current.sort, column) }))
  }

  function handleWeightSetChange(next: number | 'default') {
    updateUrl((current) => ({
      weights: next,
      sort:
        next === 'default' ? withoutWeightedSort(current.sort) : current.sort,
    }))
  }

  async function handleWeightsSaved(saved: WeightSet) {
    const list = await fetchWeightSets()
    setWeightSets(list)
    updateUrl({ weights: saved.id })
    setWeightDialog({ open: false, mode: 'create' })
  }

  async function handleWeightsDeleted() {
    const list = await fetchWeightSets()
    setWeightSets(list)
    updateUrl((current) => ({
      weights: 'default',
      sort: withoutWeightedSort(current.sort),
    }))
    setWeightDialog({ open: false, mode: 'create' })
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
          onSearchChange={(value) => updateUrl({ search: value })}
          position={position}
          onPositionChange={(value) => updateUrl({ position: value })}
          teams={teams}
          onTeamsChange={(value) => updateUrl({ teams: value })}
          extraTeams={extraTeams}
          onUpdateFromSource={handleUpdateFromSource}
          updating={updating}
          view={view}
          onViewChange={(value) => updateUrl({ view: value })}
          basis={basis}
          onBasisChange={(value) => updateUrl({ basis: value })}
          weightSets={weightSets}
          activeWeightSetId={displayedWeightSetId}
          onWeightSetChange={handleWeightSetChange}
          onCreateWeights={() =>
            setWeightDialog({ open: true, mode: 'create' })
          }
          onEditWeights={() => setWeightDialog({ open: true, mode: 'edit' })}
          heatmap={heat}
          onHeatmapChange={(on) => updateUrl({ heat: on })}
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
              weighted={weighted}
              heatmap={heat}
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
                {`Z-scores vs the top ${zScores.poolSize} rostered players (8 teams × 16 roster spots, ≥ 20 GP). TO and PF are reversed so positive is better.${
                  weighted
                    ? ` Weighted Z applies "${weighted.name}"; Total Z uses equal weights; Δ Rank is places gained under the collection.`
                    : ''
                }${
                  heat
                    ? ' Heatmap: blue is above the pool mean, red is below.'
                    : ''
                }`}
              </Typography>
            ) : null}
            {hasEstimates ? (
              <Typography variant="caption">
                Italic values are FNBA estimates. ESPN does not project OREB, DREB, PF, DD or TD.
              </Typography>
            ) : null}
          </>
        )}
        <WeightSetDialog
          open={weightDialog.open}
          mode={weightDialog.mode}
          initial={
            weightDialog.mode === 'edit'
              ? (activeWeightSet ?? undefined)
              : undefined
          }
          onClose={() => {
            setWeightDialog((current) => ({ ...current, open: false }))
          }}
          onSaved={handleWeightsSaved}
          onDeleted={handleWeightsDeleted}
        />
      </Stack>
    </Container>
  )
}
