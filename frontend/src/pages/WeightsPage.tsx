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
import { fetchWeightSets, type WeightSet } from '../api/weightSets.ts'
import { SCORED_CAT_IDS, SCORED_CAT_LABELS } from '../lib/statBasis.ts'

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatWeight(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(value)
}

function WeightSetsTable({ weightSets }: { weightSets: WeightSet[] }) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ overflowX: 'auto' }}
    >
      <Table size="small" aria-label="Custom weights">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Updated</TableCell>
            {SCORED_CAT_IDS.map((cat) => (
              <TableCell key={cat} align="right">
                {SCORED_CAT_LABELS[cat]}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {weightSets.map((weightSet) => (
            <TableRow
              key={weightSet.id}
              data-testid={`weight-set-${weightSet.id}`}
            >
              <TableCell>{weightSet.name}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatWhen(weightSet.updated_at)}
              </TableCell>
              {SCORED_CAT_IDS.map((cat) => (
                <TableCell key={cat} align="right">
                  {formatWeight(weightSet.weights[cat])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function WeightsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weightSets, setWeightSets] = useState<WeightSet[]>([])

  useEffect(() => {
    let cancelled = false
    fetchWeightSets()
      .then((sets) => {
        if (!cancelled) setWeightSets(sets)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load weights')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Container component="main" maxWidth={false} sx={{ py: 4, maxWidth: 1536 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Weights
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Every saved weight collection, including the Draft slot 1 to 8
          collections written by Find winning weights. Edit or delete a
          collection from Projections or Mock drafts.
        </Typography>
        {loading ? (
          <Typography>Loading weights…</Typography>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : weightSets.length === 0 ? (
          <Typography>
            No custom weights yet. Save one from Projections or Mock drafts.
          </Typography>
        ) : (
          <WeightSetsTable weightSets={weightSets} />
        )}
      </Stack>
    </Container>
  )
}
