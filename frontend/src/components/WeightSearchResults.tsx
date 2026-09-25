import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { WeightSearch } from '../api/weightSearches.ts'

type Props = {
  result: WeightSearch
  userTeam: string
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(value)
}

function formatMargin(margin: number): string {
  if (!Number.isFinite(margin)) return '—'
  return margin > 0 ? `+${margin}` : String(margin)
}

function outcome(margin: number): string {
  if (margin > 0) return 'Wins'
  if (margin === 0) return 'Ties'
  return 'Loses'
}

export default function WeightSearchResults({ result, userTeam }: Props) {
  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        Searched {result.budget} weight collections per slot. {userTeam} ranks
        by the found collection; the other seven teams use unweighted Total-Z.
        Saved as &quot;Draft slot 1&quot; to &quot;Draft slot 8&quot;. A
        projected win assumes opponents draft strictly by Total-Z, so treat a
        thin margin as a coin flip, not a guarantee.
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Winning weights by slot">
          <TableHead>
            <TableRow>
              <TableCell>Slot</TableCell>
              <TableCell>Collection</TableCell>
              <TableCell align="right">{userTeam} rank</TableCell>
              <TableCell align="right">Roto points</TableCell>
              <TableCell align="right">Margin</TableCell>
              <TableCell>Result</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {result.slots.map((slot) => (
              <TableRow
                key={slot.user_slot}
                data-testid={`weight-search-slot-${slot.user_slot}`}
              >
                <TableCell>{slot.user_slot}</TableCell>
                <TableCell>{slot.weight_set.name}</TableCell>
                <TableCell align="right">{slot.rank}</TableCell>
                <TableCell align="right">
                  {formatNumber(slot.roto_points)}
                </TableCell>
                <TableCell align="right">{formatMargin(slot.margin)}</TableCell>
                <TableCell>{outcome(slot.margin)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}
