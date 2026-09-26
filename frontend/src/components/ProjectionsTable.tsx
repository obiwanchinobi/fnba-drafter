import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import Paper from '@mui/material/Paper'
import SvgIcon from '@mui/material/SvgIcon'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, type ComponentProps } from 'react'
import type { DraftPick } from '../api/draft.ts'
import {
  DEFAULT_PROJECTION_SEASON,
  type Dataset,
  type Projection,
} from '../api/projections.ts'
import {
  CAT_Z_CAP,
  TOTAL_Z_CAP,
  heatBackground,
} from '../lib/heatmap.ts'
import {
  basisRatioParts,
  basisValue,
  isScoredCat,
  perGame,
  toNumber,
  type Basis,
  type ScoredCat,
} from '../lib/statBasis.ts'
import type { ZScoresResult } from '../lib/zScores.ts'
import type { StatView } from './ProjectionsToolbar.tsx'

export type SortDirection = 'asc' | 'desc'

export type SortColumn =
  | 'player'
  | 'pos'
  | 'team'
  | 'rank'
  | 'gp'
  | 'min'
  | 'fgm'
  | 'fg_pct'
  | 'ftm'
  | 'ft_pct'
  | 'tpm'
  | 'tp_pct'
  | 'oreb'
  | 'dreb'
  | 'ast'
  | 'ato'
  | 'stl'
  | 'str'
  | 'blk'
  | 'to'
  | 'pf'
  | 'dd'
  | 'td'
  | 'pts'
  | 'ppm'
  | 'z_total'
  | 'z_weighted'
  | 'z_rank_delta'

type WeightedColumns = {
  name: string
  totals: Map<number, number | null>
  rankDelta: Map<number, number | null>
}

type Column = {
  id: string
  label: string
  zLabel?: string
  sortColumn?: SortColumn
  sticky?: 'player' | 'pos' | 'team'
  numeric?: boolean
  zOnly?: boolean
  weightedOnly?: boolean
}

const COLUMNS: Column[] = [
  { id: 'player', label: 'Player', sortColumn: 'player', sticky: 'player' },
  { id: 'pos', label: 'Pos', sortColumn: 'pos', sticky: 'pos' },
  { id: 'team', label: 'Team', sortColumn: 'team', sticky: 'team' },
  { id: 'rank', label: 'ESPN Rank', sortColumn: 'rank', numeric: true },
  { id: 'z_total', label: 'Total Z', sortColumn: 'z_total', numeric: true, zOnly: true },
  {
    id: 'z_weighted',
    label: 'Weighted Z',
    sortColumn: 'z_weighted',
    numeric: true,
    zOnly: true,
    weightedOnly: true,
  },
  {
    id: 'z_rank_delta',
    label: 'Δ Rank',
    sortColumn: 'z_rank_delta',
    numeric: true,
    zOnly: true,
    weightedOnly: true,
  },
  { id: 'gp', label: 'GP', sortColumn: 'gp', numeric: true },
  { id: 'min', label: 'MIN', sortColumn: 'min', numeric: true },
  { id: 'fgm', label: 'FGM/FGA', zLabel: 'FGM', sortColumn: 'fgm', numeric: true },
  { id: 'fg_pct', label: 'FG%', sortColumn: 'fg_pct', numeric: true },
  { id: 'ftm', label: 'FTM/FTA', zLabel: 'FTM', sortColumn: 'ftm', numeric: true },
  { id: 'ft_pct', label: 'FT%', sortColumn: 'ft_pct', numeric: true },
  { id: 'tpm', label: '3PM/3PA', zLabel: '3PM', sortColumn: 'tpm', numeric: true },
  { id: 'tp_pct', label: '3P%', sortColumn: 'tp_pct', numeric: true },
  { id: 'oreb', label: 'OREB', sortColumn: 'oreb', numeric: true },
  { id: 'dreb', label: 'DREB', sortColumn: 'dreb', numeric: true },
  { id: 'ast', label: 'AST', sortColumn: 'ast', numeric: true },
  { id: 'ato', label: 'A/TO', sortColumn: 'ato', numeric: true },
  { id: 'stl', label: 'STL', sortColumn: 'stl', numeric: true },
  { id: 'str', label: 'STR', sortColumn: 'str', numeric: true },
  { id: 'blk', label: 'BLK', sortColumn: 'blk', numeric: true },
  { id: 'to', label: 'TO', sortColumn: 'to', numeric: true },
  { id: 'pf', label: 'PF', sortColumn: 'pf', numeric: true },
  { id: 'dd', label: 'DD', sortColumn: 'dd', numeric: true },
  { id: 'td', label: 'TD', sortColumn: 'td', numeric: true },
  { id: 'pts', label: 'PTS', sortColumn: 'pts', numeric: true },
  { id: 'ppm', label: 'PPM', sortColumn: 'ppm', numeric: true },
]

