import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import {
  fetchWeightSearch,
  runWeightSearch,
  type WeightSearchRun,
} from '../api/weightSearches.ts'
import MockDraftBoard from '../components/MockDraftBoard.tsx'
import MockDraftStandings from '../components/MockDraftStandings.tsx'
import WeightSearchResults from '../components/WeightSearchResults.tsx'
import { relativeWeights } from '../lib/catWeights.ts'
import { SCORED_CAT_IDS, SCORED_CAT_LABELS } from '../lib/statBasis.ts'

const USER_TEAM = 'Team Chino'
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const

function formatWhen(value: string | null): string {
  if (value == null) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatWeight(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(Number(value.toFixed(2)))
}

// Replaces the run for its slot (or adds it) and keeps runs ordered by slot.
function upsertRun(
  runs: WeightSearchRun[],
  run: WeightSearchRun,
): WeightSearchRun[] {
  return [...runs.filter((r) => r.user_slot !== run.user_slot), run].sort(
    (a, b) => a.user_slot - b.user_slot,
  )
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function RunWeights({ run }: { run: WeightSearchRun }) {
  const relative = relativeWeights(run.weights)
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ overflowX: 'auto' }}
    >
      <Table size="small" aria-label={`${run.weight_set_name} weights`}>
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
                {formatWeight(run.weights[cat])}
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

export default function WinningWeightsPage() {
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<WeightSearchRun[]>([])
  const [scenarioCount, setScenarioCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [pickerSlot, setPickerSlot] = useState<number>(1)
  const [runningSlot, setRunningSlot] = useState<number | null>(null)
  const [runningAll, setRunningAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchWeightSearch()
      .then((saved) => {
        if (cancelled) return
        setRuns(saved.runs)
        setScenarioCount(saved.scenario_count)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(errorMessage(err, 'Failed to load winning weights'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const busy = loading || runningSlot != null

  async function searchSlot(userSlot: number): Promise<boolean> {
    setRunningSlot(userSlot)
    try {
      const run = await runWeightSearch({ userSlot })
      setRuns((current) => upsertRun(current, run))
      return true
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to find winning weights'))
      return false
    }
  }

  async function handleRunSlot() {
    setError(null)
    try {
      await searchSlot(pickerSlot)
    } finally {
      setRunningSlot(null)
    }
  }

  async function handleRunAll() {
    setError(null)
    setRunningAll(true)
    try {
      for (const slot of SLOTS) {
        if (!(await searchSlot(slot))) break
      }
    } finally {
      setRunningSlot(null)
      setRunningAll(false)
    }
  }

  const selectedRun = runs.find((run) => run.user_slot === selectedSlot) ?? null
  const selectedWins =
    selectedRun?.win_rate != null && selectedRun.scenario_count
      ? `${Math.round(selectedRun.win_rate * selectedRun.scenario_count)} of ${selectedRun.scenario_count}`
      : null

  return (
    <Container component="main" maxWidth={false} sx={{ py: 4, maxWidth: 1536 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Winning weights
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Find winning weights searches weight collections for one {USER_TEAM}{' '}
          draft slot at a time on FNBA Total-Z season totals, and saves the best
          one as &quot;Draft slot N&quot;. Each collection is scored across{' '}
          {scenarioCount ?? 'a fixed set of'} modelled draft rooms. In every
          scenario after the first, each of the seven opponents drafts from
          Total-Z or ESPN rank with random noise; scenario 0 is the base room, where every opponent drafts by
          unweighted Total-Z, and it is the board shown for a slot. Win rate is
          the share of scenarios in which {USER_TEAM} finishes first outright. It is measured
          against modelled rooms, not a forecast of eight people on draft
          night: read a win rate under about 60 percent as competitive, not
          winning. The saved collections appear in the Weights list on Mock
          drafts, so you can test any of them across every slot.
        </Typography>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="winning-weights-slot-label">Draft slot</InputLabel>
            <Select
              labelId="winning-weights-slot-label"
              id="winning-weights-slot"
              label="Draft slot"
              value={String(pickerSlot)}
              disabled={busy}
              onChange={(event) => setPickerSlot(Number(event.target.value))}
            >
              {SLOTS.map((slot) => (
                <MenuItem key={slot} value={String(slot)}>
                  Slot {slot}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={() => void handleRunSlot()}
            disabled={busy}
            loading={runningSlot != null && !runningAll}
            loadingPosition="start"
          >
            Find winning weights for slot {pickerSlot}
          </Button>
          <Button
            variant="outlined"
            onClick={() => void handleRunAll()}
            disabled={busy}
            loading={runningAll}
            loadingPosition="start"
          >
            Run all slots
          </Button>
          {runningAll && runningSlot != null ? (
            <Typography variant="body2" role="status">
              Slot {runningSlot} of {SLOTS.length}
            </Typography>
          ) : null}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Running a slot replaces its saved run and its Draft slot N collection;
          other slots are left alone.
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Typography>Loading winning weights…</Typography>
        ) : runs.length > 0 ? (
          <WeightSearchResults
            runs={runs}
            scenarioCount={scenarioCount ?? 0}
            userTeam={USER_TEAM}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
          />
        ) : (
          <Typography>No winning weights yet.</Typography>
        )}
        {selectedRun ? (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Slot {selectedRun.user_slot}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {`Last run ${formatWhen(selectedRun.created_at)}, projections imported ${formatWhen(selectedRun.projection_imported_at)}`}
              {selectedRun.budget != null
                ? `, ${selectedRun.budget} collections searched`
                : ''}
              {selectedWins ? `. Wins ${selectedWins} scenarios.` : '.'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {USER_TEAM} ranks by {selectedRun.weight_set_name}. Relative to
              mean divides each weight by the average of the 19, so 2 means
              twice the average emphasis. TO and PF weights still reward fewer:
              the weight scales an already-inverted Z. The board and standings
              below are scenario 0, where the other seven teams draft by
              unweighted Total-Z.
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
