import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { WeightSearchRun } from '../api/weightSearches.ts'

type Props = {
  runs: WeightSearchRun[]
  scenarioCount: number
  userTeam: string
  selectedSlot: number | null
  onSelectSlot: (userSlot: number) => void
}

// Margins are roto points; means can carry long fractions, so cap at 2 places.
function formatMargin(margin: number | null): string {
  if (margin == null || !Number.isFinite(margin)) return '—'
  const rounded = Number(margin.toFixed(2))
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

function formatWins(run: WeightSearchRun, scenarioCount: number): string {
  const total = run.scenario_count ?? scenarioCount
  if (run.win_rate == null || !Number.isFinite(run.win_rate) || !total) {
    return '—'
  }
  return `${Math.round(run.win_rate * total)} of ${total}`
}

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4..8 → "4th".."8th".
function formatRank(rank: number | null): string {
  if (rank == null || !Number.isInteger(rank) || rank < 1) return '—'
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
  return `${rank}${suffix}`
}

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function WeightSearchResults({
  runs,
  scenarioCount,
  userTeam,
  selectedSlot,
  onSelectSlot,
}: Props) {
  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        Wins counts the scenarios where {userTeam} finishes first outright, out of the{' '}
        {scenarioCount} it was scored on. Mean and worst margin are roto points
        ahead of (or behind) the best other team across those scenarios. Base
        margin is scenario 0, the board shown when you select a slot. Base rank
        is where {userTeam} finishes in that scenario&apos;s standings, the same
        position a Mock draft with this collection shows for the slot.
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Winning weights by slot">
          <TableHead>
            <TableRow>
              <TableCell>Slot</TableCell>
              <TableCell>Collection</TableCell>
              <TableCell align="right">Wins</TableCell>
              <TableCell align="right">Mean margin</TableCell>
              <TableCell align="right">Worst margin</TableCell>
              <TableCell align="right">Base margin</TableCell>
              <TableCell align="right">Base rank</TableCell>
              <TableCell>Last run</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map((run) => (
              <TableRow
                key={run.user_slot}
                hover
                selected={selectedSlot === run.user_slot}
                onClick={() => onSelectSlot(run.user_slot)}
                sx={{ cursor: 'pointer' }}
                data-testid={`weight-search-slot-${run.user_slot}`}
              >
                <TableCell>{run.user_slot}</TableCell>
                <TableCell>{run.weight_set_name}</TableCell>
                <TableCell align="right">
                  {formatWins(run, scenarioCount)}
                </TableCell>
                <TableCell align="right">
                  {formatMargin(run.mean_margin)}
                </TableCell>
                <TableCell align="right">
                  {formatMargin(run.worst_margin)}
                </TableCell>
                <TableCell align="right">{formatMargin(run.margin)}</TableCell>
                <TableCell align="right">{formatRank(run.rank)}</TableCell>
                <TableCell>{formatWhen(run.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}
