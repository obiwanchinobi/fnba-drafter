import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { relativeWeights, type CatWeights } from '../lib/catWeights.ts'
import { SCORED_CAT_IDS, SCORED_CAT_LABELS } from '../lib/statBasis.ts'

function formatWeight(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(Number(value.toFixed(2)))
}

// Read-only view of a weight collection: one column per scored category, a
// raw Weight row and a Relative to mean row (see relativeWeights).
export default function CatWeightsTable({
  weights,
  label,
}: {
  weights: CatWeights
  label: string
}) {
  const relative = relativeWeights(weights)
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ overflowX: 'auto' }}
    >
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            <TableCell />
            {SCORED_CAT_IDS.map((cat) => (
              <TableCell key={cat} align="right">
                {SCORED_CAT_LABELS[cat]}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell component="th" scope="row">
              Weight
            </TableCell>
            {SCORED_CAT_IDS.map((cat) => (
              <TableCell key={cat} align="right">
                {formatWeight(weights[cat])}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell component="th" scope="row">
              Relative to mean
            </TableCell>
            {SCORED_CAT_IDS.map((cat) => (
              <TableCell key={cat} align="right">
                {formatWeight(relative[cat])}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}