// Draft night only: slots in after Team when a drafted map is supplied.
const DRAFTED_COLUMN: Column = { id: 'drafted', label: 'Drafted' }

function draftedLabel(
  row: Projection,
  drafted: Map<number, DraftPick> | null,
): string {
  const pick = drafted?.get(row.player_id)
  return pick ? `#${pick.overall_pick} ${pick.team}` : ''
}

const STICKY_LEFT = { player: 0, pos: 168, team: 240 } as const
const STICKY_MIN_WIDTH = { player: 168, pos: 72, team: 64 } as const

export const ROW_HEIGHT = 33
export const Z_ROW_HEIGHT = 48

// virtual-core's default rect read is offsetHeight, which is 0 without layout.
function observeContainerRect(
  instance: Virtualizer<HTMLDivElement, Element>,
  onChange: (rect: { width: number; height: number }) => void,
) {
  const element = instance.scrollElement
  if (!element) return
  const targetWindow = instance.targetWindow
  if (!targetWindow) return

  const publish = (rect: { width: number; height: number }) => {
    onChange({
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    })
  }

  publish(element.getBoundingClientRect())

  if (typeof targetWindow.ResizeObserver !== 'function') {
    return () => {}
  }

  const observer = new targetWindow.ResizeObserver((entries) => {
    const apply = () => {
      const box = entries[0]?.borderBoxSize?.[0]
      if (box) {
        publish({ width: box.inlineSize, height: box.blockSize })
        return
      }
      publish(element.getBoundingClientRect())
    }
    if (instance.options.useAnimationFrameWithResizeObserver) {
      targetWindow.requestAnimationFrame(apply)
    } else {
      apply()
    }
  })

  observer.observe(element)
  return () => {
    observer.unobserve(element)
  }
}

function formatStat(value: number | null, digits = 1): string {
  if (value == null) return '—'
  return value.toFixed(digits)
}

function formatZ(value: number | null): string {
  if (value == null) return '—'
  const formatted = value.toFixed(2)
  return value >= 0 ? `+${formatted}` : formatted
}

function formatRankDelta(value: number | null): string {
  if (value == null) return '—'
  if (value > 0) return `+${value}`
  return String(value)
}

function columnLabel(column: Column, view: StatView): string {
  if (view === 'z' && column.zLabel) return column.zLabel
  return column.label
}

function countingDigits(
  row: Projection,
  columnId: string,
  basis: Basis,
): number {
  if (basis !== 'total') return 1
  return (row.estimated_stat_keys ?? []).includes(columnId) ? 1 : 0
}

function formatMadeAttempted(
  row: Projection,
  cat: 'fg_pct' | 'ft_pct' | 'tp_pct',
  madeColumnId: string,
  basis: Basis,
): string {
  const { numerator, denominator } = basisRatioParts(row, cat, basis)
  if (numerator == null && denominator == null) return '—'
  const digits = countingDigits(row, madeColumnId, basis)
  return `${formatStat(numerator, digits)}/${formatStat(denominator, digits)}`
}

function formatCounting(row: Projection, cat: ScoredCat, basis: Basis): string {
  return formatStat(basisValue(row, cat, basis), countingDigits(row, cat, basis))
}

function stickySx(column: 'player' | 'pos' | 'team', isHeader: boolean) {
  return {
    position: 'sticky' as const,
    left: STICKY_LEFT[column],
    minWidth: STICKY_MIN_WIDTH[column],
    zIndex: isHeader ? 3 : 2,
    backgroundColor: 'background.paper',
  }
}

