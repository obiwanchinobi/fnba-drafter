import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Typography from '@mui/material/Typography'
import type { Projection } from '../api/projections.ts'

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

type Column = {
  id: string
  label: string
  sortColumn?: SortColumn
  sticky?: 'player' | 'pos' | 'team'
  numeric?: boolean
}

const COLUMNS: Column[] = [
  { id: 'player', label: 'Player', sortColumn: 'player', sticky: 'player' },
  { id: 'pos', label: 'Pos', sortColumn: 'pos', sticky: 'pos' },
  { id: 'team', label: 'Team', sortColumn: 'team', sticky: 'team' },
  { id: 'inj', label: 'Inj' },
  { id: 'rank', label: 'Rank', sortColumn: 'rank', numeric: true },
  { id: 'gp', label: 'GP', sortColumn: 'gp', numeric: true },
  { id: 'min', label: 'MIN', sortColumn: 'min', numeric: true },
  { id: 'fgm', label: 'FGM/FGA', sortColumn: 'fgm', numeric: true },
  { id: 'fg_pct', label: 'FG%', sortColumn: 'fg_pct', numeric: true },
  { id: 'ftm', label: 'FTM/FTA', sortColumn: 'ftm', numeric: true },
  { id: 'ft_pct', label: 'FT%', sortColumn: 'ft_pct', numeric: true },
  { id: 'tpm', label: '3PM/3PA', sortColumn: 'tpm', numeric: true },
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

const STICKY_LEFT = { player: 0, pos: 168, team: 240 } as const
const STICKY_MIN_WIDTH = { player: 168, pos: 72, team: 64 } as const

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

function formatStat(value: number | null, digits = 1): string {
  if (value == null) return '—'
  return value.toFixed(digits)
}

function formatMadeAttempted(
  made: number | null,
  attempted: number | null,
  gp: number | null,
): string {
  const madePg = perGame(made, gp)
  const attemptedPg = perGame(attempted, gp)
  if (madePg == null && attemptedPg == null) return '—'
  return `${formatStat(madePg)}/${formatStat(attemptedPg)}`
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

function formatCell(row: Projection, columnId: string): string {
  const gp = toNumber(row.gp)
  switch (columnId) {
    case 'player':
      return row.full_name
    case 'pos':
      return row.positions.join(', ')
    case 'team':
      return row.nba_team
    case 'inj':
      return row.injury_status ?? '—'
    case 'rank':
      return row.espn_roto_rank == null ? '—' : String(row.espn_roto_rank)
    case 'gp':
      return formatStat(gp, 0)
    case 'min':
      return formatStat(perGame(row.min, gp))
    case 'fgm':
      return formatMadeAttempted(row.fgm, row.fga, gp)
    case 'fg_pct':
      return formatStat(toNumber(row.fg_pct), 3)
    case 'ftm':
      return formatMadeAttempted(row.ftm, row.fta, gp)
    case 'ft_pct':
      return formatStat(toNumber(row.ft_pct), 3)
    case 'tpm':
      return formatMadeAttempted(row.tpm, row.tpa, gp)
    case 'tp_pct':
      return formatStat(toNumber(row.tp_pct), 3)
    case 'oreb':
      return formatStat(perGame(row.oreb, gp))
    case 'dreb':
      return formatStat(perGame(row.dreb, gp))
    case 'ast':
      return formatStat(perGame(row.ast, gp))
    case 'ato':
      return formatStat(toNumber(row.ato), 2)
    case 'stl':
      return formatStat(perGame(row.stl, gp))
    case 'str':
      return formatStat(toNumber(row.str), 2)
    case 'blk':
      return formatStat(perGame(row.blk, gp))
    case 'to':
      return formatStat(perGame(row.to, gp))
    case 'pf':
      return formatStat(perGame(row.pf, gp))
    case 'dd':
      return formatStat(perGame(row.dd, gp))
    case 'td':
      return formatStat(perGame(row.td, gp))
    case 'pts':
      return formatStat(perGame(row.pts, gp))
    case 'ppm':
      return formatStat(toNumber(row.ppm), 3)
    default:
      return '—'
  }
}

type ProjectionsTableProps = {
  rows: Projection[]
  sortBy: SortColumn | null
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
  emptyMessage: string
}

export default function ProjectionsTable({
  rows,
  sortBy,
  sortDirection,
  onSort,
  emptyMessage,
}: ProjectionsTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Player projections">
        <TableHead>
          <TableRow>
            {COLUMNS.map((column) => {
              const active = column.sortColumn != null && sortBy === column.sortColumn
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
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length}>{emptyMessage}</TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {COLUMNS.map((column) => {
                  const estimated = (row.estimated_stat_keys ?? []).includes(
                    column.id,
                  )
                  return (
                    <TableCell
                      key={column.id}
                      sx={{
                        ...cellSx(column, false),
                        ...(estimated ? { fontStyle: 'italic' } : {}),
                      }}
                      title={
                        estimated
                          ? 'FNBA estimate (not projected by ESPN)'
                          : undefined
                      }
                    >
                      {formatCell(row, column.id)}
                      {estimatedDeltaCaption(row, column.id)}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
