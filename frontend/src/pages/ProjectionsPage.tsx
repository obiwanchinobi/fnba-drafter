import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import {
  DEFAULT_PROJECTION_SEASON,
  DEFAULT_PROJECTION_SOURCE,
  fetchProjections,
  type Projection,
} from '../api/projections.ts'
import ProjectionsToolbar from '../components/ProjectionsToolbar.tsx'

const TABLE_HEADERS = [
  'Player',
  'Pos',
  'Team',
  'Inj',
  'Rank',
  'GP',
  'MIN',
  'FGM/FGA',
  'FG%',
  'FTM/FTA',
  'FT%',
  '3PM/3PA',
  '3P%',
  'OREB',
  'DREB',
  'AST',
  'A/TO',
  'STL',
  'STR',
  'BLK',
  'TO',
  'PF',
  'DD',
  'TD',
  'PTS',
  'PPM',
] as const

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

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

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

  const lastImported = latestImportedAt(rows)

  return (
    <Container component="main" maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          2026–27 projections
        </Typography>
        <ProjectionsToolbar source={source} onSourceChange={setSource} />
        {error ? <Alert severity="error">{error}</Alert> : null}
        {lastImported && !error ? (
          <Typography>
            Last imported: {new Date(lastImported).toLocaleString()}
          </Typography>
        ) : null}
        {error ? null : loading ? (
          <Typography>Loading projections…</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label="Player projections">
              <TableHead>
                <TableRow>
                  {TABLE_HEADERS.map((header) => (
                    <TableCell key={header}>{header}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={TABLE_HEADERS.length}>
                      No projections yet. Use Update from source.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const gp = toNumber(row.gp)
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.full_name}</TableCell>
                        <TableCell>{row.positions.join(', ')}</TableCell>
                        <TableCell>{row.nba_team}</TableCell>
                        <TableCell>{row.injury_status ?? '—'}</TableCell>
                        <TableCell>
                          {row.espn_roto_rank == null
                            ? '—'
                            : String(row.espn_roto_rank)}
                        </TableCell>
                        <TableCell>{formatStat(gp, 0)}</TableCell>
                        <TableCell>{formatStat(perGame(row.min, gp))}</TableCell>
                        <TableCell>
                          {formatMadeAttempted(row.fgm, row.fga, gp)}
                        </TableCell>
                        <TableCell>
                          {formatStat(toNumber(row.fg_pct), 3)}
                        </TableCell>
                        <TableCell>
                          {formatMadeAttempted(row.ftm, row.fta, gp)}
                        </TableCell>
                        <TableCell>
                          {formatStat(toNumber(row.ft_pct), 3)}
                        </TableCell>
                        <TableCell>
                          {formatMadeAttempted(row.tpm, row.tpa, gp)}
                        </TableCell>
                        <TableCell>
                          {formatStat(toNumber(row.tp_pct), 3)}
                        </TableCell>
                        <TableCell>
                          {formatStat(perGame(row.oreb, gp))}
                        </TableCell>
                        <TableCell>
                          {formatStat(perGame(row.dreb, gp))}
                        </TableCell>
                        <TableCell>
                          {formatStat(perGame(row.ast, gp))}
                        </TableCell>
                        <TableCell>
                          {formatStat(toNumber(row.ato), 2)}
                        </TableCell>
                        <TableCell>
                          {formatStat(perGame(row.stl, gp))}
                        </TableCell>
                        <TableCell>
                          {formatStat(toNumber(row.str), 2)}
                        </TableCell>
                        <TableCell>
                          {formatStat(perGame(row.blk, gp))}
                        </TableCell>
                        <TableCell>
                          {formatStat(perGame(row.to, gp))}
                        </TableCell>
                        <TableCell>{formatStat(perGame(row.pf, gp))}</TableCell>
                        <TableCell>{formatStat(perGame(row.dd, gp))}</TableCell>
                        <TableCell>{formatStat(perGame(row.td, gp))}</TableCell>
                        <TableCell>
                          {formatStat(perGame(row.pts, gp))}
                        </TableCell>
                        <TableCell>
                          {formatStat(toNumber(row.ppm), 3)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </Container>
  )
}
