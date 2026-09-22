import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import { DEFAULT_WEIGHTS } from '../lib/catWeights.ts'
import { SCORED_CAT_IDS } from '../lib/statBasis.ts'
import theme from '../theme.ts'
import WeightSetDialog from './WeightSetDialog.tsx'

const WEIGHT_LABELS = [
  'FGM',
  'FG%',
  'FTM',
  'FT%',
  '3PM',
  '3P%',
  'OREB',
  'DREB',
  'AST',
  'A/TO',
  'STL',
  'STR',
  'BLK',
  'TO',
  'PF',
  'DD',
  'TD',
  'PTS',
  'PPM',
] as const

function renderDialog(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const idleDialog = {
  onClose: () => {},
  onSaved: () => {},
  onDeleted: () => {},
}

test('create mode renders 19 labelled number fields defaulting to 1', () => {
  renderDialog(<WeightSetDialog open mode="create" {...idleDialog} />)

  const inputs = screen.getAllByRole('spinbutton')
  expect(inputs).toHaveLength(19)
  expect(WEIGHT_LABELS).toHaveLength(SCORED_CAT_IDS.length)
  WEIGHT_LABELS.forEach((label, index) => {
    const field = screen.getByLabelText(label)
    expect(field).toBe(inputs[index])
    expect(field).toHaveAttribute('type', 'number')
    expect(field).toHaveAttribute('min', '0')
    expect(field).toHaveAttribute('max', '5')
    expect(field).toHaveAttribute('step', '0.05')
    expect(field).toHaveValue(1)
  })
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})

test('edit mode pre-fills name and weights from initial', () => {
  renderDialog(
    <WeightSetDialog
      open
      mode="edit"
      initial={{
        id: 4,
        name: 'Bench fouls',
        weights: { ...DEFAULT_WEIGHTS, pf: 0, pts: 0.8 },
        updated_at: '2026-09-22T12:00:00.000Z',
      }}
      {...idleDialog}
    />,
  )

  expect(screen.getByLabelText('Name')).toHaveValue('Bench fouls')
  expect(screen.getByLabelText('PF')).toHaveValue(0)
  expect(screen.getByLabelText('PTS')).toHaveValue(0.8)
  expect(screen.getByLabelText('FGM')).toHaveValue(1)
  expect(screen.getByLabelText('A/TO')).toHaveValue(1)
  expect(screen.getByLabelText('STR')).toHaveValue(1)
  expect(screen.getByLabelText('PPM')).toHaveValue(1)
})

test('Save with an empty name shows a validation message and does not call fetch', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  renderDialog(<WeightSetDialog open mode="create" {...idleDialog} />)

  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByText('Name is required')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByText('Name is required')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('Save rejects a weight outside 0 to 5 without calling fetch', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const onSaved = vi.fn()

  renderDialog(
    <WeightSetDialog
      open
      mode="create"
      onClose={() => {}}
      onSaved={onSaved}
      onDeleted={() => {}}
    />,
  )

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wide' } })
  fireEvent.change(screen.getByLabelText('PTS'), { target: { value: '5.05' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Each weight must be a number from 0 to 5',
  )
  expect(fetchMock).not.toHaveBeenCalled()
  expect(onSaved).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('PTS'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Each weight must be a number from 0 to 5',
  )
  expect(fetchMock).not.toHaveBeenCalled()
})

test('Save POSTs name and all 19 weights and calls onSaved with the response', async () => {
  const created = {
    id: 7,
    name: 'Punt fouls',
    weights: { ...DEFAULT_WEIGHTS, pf: 0, ppm: 5 },
    updated_at: '2026-09-22T15:00:00.000Z',
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => created,
    request: { input, init },
  }))
  vi.stubGlobal('fetch', fetchMock)
  const onSaved = vi.fn()

  renderDialog(
    <WeightSetDialog
      open
      mode="create"
      onClose={() => {}}
      onSaved={onSaved}
      onDeleted={() => {}}
    />,
  )

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: '  Punt fouls  ' },
  })
  fireEvent.change(screen.getByLabelText('PF'), { target: { value: '0' } })
  fireEvent.change(screen.getByLabelText('PPM'), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [, init] = fetchMock.mock.calls[0] ?? []
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/weight_sets')
  expect(init?.method).toBe('POST')
  expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
  const body = JSON.parse(String(init?.body)) as {
    name: string
    weights: Record<string, number>
  }
  expect(Object.keys(body).sort()).toEqual(['name', 'weights'])
  expect(body.name).toBe('Punt fouls')
  expect(Object.keys(body.weights).sort()).toEqual([...SCORED_CAT_IDS].sort())
  expect(body.weights.pf).toBe(0)
  expect(body.weights.ppm).toBe(5)
  for (const cat of SCORED_CAT_IDS) {
    if (cat === 'pf' || cat === 'ppm') continue
    expect(body.weights[cat]).toBe(1)
  }
})

