import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import { DEFAULT_WEIGHTS } from '../lib/catWeights.ts'
import theme from '../theme.ts'
import WeightsPage from './WeightsPage.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <WeightsPage />
    </ThemeProvider>,
  )
}

const LABELS = [
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
]

const FIRST_UPDATED = '2026-09-24T10:15:00.000Z'
const SECOND_UPDATED = '2026-09-25T08:30:00.000Z'

const WEIGHT_SETS = [
  {
    id: 7,
    name: 'Draft slot 1',
    weights: { ...DEFAULT_WEIGHTS, fgm: 1.05, to: 0, blk: 4.45 },
    updated_at: FIRST_UPDATED,
  },
  {
    id: 3,
    name: 'Punt TO & PF',
    weights: { ...DEFAULT_WEIGHTS, to: 0, pf: 0, pts: 2.5 },
    updated_at: SECOND_UPDATED,
  },
]

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function cellTexts(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '')
}

test('renders a heading and a table with name, updated and every scored category', async () => {
  const fetchMock = stubFetch(WEIGHT_SETS)

  renderPage()

  expect(screen.getByRole('heading', { name: 'Weights' })).toBeInTheDocument()
  const table = await screen.findByRole('table', { name: 'Custom weights' })
  expect(fetchMock).toHaveBeenCalledWith('/api/weight_sets')
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent)
  expect(headers).toEqual(['Name', 'Updated', ...LABELS])
})

test('renders one row per collection in API order with its weights', async () => {
  stubFetch(WEIGHT_SETS)

  renderPage()

  await screen.findByRole('table', { name: 'Custom weights' })
  const first = screen.getByTestId('weight-set-7')
  const second = screen.getByTestId('weight-set-3')
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()

  const firstCells = cellTexts(first)
  expect(firstCells).toHaveLength(2 + LABELS.length)
  expect(firstCells[0]).toBe('Draft slot 1')
  expect(firstCells[1]).toBe(new Date(FIRST_UPDATED).toLocaleString())
  expect(firstCells[2 + LABELS.indexOf('FGM')]).toBe('1.05')
  expect(firstCells[2 + LABELS.indexOf('TO')]).toBe('0')
  expect(firstCells[2 + LABELS.indexOf('BLK')]).toBe('4.45')
  expect(firstCells[2 + LABELS.indexOf('PTS')]).toBe('1')

  const secondCells = cellTexts(second)
  expect(secondCells[0]).toBe('Punt TO & PF')
  expect(secondCells[1]).toBe(new Date(SECOND_UPDATED).toLocaleString())
  expect(secondCells[2 + LABELS.indexOf('PF')]).toBe('0')
  expect(secondCells[2 + LABELS.indexOf('PTS')]).toBe('2.5')
})

test('renders a dash for a missing weight', async () => {
  const partial: Record<string, number> = { ...DEFAULT_WEIGHTS }
  delete partial.ppm
  stubFetch([
    {
      id: 9,
      name: 'Partial',
      weights: partial,
      updated_at: FIRST_UPDATED,
    },
  ])

  renderPage()

  await screen.findByRole('table', { name: 'Custom weights' })
  const cells = cellTexts(screen.getByTestId('weight-set-9'))
  expect(cells[2 + LABELS.indexOf('PPM')]).toBe('—')
})

test('renders an empty state when there are no collections', async () => {
  stubFetch([])

  renderPage()

  expect(
    await screen.findByText(
      'No custom weights yet. Save one from Projections or Mock drafts.',
    ),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('table', { name: 'Custom weights' }),
  ).not.toBeInTheDocument()
})

test('renders an error alert when the request fails', async () => {
  stubFetch({ error: 'Database unavailable' }, false, 500)

  renderPage()

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Database unavailable')
  expect(
    screen.queryByRole('table', { name: 'Custom weights' }),
  ).not.toBeInTheDocument()
})