function cellSx(column: Column, isHeader: boolean) {
  return {
    ...(column.sticky ? stickySx(column.sticky, isHeader) : {}),
    ...(column.numeric ? { fontVariantNumeric: 'tabular-nums' as const } : {}),
    whiteSpace: 'nowrap' as const,
  }
}

function formatSignedDelta(value: number): string {
  const formatted = value.toFixed(1)
  return value >= 0 ? `+${formatted}` : formatted
}

function priorSeasonLabel(season: number): string {
  return `${season - 1}-${String(season).slice(-2)}`
}

function priorSeasonTotal(
  prior: NonNullable<Projection['prior_season']>,
  columnId: string,
): number | null {
  switch (columnId) {
    case 'oreb':
      return toNumber(prior.oreb)
    case 'dreb':
      return toNumber(prior.dreb)
    case 'pf':
      return toNumber(prior.pf)
    case 'dd':
      return toNumber(prior.dd)
    case 'td':
      return toNumber(prior.td)
    default:
      return null
  }
}

function projectionTotal(row: Projection, columnId: string): number | null {
  switch (columnId) {
    case 'oreb':
      return toNumber(row.oreb)
    case 'dreb':
      return toNumber(row.dreb)
    case 'pf':
      return toNumber(row.pf)
    case 'dd':
      return toNumber(row.dd)
    case 'td':
      return toNumber(row.td)
    default:
      return null
  }
}

function estimatedPerGameDelta(
  row: Projection,
  columnId: string,
): number | null {
  if (!(row.estimated_stat_keys ?? []).includes(columnId)) return null
  const prior = row.prior_season
  if (prior == null) return null
  const priorGp = toNumber(prior.gp)
  if (priorGp == null || priorGp <= 0) return null
  const actual = priorSeasonTotal(prior, columnId)
  const estimate = projectionTotal(row, columnId)
  const gp = toNumber(row.gp)
  if (actual == null || estimate == null || gp == null || gp === 0) return null
  return estimate / gp - actual / priorGp
}

function estimatedDeltaCaption(row: Projection, columnId: string) {
  const delta = estimatedPerGameDelta(row, columnId)
  const prior = row.prior_season
  if (delta == null || prior == null) return null

  return (
    <Typography
      component="span"
      variant="caption"
      color="text.secondary"
      title={`vs ${priorSeasonLabel(prior.season)} actual per game`}
      sx={{ ml: 0.5 }}
    >
      {formatSignedDelta(delta)}
    </Typography>
  )
}

function tableAriaLabel(
  dataset: Dataset,
  rows: Projection[],
  view: StatView,
  basis: Basis,
  weightedName: string | null,
): string {
  const season =
    rows[0]?.season ??
    (dataset === 'actual'
      ? DEFAULT_PROJECTION_SEASON - 1
      : DEFAULT_PROJECTION_SEASON)
  const range = priorSeasonLabel(season)
  const base =
    dataset === 'actual'
      ? `Player actuals ${range}`
      : `Player projections ${range}`
  const withView = view === 'z' ? `${base}, z-scores` : base
  const withBasis = basis === 'total' ? `${withView}, season totals` : withView
  if (view === 'z' && weightedName) {
    return `${withBasis}, weighted by ${weightedName}`
  }
  return withBasis
}

// Stored z is already signed so positive is better, including reversed TO and PF.
function zHeatBackground(
  row: Projection,
  columnId: string,
  zScores: ZScoresResult | null,
  weighted: WeightedColumns | null,
): string | undefined {
  if (isScoredCat(columnId)) {
    return heatBackground(
      zScores?.scores.get(row.id)?.cats[columnId] ?? null,
      CAT_Z_CAP,
    )
  }
  if (columnId === 'z_total') {
    return heatBackground(zScores?.scores.get(row.id)?.total ?? null, TOTAL_Z_CAP)
  }
  if (columnId === 'z_weighted') {
    return heatBackground(weighted?.totals.get(row.id) ?? null, TOTAL_Z_CAP)
  }
  return undefined
}