test('edit mode Save PATCHes the collection and calls onSaved with the response', async () => {
  const updated = {
    id: 4,
    name: 'Bench fouls',
    weights: { ...DEFAULT_WEIGHTS, stl: 2 },
    updated_at: '2026-09-22T16:00:00.000Z',
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => updated,
    request: { input, init },
  }))
  vi.stubGlobal('fetch', fetchMock)
  const onSaved = vi.fn()

  renderDialog(
    <WeightSetDialog
      open
      mode="edit"
      initial={{
        id: 4,
        name: 'Bench fouls',
        weights: { ...DEFAULT_WEIGHTS },
        updated_at: '2026-09-22T12:00:00.000Z',
      }}
      onClose={() => {}}
      onSaved={onSaved}
      onDeleted={() => {}}
    />,
  )

  fireEvent.change(screen.getByLabelText('STL'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated))
  const [, init] = fetchMock.mock.calls[0] ?? []
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/weight_sets/4')
  expect(init?.method).toBe('PATCH')
  const body = JSON.parse(String(init?.body)) as {
    name: string
    weights: Record<string, number>
  }
  expect(body.name).toBe('Bench fouls')
  expect(body.weights.stl).toBe(2)
  expect(Object.keys(body.weights)).toHaveLength(19)
})

test('a 422 response renders its details text in the dialog', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: 'invalid', details: ['Weights is missing pf'] }),
    })),
  )
  const onSaved = vi.fn()

  renderDialog(
    <WeightSetDialog
      open
      mode="create"
      onClose={() => {}}
      onSaved={onSaved}
      onDeleted={() => {}}
    />,
  )

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Bench fouls' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Weights is missing pf',
  )
  expect(onSaved).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('Delete requires a confirm step before DELETE and onDeleted', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  }))
  vi.stubGlobal('fetch', fetchMock)
  const onDeleted = vi.fn()
  const onClose = vi.fn()

  renderDialog(
    <WeightSetDialog
      open
      mode="edit"
      initial={{
        id: 9,
        name: 'Bench fouls',
        weights: { ...DEFAULT_WEIGHTS, pf: 0.4 },
        updated_at: '2026-09-22T12:00:00.000Z',
      }}
      onClose={onClose}
      onSaved={() => {}}
      onDeleted={onDeleted}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(screen.getByRole('button', { name: 'Are you sure' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
  expect(confirm).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Bench fouls edited' },
  })
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'Are you sure' }))

  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(9))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/weight_sets/9',
    expect.objectContaining({ method: 'DELETE' }),
  )
  expect(confirm).not.toHaveBeenCalled()
})

test('Reset to 1.00 sets every weight field back to 1', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  renderDialog(
    <WeightSetDialog
      open
      mode="edit"
      initial={{
        id: 4,
        name: 'Bench fouls',
        weights: { ...DEFAULT_WEIGHTS, pf: 0, pts: 2.5, ato: 0.8 },
        updated_at: '2026-09-22T12:00:00.000Z',
      }}
      {...idleDialog}
    />,
  )

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Keep me' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reset to 1.00' }))

  for (const label of WEIGHT_LABELS) {
    expect(screen.getByLabelText(label)).toHaveValue(1)
  }
  expect(screen.getByLabelText('Name')).toHaveValue('Keep me')
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})
