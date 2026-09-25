import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { SCORED_CAT_IDS, SCORED_CATS, type ScoredCat } from '../lib/statBasis.ts'
import type { TeamStanding } from '../lib/draftBoard.ts'

const CAT_LABELS: Record<ScoredCat, string> = {
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

type Props = {
  standings: TeamStanding[]
  userTeam: string
}

function catHeader(cat: ScoredCat): string {
  const def = SCORED_CATS[cat]
  const label = CAT_LABELS[cat]
  if (def.kind === 'counting' && def.inverse) {
    return `${label} (lower is better)`
  }
  return label
}

function formatPoints(points: number): string {
  return String(points)
}

const PERCENT_CATS: ReadonlySet<ScoredCat> = new Set(['fg_pct', 'ft_pct', 'tp_pct'])

function formatTotal(cat: ScoredCat, value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (SCORED_CATS[cat].kind === 'counting') return value.toFixed(0)
  if (PERCENT_CATS.has(cat)) return value.toFixed(3)
  return value.toFixed(2)
}

function CategoryCell({ standing, cat }: { standing: TeamStanding; cat: ScoredCat }) {
  const entry = standing.cats[cat]
  if (entry == null || !Number.isFinite(entry.points)) return <>—</>
  return (
    <>
      {formatPoints(entry.points)}
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block' }}
      >
        {formatTotal(cat, entry.value)}
      </Typography>
    </>
  )
}

export default function MockDraftStandings({ standings, userTeam }: Props) {
  return (
    <>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ overflowX: 'auto' }}
      >
        <Table size="small" aria-label="Projected rotisserie standings">
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Team</TableCell>
              <TableCell align="right">Roto points</TableCell>
              {SCORED_CAT_IDS.map((cat) => (
                <TableCell key={cat} align="right">
                  {catHeader(cat)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {standings.map((standing, index) => {
              const isUser = standing.team !== '' && standing.team === userTeam
              return (
                <TableRow
                  key={`${standing.team}-${index}`}
                  data-user-team={isUser ? 'true' : undefined}
                  sx={isUser ? { bgcolor: 'action.hover' } : undefined}
                >
                  <TableCell>{standing.rank}</TableCell>
                  <TableCell>{standing.team}</TableCell>
                  <TableCell align="right">
                    {formatPoints(standing.roto_points)}
                  </TableCell>
                  {SCORED_CAT_IDS.map((cat) => (
                    <TableCell
                      key={cat}
                      align="right"
                      sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                    >
                      <CategoryCell standing={standing} cat={cat} />
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" component="p">
        Projected rotisserie points for all 16 rostered players, with no injury
        or lineup model. The large figure is roto points; the small figure
        beneath is the team's projected season total, with percentages and
        ratios as season-level rates. TO and PF are reversed: lower is better.
      </Typography>
    </>
  )
}
