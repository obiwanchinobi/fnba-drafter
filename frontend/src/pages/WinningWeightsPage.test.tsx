import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import { DEFAULT_WEIGHTS } from '../lib/catWeights.ts'
import theme from '../theme.ts'
import WinningWeightsPage from './WinningWeightsPage.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <WinningWeightsPage />
    </ThemeProvider>,
  )
}

const SAVED_AT = '2026-09-24T10:15:00.000Z'
const RUN_AT = '2026-09-26T09:00:00.000Z'
const IMPORTED_AT = '2026-09-22T03:00:00.000Z'

function when(iso: string): string {
  return new Date(iso).toLocaleString()
}

function weightSearchResult(
  options: { createdAt?: string; losingSlot?: number; seed?: number } = {},
) {
  const { createdAt = RUN_AT, losingSlot = 2, seed = 42 } = options
  return {
    budget: 500,
    seed,
    projection_imported_at: IMPORTED_AT,
    created_at: createdAt,
    runs: Array.from({ length: 8 }, (_, index) => {
      const n = index + 1
      const margin = n === losingSlot ? -1.5 : 3
      return {
        user_slot: n,
        weight_set_name: `Draft slot ${n}`,
        weights: { ...DEFAULT_WEIGHTS, blk: 2.5 + n / 100, to: 0.35 },
        rank: margin > 0 ? 1 : 3,
        roto_points: 90 + margin,
        margin,
        won: margin > 0,
        draft_order: ['Rival Team', 'Other Team', 'Team Chino'],
        standings: [
          {
            team: 'Team Chino',
            roto_points: 90 + margin,
            rank: margin > 0 ? 1 : 3,
            cats: { pts: { value: 2000, points: 8 } },
          },
          {
            team: 'Rival Team',
            roto_points: 90,
            rank: 2,
            cats: { pts: { value: 1900, points: 7 } },
          },
        ],
        picks: [
          {
            overall_pick: 3,
            round: 1,
            slot: 3,
            team: 'Team Chino',
            player_id: 100 + n,
            full_name: `Slot${n} Center`,
            positions: ['C'],
            nba_team: 'DEN',
            injury_status: null,
            roster_slot: 'C',
            z_total: 4.25,
            z_weighted: 7.5,
          },
        ],
      }
    }),
  }
}

type SearchResult = ReturnType<typeof weightSearchResult>

