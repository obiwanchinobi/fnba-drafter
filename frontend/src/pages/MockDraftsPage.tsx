import { useEffect, useState } from 'react'
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
import { useNavigate, useParams } from 'react-router'
import {
  createMockDraft,
  fetchMockDraft,
  fetchMockDrafts,
  type MockDraft,
  type MockDraftSummary,
} from '../api/mockDrafts.ts'
import MockDraftBoard from '../components/MockDraftBoard.tsx'
import MockDraftRunsTable from '../components/MockDraftRunsTable.tsx'
import MockDraftStandings from '../components/MockDraftStandings.tsx'

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
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

  useEffect(() => {
    let cancelled = false
    fetchMockDrafts()
      .then((rows) => {
        if (!cancelled) setDrafts(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDrafts([])
          setError(
            err instanceof Error ? err.message : 'Failed to load mock drafts',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
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

  async function handleRun() {
    setRunning(true)
    setError(null)
    try {
      const created = await createMockDraft({ policy: 'fnba_total_z' })
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
        <Button
          variant="contained"
          onClick={() => void handleRun()}
          disabled={running}
          loading={running}
          sx={{ alignSelf: 'flex-start' }}
        >
          Run mock draft (FNBA Total-Z, season totals)
        </Button>
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
              Each overall pick is the same player in all 8 permutations,
              because every team uses that ranking. This snapshot shows which
              slot wins, and where {detail.user_team} finishes from that slot.
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
      </Stack>
    </Container>
  )
}
