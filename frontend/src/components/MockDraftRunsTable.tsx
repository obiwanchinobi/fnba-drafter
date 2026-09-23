import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import type { MockDraftRun } from '../api/mockDrafts.ts'

type Props = {
  runs: MockDraftRun[]
  userTeam: string
  selectedSlot: number | null
  onSelectRun: (userSlot: number) => void
}

function formatPoints(points: number | null): string {
  if (points == null || !Number.isFinite(points)) return '—'
  return String(points)
}

function winnerPoints(run: MockDraftRun): string {
  const winners = new Set(run.winners)
  const points = run.standings
    .filter((row) => winners.has(row.team))
    .map((row) => row.roto_points)
  if (points.length === 0) return '—'
  return [...new Set(points)].map((value) => formatPoints(value)).join(', ')
}

function userStanding(run: MockDraftRun, userTeam: string) {
  return run.standings.find((row) => row.team === userTeam)
}

export default function MockDraftRunsTable({
  runs,
  userTeam,
  selectedSlot,
  onSelectRun,
}: Props) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Mock draft winners">
        <TableHead>
          <TableRow>
            <TableCell>Team Chino slot</TableCell>
            <TableCell>Winner</TableCell>
            <TableCell align="right">Winner roto points</TableCell>
            <TableCell align="right">Team Chino rank</TableCell>
            <TableCell align="right">Team Chino roto points</TableCell>
            <TableCell>Draft order</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.map((run) => {
            const user = userStanding(run, userTeam)
            const selected = selectedSlot === run.user_slot
            return (
              <TableRow
                key={run.user_slot}
                hover
                selected={selected}
                onClick={() => onSelectRun(run.user_slot)}
                sx={{ cursor: 'pointer' }}
                data-testid={`mock-draft-run-${run.user_slot}`}
              >
                <TableCell>{run.user_slot}</TableCell>
                <TableCell>{run.winners.join(', ') || '—'}</TableCell>
                <TableCell align="right">{winnerPoints(run)}</TableCell>
                <TableCell align="right">{user?.rank ?? '—'}</TableCell>
                <TableCell align="right">
                  {formatPoints(user?.roto_points ?? null)}
                </TableCell>
                <TableCell>{run.draft_order.join(' · ')}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
