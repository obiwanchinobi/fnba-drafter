import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
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
  runWeightSearch,
  type WeightSearch,
  type WeightSearchRun,
} from '../api/weightSearches.ts'
import MockDraftBoard from '../components/MockDraftBoard.tsx'
import MockDraftStandings from '../components/MockDraftStandings.tsx'
import WeightSearchResults from '../components/WeightSearchResults.tsx'
import { SCORED_CAT_IDS, type ScoredCat } from '../lib/statBasis.ts'

const USER_TEAM = 'Team Chino'

const WEIGHT_LABELS: Record<ScoredCat, string> = {
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

function formatWeight(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(value)
}

function RunWeights({ run }: { run: WeightSearchRun }) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ overflowX: 'auto' }}
    >
      <Table size="small" aria-label={`${run.weight_set_name} weights`}>
        <TableHead>
          <TableRow>
            {SCORED_CAT_IDS.map((cat) => (
              <TableCell key={cat} align="right">
                {WEIGHT_LABELS[cat]}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            {SCORED_CAT_IDS.map((cat) => (
              <TableCell key={cat} align="right">
                {formatWeight(run.weights[cat])}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function WinningWeightsPage() {
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<WeightSearch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  async function handleFindWeights() {
    setSearching(true)
    setError(null)
    try {
      setResult(await runWeightSearch())
      setSelectedSlot(null)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to find winning weights',
      )
    } finally {
      setSearching(false)
    }
  }

  const selectedRun =
    result?.runs.find((run) => run.user_slot === selectedSlot) ?? null

  return (
    <Container component="main" maxWidth={false} sx={{ py: 4, maxWidth: 1536 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Winning weights
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Find winning weights searches weight collections per draft slot for{' '}
          {USER_TEAM} on FNBA Total-Z season totals, and saves the best one for
          each slot as &quot;Draft slot N&quot;. Those collections appear in the
          Weights list on Mock drafts, so you can test any of them across every
          slot.
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={() => void handleFindWeights()}
            disabled={searching}
            loading={searching}
          >
            Find winning weights
          </Button>
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {result ? (
          <WeightSearchResults
            result={result}
            userTeam={USER_TEAM}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
          />
        ) : searching ? null : (
          <Typography>No winning weights yet.</Typography>
        )}
        {selectedRun ? (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Slot {selectedRun.user_slot}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {USER_TEAM} ranks by {selectedRun.weight_set_name}; the other
              seven teams by unweighted Total-Z. TO and PF weights still reward
              fewer: the weight scales an already-inverted Z.
            </Typography>
            <RunWeights run={selectedRun} />
            <MockDraftBoard run={selectedRun} userTeam={USER_TEAM} />
            <MockDraftStandings
              standings={selectedRun.standings}
              userTeam={USER_TEAM}
            />
          </Stack>
        ) : null}
      </Stack>
    </Container>
  )
}