// Routes GET /api/weight_search to `saved` (404 when null) and POST to `post`.
function stubApi(
  saved: SearchResult | null,
  post: () => Promise<unknown> | unknown = () => ({
    ok: true,
    status: 201,
    json: async () => weightSearchResult(),
  }),
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/weight_search' && method === 'GET') {
      return saved
        ? { ok: true, status: 200, json: async () => saved }
        : { ok: false, status: 404, json: async () => ({}) }
    }
    if (url === '/api/weight_search' && method === 'POST') {
      return post()
    }
    throw new Error(`unexpected ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function loadSavedSearch(result: SearchResult = weightSearchResult()) {
  stubApi(result)
  renderPage()
  await screen.findByTestId('weight-search-slot-1')
}

test('explains the search and shows an empty state when nothing is saved', async () => {
  const fetchMock = stubApi(null)

  renderPage()

  expect(
    screen.getByRole('heading', { name: 'Winning weights' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/searches weight collections per draft slot/)).toBeInTheDocument()
  expect(screen.getByText('Loading winning weights…')).toBeInTheDocument()
  expect(await screen.findByText('No winning weights yet.')).toBeInTheDocument()
  expect(screen.queryByText('Loading winning weights…')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Last run/)).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Find winning weights' }),
  ).toBeEnabled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [input, init] = fetchMock.mock.calls[0]
  expect(String(input)).toBe('/api/weight_search')
  expect((init?.method ?? 'GET').toUpperCase()).toBe('GET')
})

test('loads the saved search on mount with when it ran and its projection import', async () => {
  const saved = weightSearchResult({ createdAt: SAVED_AT })
  const fetchMock = stubApi(saved)

  renderPage()

  expect(await screen.findByTestId('weight-search-slot-1')).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('Loses'),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      `Last run ${when(SAVED_AT)}, projections imported ${when(IMPORTED_AT)}`,
    ),
  ).toBeInTheDocument()
  expect(screen.queryByText('No winning weights yet.')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('a failed load shows the error alert', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  )

  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Failed to load winning weights (500)',
  )
  expect(screen.queryByText('Loading winning weights…')).not.toBeInTheDocument()
})

test('a load response without runs shows an error instead of results', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  )

  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unexpected winning weights response',
  )
  expect(screen.queryByTestId('weight-search-slot-1')).not.toBeInTheDocument()
  expect(screen.getByText('No winning weights yet.')).toBeInTheDocument()
})

test('Find winning weights posts the search and replaces the saved results', async () => {
  const saved = weightSearchResult({ createdAt: SAVED_AT, losingSlot: 2 })
  const fresh = weightSearchResult({ createdAt: RUN_AT, losingSlot: 5, seed: 7 })
  let resolveSearch: (value: unknown) => void = () => {}
  const fetchMock = stubApi(
    saved,
    () =>
      new Promise((resolve) => {
        resolveSearch = resolve
      }),
  )

  renderPage()
  await screen.findByTestId('weight-search-slot-1')
  fireEvent.click(screen.getByTestId('weight-search-slot-3'))
  expect(screen.getByRole('heading', { name: 'Slot 3' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Find winning weights' }))

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /Find winning weights/ }),
    ).toBeDisabled()
  })

  resolveSearch({ ok: true, status: 201, json: async () => fresh })

  await waitFor(() => {
    expect(
      within(screen.getByTestId('weight-search-slot-5')).getByText('Loses'),
    ).toBeInTheDocument()
  })
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('Wins'),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      `Last run ${when(RUN_AT)}, projections imported ${when(IMPORTED_AT)}`,
    ),
  ).toBeInTheDocument()
  expect(screen.queryByText(new RegExp(`Last run ${when(SAVED_AT)}`))).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Slot / })).not.toBeInTheDocument()
  expect(
    screen.getByText(/opponents draft strictly by Total-Z/),
  ).toBeInTheDocument()
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Find winning weights' }),
    ).toBeEnabled()
  })

  expect(fetchMock).toHaveBeenCalledTimes(2)
  const [input, init] = fetchMock.mock.calls[1]
  expect(String(input)).toBe('/api/weight_search')
  expect((init?.method ?? '').toUpperCase()).toBe('POST')
})

test('a failed weight search shows the error alert', async () => {
  stubApi(null, () => ({
    ok: false,
    status: 422,
    json: async () => ({ error: 'board_too_small' }),
  }))

  renderPage()
  await screen.findByText('No winning weights yet.')
  fireEvent.click(screen.getByRole('button', { name: 'Find winning weights' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Not enough draftable players to fill 8 teams × 16 rounds',
  )
  expect(screen.queryByTestId('weight-search-slot-1')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Find winning weights' }),
  ).toBeEnabled()
})

test('shows no drilldown until a slot is selected', async () => {
  await loadSavedSearch()

  expect(
    screen.queryByRole('table', { name: 'Mock draft board' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Slot / })).not.toBeInTheDocument()
})

test('clicking slot 3 shows its weights, draft board and standings', async () => {
  await loadSavedSearch()

  fireEvent.click(screen.getByTestId('weight-search-slot-3'))

  expect(screen.getByRole('heading', { name: 'Slot 3' })).toBeInTheDocument()
  expect(screen.getByTestId('weight-search-slot-3')).toHaveClass('Mui-selected')

  const weights = screen.getByRole('table', { name: 'Draft slot 3 weights' })
  expect(within(weights).getAllByRole('columnheader')).toHaveLength(19)
  expect(within(weights).getByRole('columnheader', { name: 'OREB' })).toBeInTheDocument()
  expect(within(weights).getByRole('columnheader', { name: 'DREB' })).toBeInTheDocument()
  expect(within(weights).queryByRole('columnheader', { name: 'REB' })).not.toBeInTheDocument()
  expect(within(weights).getByText('2.53')).toBeInTheDocument()
  expect(within(weights).getByText('0.35')).toBeInTheDocument()
  expect(within(weights).queryByRole('textbox')).not.toBeInTheDocument()

  const board = screen.getByRole('table', { name: 'Mock draft board' })
  expect(within(board).getByText(/Slot3 Center/)).toBeInTheDocument()
  expect(within(board).getByText('3 Team Chino')).toBeInTheDocument()
  expect(within(board).queryByText(/Slot1 Center/)).not.toBeInTheDocument()

  const standings = screen.getByRole('table', {
    name: 'Projected rotisserie standings',
  })
  expect(within(standings).getByText('Rival Team')).toBeInTheDocument()
  expect(within(standings).getByText('93')).toBeInTheDocument()
})

test('selecting another slot swaps the drilldown', async () => {
  await loadSavedSearch()

  fireEvent.click(screen.getByTestId('weight-search-slot-3'))
  fireEvent.click(screen.getByTestId('weight-search-slot-2'))

  expect(screen.getByRole('heading', { name: 'Slot 2' })).toBeInTheDocument()
  expect(
    screen.getByRole('table', { name: 'Draft slot 2 weights' }),
  ).toBeInTheDocument()
  const board = screen.getByRole('table', { name: 'Mock draft board' })
  expect(within(board).getByText(/Slot2 Center/)).toBeInTheDocument()
  expect(within(board).queryByText(/Slot3 Center/)).not.toBeInTheDocument()
})
