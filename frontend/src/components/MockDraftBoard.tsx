import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { formatPick, picksToGrid, type DraftRunView } from '../lib/draftBoard.ts'
import { ROSTER_SIZE, TEAM_COUNT } from '../lib/league.ts'

type Props = {
  run: DraftRunView
  userTeam: string
}

function isUserColumn(team: string, userTeam: string): boolean {
  return team !== '' && team === userTeam
}

function highlightSx(isUser: boolean) {
  return {
    whiteSpace: 'nowrap' as const,
    ...(isUser ? { bgcolor: 'action.hover' } : {}),
  }
}

export default function MockDraftBoard({ run, userTeam }: Props) {
  const grid = picksToGrid(run.picks, TEAM_COUNT, ROSTER_SIZE)

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ overflowX: 'auto' }}
    >
      <Table size="small" aria-label="Mock draft board">
        <TableHead>
          <TableRow>
            {Array.from({ length: TEAM_COUNT }, (_, index) => {
              const slot = index + 1
              const team = run.draft_order[index] ?? ''
              const isUser = isUserColumn(team, userTeam)
              return (
                <TableCell
                  key={slot}
                  data-user-team={isUser ? 'true' : undefined}
                  sx={highlightSx(isUser)}
                >
                  {team === '' ? String(slot) : `${slot} ${team}`}
                </TableCell>
              )
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {grid.map((roundPicks, roundIndex) => (
            <TableRow key={roundIndex + 1}>
              {roundPicks.map((pick, slotIndex) => {
                const team = run.draft_order[slotIndex] ?? ''
                return (
                  <TableCell
                    key={slotIndex + 1}
                    sx={highlightSx(isUserColumn(team, userTeam))}
                  >
                    {pick == null ? null : formatPick(pick)}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
