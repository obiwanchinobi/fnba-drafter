import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import {
  createWeightSet,
  deleteWeightSet,
  updateWeightSet,
  type WeightSet,
} from '../api/weightSets.ts'
import {
  DEFAULT_WEIGHTS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_STEP,
  type CatWeights,
} from '../lib/catWeights.ts'
import { SCORED_CAT_IDS, type ScoredCat } from '../lib/statBasis.ts'

const WEIGHT_FIELD_LABELS: Record<ScoredCat, string> = {
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

type WeightSetDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  initial?: WeightSet
  onClose: () => void
  onSaved: (set: WeightSet) => void | Promise<void>
  onDeleted: (id: number) => void | Promise<void>
}

function weightsDraft(weights: CatWeights): Record<ScoredCat, string> {
  const draft = {} as Record<ScoredCat, string>
  for (const cat of SCORED_CAT_IDS) draft[cat] = String(weights[cat])
  return draft
}

function parsedWeights(draft: Record<ScoredCat, string>): CatWeights | null {
  const weights = {} as CatWeights
  for (const cat of SCORED_CAT_IDS) {
    const raw = draft[cat].trim()
    const value = Number(raw)
    if (
      raw === '' ||
      !Number.isFinite(value) ||
      value < WEIGHT_MIN ||
      value > WEIGHT_MAX
    ) {
      return null
    }
    weights[cat] = value
  }
  return weights
}

function WeightSetForm({
  mode,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: Omit<WeightSetDialogProps, 'open'>) {
  const [name, setName] = useState(() =>
    mode === 'edit' && initial ? initial.name : '',
  )
  const [draft, setDraft] = useState(() =>
    weightsDraft(
      mode === 'edit' && initial ? initial.weights : DEFAULT_WEIGHTS,
    ),
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleNameChange(value: string) {
    setDeleteArmed(false)
    setName(value)
  }

  function handleWeightChange(cat: ScoredCat, value: string) {
    setDeleteArmed(false)
    setDraft((current) => ({ ...current, [cat]: value }))
  }

  function handleReset() {
    setDeleteArmed(false)
    setDraft(weightsDraft(DEFAULT_WEIGHTS))
  }

  function handleCancel() {
    setDeleteArmed(false)
    onClose()
  }

  async function handleSave() {
    setDeleteArmed(false)
    const trimmed = name.trim()
    if (trimmed === '') {
      setFormError('Name is required')
      return
    }
    const weights = parsedWeights(draft)
    if (weights == null) {
      setFormError(
        `Each weight must be a number from ${WEIGHT_MIN} to ${WEIGHT_MAX}`,
      )
      return
    }
    if (mode === 'edit' && initial == null) return
    setFormError(null)
    setSaving(true)
    try {
      const input = { name: trimmed, weights }
      const saved =
        mode === 'edit' && initial
          ? await updateWeightSet(initial.id, input)
          : await createWeightSet(input)
      await onSaved(saved)
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save weights',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (initial == null || saving) return
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await deleteWeightSet(initial.id)
      await onDeleted(initial.id)
    } catch (err: unknown) {
      setDeleteArmed(false)
      setFormError(
        err instanceof Error ? err.message : 'Failed to save weights',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogTitle>
        {mode === 'create' ? 'New weights' : 'Edit weights'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {formError ? <Alert severity="error">{formError}</Alert> : null}
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Name"
          value={name}
          onChange={(event) => handleNameChange(event.target.value)}
        />
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          {SCORED_CAT_IDS.map((cat) => (
            <TextField
              key={cat}
              size="small"
              label={WEIGHT_FIELD_LABELS[cat]}
              type="number"
              value={draft[cat]}
              onChange={(event) => handleWeightChange(cat, event.target.value)}
              slotProps={{
                htmlInput: {
                  min: WEIGHT_MIN,
                  max: WEIGHT_MAX,
                  step: WEIGHT_STEP,
                },
              }}
              sx={{ width: 108 }}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          type="button"
          size="small"
          onClick={handleReset}
          sx={{ mr: 'auto' }}
        >
          Reset to 1.00
        </Button>
        {mode === 'edit' && initial ? (
          <Button
            type="button"
            size="small"
            color="error"
            onClick={() => {
              void handleDelete()
            }}
            disabled={saving && deleteArmed}
          >
            {deleteArmed ? 'Are you sure' : 'Delete'}
          </Button>
        ) : null}
        <Button
          type="button"
          size="small"
          onClick={handleCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="small"
          variant="contained"
          onClick={() => {
            void handleSave()
          }}
          disabled={saving}
        >
          Save
        </Button>
      </DialogActions>
    </>
  )
}

export default function WeightSetDialog({
  open,
  mode,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: WeightSetDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {open ? (
        <WeightSetForm
          key={mode === 'edit' && initial ? `edit-${initial.id}` : 'create'}
          mode={mode}
          initial={initial}
          onClose={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      ) : null}
    </Dialog>
  )
}