function formatCell(
  row: Projection,
  columnId: string,
  dataset: Dataset,
  view: StatView,
  zScores: ZScoresResult | null,
  basis: Basis,
  weighted: WeightedColumns | null,
): string {
  if (view === 'z' && columnId === 'z_total') {
    return formatZ(zScores?.scores.get(row.id)?.total ?? null)
  }
  if (view === 'z' && columnId === 'z_weighted') {
    return formatZ(weighted?.totals.get(row.id) ?? null)
  }
  if (view === 'z' && columnId === 'z_rank_delta') {
    return formatRankDelta(weighted?.rankDelta.get(row.id) ?? null)
  }
  if (view === 'z' && isScoredCat(columnId)) {
    return formatZ(zScores?.scores.get(row.id)?.cats[columnId] ?? null)
  }
  switch (columnId) {
    case 'player':
      return row.full_name
    case 'pos':
      return row.positions.join(', ')
    case 'team':
      return row.nba_team
    case 'rank':
      if (dataset === 'actual' || row.espn_roto_rank == null) return '—'
      return String(row.espn_roto_rank)
    case 'gp':
      return formatStat(toNumber(row.gp), 0)
    case 'min':
      return formatStat(
        basis === 'total' ? toNumber(row.min) : perGame(row.min, row.gp),
        countingDigits(row, 'min', basis),
      )
    case 'fgm':
      return formatMadeAttempted(row, 'fg_pct', 'fgm', basis)
    case 'fg_pct':
      return formatStat(toNumber(row.fg_pct), 3)
    case 'ftm':
      return formatMadeAttempted(row, 'ft_pct', 'ftm', basis)
    case 'ft_pct':
      return formatStat(toNumber(row.ft_pct), 3)
    case 'tpm':
      return formatMadeAttempted(row, 'tp_pct', 'tpm', basis)
    case 'tp_pct':
      return formatStat(toNumber(row.tp_pct), 3)
    case 'oreb':
      return formatCounting(row, 'oreb', basis)
    case 'dreb':
      return formatCounting(row, 'dreb', basis)
    case 'ast':
      return formatCounting(row, 'ast', basis)
    case 'ato':
      return formatStat(toNumber(row.ato), 2)
    case 'stl':
      return formatCounting(row, 'stl', basis)
    case 'str':
      return formatStat(toNumber(row.str), 2)
    case 'blk':
      return formatCounting(row, 'blk', basis)
    case 'to':
      return formatCounting(row, 'to', basis)
    case 'pf':
      return formatCounting(row, 'pf', basis)
    case 'dd':
      return formatCounting(row, 'dd', basis)
    case 'td':
      return formatCounting(row, 'td', basis)
    case 'pts':
      return formatCounting(row, 'pts', basis)
    case 'ppm':
      return formatStat(toNumber(row.ppm), 3)
    default:
      return '—'
  }
}

function injuryIcon(status: string | null) {
  if (status !== 'OUT' && status !== 'DAY_TO_DAY') return null

  const out = status === 'OUT'
  const label = out ? 'Out' : 'Day to day'
  // SvgIcon defaults to aria-hidden, which would hide the accessible name.
  // React's SVG types also omit the global title attribute that it forwards.
  const labelled = { title: label } as ComponentProps<typeof SvgIcon>
  return (
    <SvgIcon
      role="img"
      aria-label={label}
      aria-hidden={false}
      {...labelled}
      sx={{
        ml: 0.5,
        verticalAlign: 'text-bottom',
        fontSize: 16,
        color: out ? 'error.main' : 'warning.main',
      }}
    >
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </SvgIcon>
  )
}

type ProjectionsTableProps = {
  rows: Projection[]
  sortBy: SortColumn | null
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
  emptyMessage: string
  dataset?: Dataset
  view?: StatView
  basis?: Basis
  zScores?: ZScoresResult | null
  weighted?: WeightedColumns | null
  heatmap?: boolean
  drafted?: Map<number, DraftPick> | null
}

