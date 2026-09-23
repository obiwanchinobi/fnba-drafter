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
import { useNavigate, useParams } from 'react-router'
import {
  createMockDraft,
  fetchMockDraft,
  fetchMockDrafts,
  type MockDraft,
  type MockDraftSummary,
} from '../api/mockDrafts.ts'
import { fetchWeightSets, type WeightSet } from '../api/weightSets.ts'
import MockDraftBoard from '../components/MockDraftBoard.tsx'
import MockDraftRunsTable from '../components/MockDraftRunsTable.tsx'
import MockDraftStandings from '../components/MockDraftStandings.tsx'
import WeightSetDialog from '../components/WeightSetDialog.tsx'

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function weightsHelper(name: string | null): string {
  const basis = 'FNBA Total-Z, season totals'
  if (name == null) {
    return `${basis}. The other teams and Team Chino both use unweighted Total-Z.`
  }
  return `${basis}. Team Chino ranks by ${name}. The other seven teams use unweighted Total-Z.`
}

export default function MockDraftsPage() {
  const { id } = useParams<{ id: string }>()
  const parsedDraftId = id == null ? null : Number(id)
  const selectedDraftId =
    parsedDraftId != null && Number.isFinite(parsedDraftId) ? parsedDraftId : null
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<MockDraftSummary[]>([])
  const [detail, setDetail] = useState<MockDraft | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [weightSets, setWeightSets] = useState<WeightSet[]>([])
  const [activeWeightSetId, setActiveWeightSetId] = useState<
    number | 'default'
  >('default')
  const [weightDialog, setWeightDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
  }>({ open: false, mode: 'create' })

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([fetchMockDrafts(), fetchWeightSets()]).then(
      ([draftResult, weightSetResult]) => {
        if (cancelled) return
        if (draftResult.status === 'fulfilled') {
          setDrafts(draftResult.value)
        } else {
          setDrafts([])
        }
        if (weightSetResult.status === 'fulfilled') {
          setWeightSets(weightSetResult.value)
        } else {
          setWeightSets([])
        }
        const reason =
          draftResult.status === 'rejected'
            ? draftResult.reason
            : weightSetResult.status === 'rejected'
              ? weightSetResult.reason
              : null
        if (reason) {
          setError(
            reason instanceof Error ? reason.message : 'Failed to load mock drafts',
          )
        }
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedDraftId == null) return
    let cancelled = false
    fetchMockDraft(selectedDraftId)
      .then((draft) => {
        if (!cancelled) setDetail(draft)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null)
          setError(
            err instanceof Error ? err.message : 'Failed to load mock draft',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedDraftId])

  const activeWeightSet =
    activeWeightSetId === 'default'
      ? null
      : (weightSets.find((set) => set.id === activeWeightSetId) ?? null)

  async function handleWeightsSaved(saved: WeightSet) {
    const list = await fetchWeightSets()
    setWeightSets(list)
    setActiveWeightSetId(saved.id)
    setWeightDialog({ open: false, mode: 'create' })
  }

  async function handleWeightsDeleted() {
    const list = await fetchWeightSets()
    setWeightSets(list)
    setActiveWeightSetId('default')
    setWeightDialog({ open: false, mode: 'create' })
  }

  async function handleRun() {
    setRunning(true)
    setError(null)
    try {
      const created = await createMockDraft({
        policy: 'fnba_total_z',
        ...(typeof activeWeightSetId === 'number'
          ? { weightSetId: activeWeightSetId }
          : {}),
      })
      const rows = await fetchMockDrafts()
      setDrafts(rows)
      setDetail(created)
      setSelectedSlot(null)
      navigate(`/mock-drafts/${created.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run mock draft')
    } finally {
      setRunning(false)
    }
  }

  const selectedRun =
    detail?.runs.find((run) => run.user_slot === selectedSlot) ?? null

  return (
    <Container component="main" maxWidth={false} sx={{ py: 4, maxWidth: 1536 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Mock drafts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Run one policy across all eight Team Chino draft slots.
        </Typography>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="mock-draft-weights-label">Weights</InputLabel>
            <Select
              labelId="mock-draft-weights-label"
              id="mock-draft-weights"
              label="Weights"
              value={
                activeWeightSetId === 'default'
                  ? 'default'
                  : String(activeWeightSetId)
              }
              onChange={(event) => {
                const value = String(event.target.value)
                setActiveWeightSetId(
                  value === 'default' ? 'default' : Number(value),
                )
              }}
            >
              <MenuItem value="default">Default</MenuItem>
              {weightSets.map((set) => (
                <MenuItem key={set.id} value={String(set.id)}>
                  {set.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setWeightDialog({ open: true, mode: 'create' })}
          >
            New weights
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setWeightDialog({ open: true, mode: 'edit' })}
            disabled={activeWeightSetId === 'default'}
          >
            Edit weights
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleRun()}
            disabled={running}
            loading={running}
          >
            Run mock draft
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {weightsHelper(activeWeightSet?.name ?? null)}
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Typography>Loading mock drafts…</Typography>
        ) : drafts.length === 0 ? (
          <Typography>No mock drafts yet.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label="Mock drafts">
              <TableHead>
                <TableRow>
                  <TableCell>Policy</TableCell>
                  <TableCell>Weights</TableCell>
                  <TableCell>Projection version</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow
                    key={draft.id}
                    hover
                    selected={draft.id === selectedDraftId}
                    onClick={() => {
                      setSelectedSlot(null)
                      if (detail?.id !== draft.id) setDetail(null)
                      navigate(`/mock-drafts/${draft.id}`)
                    }}
                    sx={{ cursor: 'pointer' }}
                    data-testid={`mock-draft-${draft.id}`}
                  >
                    <TableCell>{draft.policy}</TableCell>
                    <TableCell>{draft.weight_set_name ?? 'Default'}</TableCell>
                    <TableCell>
                      {formatWhen(draft.projection_imported_at)}
                    </TableCell>
                    <TableCell>{formatWhen(draft.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {detail ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {detail.policy} on season totals. Pool of {detail.pool_size}.
              Projections imported {formatWhen(detail.projection_imported_at)}.
              {detail.weights == null ? (
                <>
                  Each overall pick is the same player in all 8 permutations,
                  because every team uses that ranking.
                </>
              ) : (
                <>
                  Team Chino ranks by {detail.weight_set_name} and the other
                  seven teams by unweighted Total-Z, so Chino&apos;s picks
                  differ per slot.
                </>
              )}{' '}
              This snapshot shows which slot wins, and where {detail.user_team}{' '}
              finishes from that slot.
              Projected roto standings, all 16 rostered players, no injury or
              lineup modelling.
            </Typography>
            <MockDraftRunsTable
              runs={detail.runs}
              userTeam={detail.user_team}
              selectedSlot={selectedSlot}
              onSelectRun={setSelectedSlot}
            />
            {selectedRun ? (
              <Stack spacing={2}>
                <Typography variant="h6" component="h2">
                  Slot {selectedRun.user_slot}
                </Typography>
                <MockDraftBoard run={selectedRun} userTeam={detail.user_team} />
                <MockDraftStandings
                  standings={selectedRun.standings}
                  userTeam={detail.user_team}
                />
              </Stack>
            ) : null}
          </Stack>
        ) : null}
        <WeightSetDialog
          open={weightDialog.open}
          mode={weightDialog.mode}
          initial={
            weightDialog.mode === 'edit'
              ? (activeWeightSet ?? undefined)
              : undefined
          }
          onClose={() => {
            setWeightDialog((current) => ({ ...current, open: false }))
          }}
          onSaved={handleWeightsSaved}
          onDeleted={handleWeightsDeleted}
        />
      </Stack>
    </Container>
  )
}