export default function ProjectionsTable({
  rows,
  sortBy,
  sortDirection,
  onSort,
  emptyMessage,
  dataset = 'projection',
  view = 'values',
  basis = 'per_game',
  zScores = null,
  weighted = null,
  heatmap = false,
  drafted = null,
}: ProjectionsTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleColumns = COLUMNS.filter(
    (column) =>
      (view === 'z' || !column.zOnly) &&
      (!column.weightedOnly || (view === 'z' && weighted != null)),
  ).flatMap((column) =>
    drafted != null && column.id === 'team' ? [column, DRAFTED_COLUMN] : [column],
  )
  const showDeltaCaption =
    dataset === 'projection' && view === 'values' && basis === 'per_game'
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => (view === 'z' ? Z_ROW_HEIGHT : ROW_HEIGHT),
    overscan: 10,
    observeElementRect: observeContainerRect,
  })
  useEffect(() => {
    virtualizer.measure()
  }, [view, virtualizer])
  const virtualItems = rows.length > 0 ? virtualizer.getVirtualItems() : []
  const paddingTop = virtualItems[0]?.start ?? 0
  const paddingBottom =
    rows.length > 0
      ? virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0)
      : 0

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      ref={containerRef}
      // 346px is the measured chrome: title, toolbar, import line, both captions, page padding.
      sx={{ maxHeight: 'calc(100vh - 346px)', overflow: 'auto' }}
    >
      <Table
        stickyHeader
        size="small"
        aria-label={tableAriaLabel(
          dataset,
          rows,
          view,
          basis,
          weighted?.name ?? null,
        )}
      >
        <TableHead>
          <TableRow>
            {visibleColumns.map((column) => {
              const active = column.sortColumn != null && sortBy === column.sortColumn
              const label = columnLabel(column, view)
              return (
                <TableCell
                  key={column.id}
                  sortDirection={active ? sortDirection : false}
                  sx={cellSx(column, true)}
                >
                  {column.sortColumn ? (
                    <TableSortLabel
                      active={active}
                      direction={active ? sortDirection : 'desc'}
                      onClick={() => {
                        if (column.sortColumn) onSort(column.sortColumn)
                      }}
                    >
                      {label}
                    </TableSortLabel>
                  ) : (
                    label
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length}>{emptyMessage}</TableCell>
            </TableRow>
          ) : (
            <>
              {paddingTop > 0 ? (
                <TableRow aria-hidden style={{ height: paddingTop }}>
                  <TableCell
                    colSpan={visibleColumns.length}
                    sx={{ p: 0, border: 0 }}
                  />
                </TableRow>
              ) : null}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index]
                const isDrafted = drafted?.has(row.player_id) ?? false
                return (
                  <TableRow
                    key={row.id}
                    data-drafted={isDrafted ? 'true' : undefined}
                    sx={isDrafted ? { opacity: 0.45 } : undefined}
                  >
                    {visibleColumns.map((column) => {
                      const estimated =
                        dataset === 'projection' &&
                        (row.estimated_stat_keys ?? []).includes(column.id)
                      const heat =
                        view === 'z' && heatmap
                          ? zHeatBackground(row, column.id, zScores, weighted)
                          : undefined
                      return (
                        <TableCell
                          key={column.id}
                          sx={{
                            ...cellSx(column, false),
                            ...(estimated ? { fontStyle: 'italic' } : {}),
                            ...(heat != null ? { backgroundColor: heat } : {}),
                          }}
                          title={
                            estimated
                              ? 'FNBA estimate (not projected by ESPN)'
                              : undefined
                          }
                        >
                          {column.id === 'drafted'
                            ? draftedLabel(row, drafted)
                            : formatCell(
                                row,
                                column.id,
                                dataset,
                                view,
                                zScores,
                                basis,
                                weighted,
                              )}
                          {view === 'z' && isScoredCat(column.id) ? (
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              data-testid="basis-value"
                              sx={{ display: 'block' }}
                            >
                              {formatCell(
                                row,
                                column.id,
                                dataset,
                                'values',
                                zScores,
                                basis,
                                weighted,
                              )}
                            </Typography>
                          ) : null}
                          {column.id === 'player'
                            ? injuryIcon(row.injury_status)
                            : null}
                          {showDeltaCaption
                            ? estimatedDeltaCaption(row, column.id)
                            : null}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
              {paddingBottom > 0 ? (
                <TableRow aria-hidden style={{ height: paddingBottom }}>
                  <TableCell
                    colSpan={visibleColumns.length}
                    sx={{ p: 0, border: 0 }}
                  />
                </TableRow>
              ) : null}
            </>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
