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

function slotRun(
  n: number,
  options: { createdAt?: string; winRate?: number; margin?: number } = {},
) {
  const { createdAt = SAVED_AT, winRate = 0.75, margin = 3 } = options
  return {
    user_slot: n,
    weight_set_name: `Draft slot ${n}`,
    weights: { ...DEFAULT_WEIGHTS, blk: 2.5 + n / 100, to: 0.35 },
    rank: margin > 0 ? 1 : 3,
    roto_points: 90 + margin,
    margin,
    win_rate: winRate,
    mean_margin: 1.5,
    worst_margin: -4,
    margins: [margin, 1, -4],
    scenario_count: 24,
    noise_sd: 1.2,
    budget: 300,
    seed: 42,
    source: 'fnba',
    season: 2026,
    projection_imported_at: IMPORTED_AT,
    created_at: createdAt,
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
}

type SlotRun = ReturnType<typeof slotRun>

function savedList(runs: SlotRun[] = [1, 2, 3].map((n) => slotRun(n))) {
  return { scenario_count: 24, runs }
}

type PostHandler = (userSlot: number) => Promise<unknown> | unknown

function created(run: SlotRun) {
  return { ok: true, status: 201, json: async () => run }
}

// Routes GET /api/weight_search to `saved` and POST to `post` with the slot.
function stubApi(
  saved: ReturnType<typeof savedList>,
  post: PostHandler = (userSlot) =>
    created(slotRun(userSlot, { createdAt: RUN_AT })),
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/weight_search' && method === 'GET') {
      return { ok: true, status: 200, json: async () => saved }
    }
    if (url === '/api/weight_search' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { user_slot: number }
      return post(body.user_slot)
    }
    throw new Error(`unexpected ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function postedSlots(fetchMock: ReturnType<typeof stubApi>): number[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST')
    .map(([, init]) => (JSON.parse(String(init?.body)) as { user_slot: number }).user_slot)
}

async function loadSaved(saved = savedList()) {
  const fetchMock = stubApi(saved)
  renderPage()
  await screen.findByTestId(`weight-search-slot-${saved.runs[0].user_slot}`)
  return fetchMock
}

test('explains the scenarios and shows an empty state when nothing is saved', async () => {
  const fetchMock = stubApi(savedList([]))

  renderPage()

  expect(
    screen.getByRole('heading', { name: 'Winning weights' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Loading winning weights…')).toBeInTheDocument()
  expect(await screen.findByText('No winning weights yet.')).toBeInTheDocument()
  expect(screen.queryByText('Loading winning weights…')).not.toBeInTheDocument()

  const intro = screen.getByText(/searches weight collections for one Team Chino/)
  expect(intro).toHaveTextContent('scored across 24 modelled draft rooms')
  expect(intro).toHaveTextContent('drafts from Total-Z or ESPN rank with random noise')
  expect(intro).toHaveTextContent('Win rate is the share of scenarios')
  expect(intro).toHaveTextContent('scenario 0 is the base room')
  expect(intro).toHaveTextContent('under about 60 percent as competitive, not winning')
  expect(screen.queryByText(/^Wins [+-]/)).not.toBeInTheDocument()

  expect(
    screen.getByRole('button', { name: 'Find winning weights for slot 1' }),
  ).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Run all slots' })).toBeEnabled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [input, init] = fetchMock.mock.calls[0]
  expect(String(input)).toBe('/api/weight_search')
  expect((init?.method ?? 'GET').toUpperCase()).toBe('GET')
})

test('loads saved runs on mount and shows only the slots that exist', async () => {
  const fetchMock = await loadSaved(savedList([slotRun(2), slotRun(6)]))

  expect(screen.getByTestId('weight-search-slot-2')).toBeInTheDocument()
  expect(screen.getByTestId('weight-search-slot-6')).toBeInTheDocument()
  expect(screen.queryByTestId('weight-search-slot-3')).not.toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('18 of 24'),
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

test('the slot picker defaults to slot 1 and relabels the run button', async () => {
  await loadSaved()

  const picker = screen.getByRole('combobox', { name: 'Draft slot' })
  expect(picker).toHaveTextContent('Slot 1')

  fireEvent.mouseDown(picker)
  const options = await screen.findAllByRole('option')
  expect(options.map((option) => option.textContent)).toEqual(
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Slot ${n}`),
  )
  fireEvent.click(screen.getByRole('option', { name: 'Slot 3' }))

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Find winning weights for slot 3' }),
    ).toBeInTheDocument()
  })
})

test('running one slot posts that slot and replaces only its row', async () => {
  let resolveSearch: (value: unknown) => void = () => {}
  const fetchMock = stubApi(
    savedList(),
    () =>
      new Promise((resolve) => {
        resolveSearch = resolve
      }),
  )
  renderPage()
  await screen.findByTestId('weight-search-slot-1')

  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Draft slot' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Slot 2' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Find winning weights for slot 2' }),
  )

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /Find winning weights for slot 2/ }),
    ).toBeDisabled()
  })
  expect(screen.getByRole('button', { name: 'Run all slots' })).toBeDisabled()

  resolveSearch(created(slotRun(2, { createdAt: RUN_AT, winRate: 0.5 })))

  await waitFor(() => {
    expect(
      within(screen.getByTestId('weight-search-slot-2')).getByText('12 of 24'),
    ).toBeInTheDocument()
  })
  const slot2 = within(screen.getByTestId('weight-search-slot-2'))
  expect(slot2.getByText(when(RUN_AT))).toBeInTheDocument()
  for (const n of [1, 3]) {
    const row = within(screen.getByTestId(`weight-search-slot-${n}`))
    expect(row.getByText('18 of 24')).toBeInTheDocument()
    expect(row.getByText(when(SAVED_AT))).toBeInTheDocument()
  }
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Find winning weights for slot 2' }),
    ).toBeEnabled()
  })

  expect(postedSlots(fetchMock)).toEqual([2])
  const post = fetchMock.mock.calls[1]
  expect(String(post[0])).toBe('/api/weight_search')
  expect(JSON.parse(String(post[1]?.body))).toEqual({ user_slot: 2 })
})

test('running a slot with no saved run adds its row in slot order', async () => {
  const fetchMock = stubApi(savedList([slotRun(3)]))
  renderPage()
  await screen.findByTestId('weight-search-slot-3')

  fireEvent.click(
    screen.getByRole('button', { name: 'Find winning weights for slot 1' }),
  )

  await screen.findByTestId('weight-search-slot-1')
  const rows = screen
    .getAllByTestId(/^weight-search-slot-/)
    .map((row) => row.getAttribute('data-testid'))
  expect(rows).toEqual(['weight-search-slot-1', 'weight-search-slot-3'])
  expect(postedSlots(fetchMock)).toEqual([1])
})

test('run all posts slots 1 to 8 in order and shows progress', async () => {
  const pending: Array<(value: unknown) => void> = []
  const fetchMock = stubApi(
    savedList([]),
    () =>
      new Promise((resolve) => {
        pending.push(resolve)
      }),
  )
  renderPage()
  await screen.findByText('No winning weights yet.')

  fireEvent.click(screen.getByRole('button', { name: 'Run all slots' }))

  for (let n = 1; n <= 8; n += 1) {
    expect(await screen.findByRole('status')).toHaveTextContent(`Slot ${n} of 8`)
    await waitFor(() => {
      expect(pending).toHaveLength(n)
    })
    expect(
      screen.getByRole('button', { name: /Find winning weights for slot/ }),
    ).toBeDisabled()
    pending[n - 1](created(slotRun(n, { createdAt: RUN_AT })))
    await screen.findByTestId(`weight-search-slot-${n}`)
  }

  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: 'Run all slots' })).toBeEnabled()
  expect(postedSlots(fetchMock)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
}, 15000)

test('an error from one slot stops run all and shows the alert', async () => {
  const fetchMock = stubApi(savedList([]), (userSlot) =>
    userSlot === 3
      ? {
          ok: false,
          status: 422,
          json: async () => ({ error: 'board_too_small' }),
        }
      : created(slotRun(userSlot, { createdAt: RUN_AT })),
  )
  renderPage()
  await screen.findByText('No winning weights yet.')

  fireEvent.click(screen.getByRole('button', { name: 'Run all slots' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Not enough draftable players to fill 8 teams × 16 rounds',
  )
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Run all slots' })).toBeEnabled()
  })
  expect(postedSlots(fetchMock)).toEqual([1, 2, 3])
  expect(screen.getByTestId('weight-search-slot-1')).toBeInTheDocument()
  expect(screen.getByTestId('weight-search-slot-2')).toBeInTheDocument()
  expect(screen.queryByTestId('weight-search-slot-3')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('an invalid slot error from a single run shows the alert', async () => {
  stubApi(savedList([]), () => ({
    ok: false,
    status: 422,
    json: async () => ({ error: 'invalid_slot' }),
  }))
  renderPage()
  await screen.findByText('No winning weights yet.')

  fireEvent.click(
    screen.getByRole('button', { name: 'Find winning weights for slot 1' }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Draft slot must be a whole number from 1 to 8',
  )
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Find winning weights for slot 1' }),
    ).toBeEnabled()
  })
})

test('shows no drilldown until a slot is selected', async () => {
  await loadSaved()

  expect(
    screen.queryByRole('table', { name: 'Mock draft board' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Slot / })).not.toBeInTheDocument()
})

test('clicking slot 3 shows its weights, relative weights, base board and standings', async () => {
  await loadSaved()

  fireEvent.click(screen.getByTestId('weight-search-slot-3'))

  expect(screen.getByRole('heading', { name: 'Slot 3' })).toBeInTheDocument()
  expect(screen.getByTestId('weight-search-slot-3')).toHaveClass('Mui-selected')
  expect(
    screen.getByText(
      `Last run ${when(SAVED_AT)}, projections imported ${when(IMPORTED_AT)}, 300 collections searched. Wins 18 of 24 scenarios.`,
    ),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/board and standings below are scenario 0/),
  ).toBeInTheDocument()

  const weights = screen.getByRole('table', { name: 'Draft slot 3 weights' })
  expect(within(weights).getByRole('columnheader', { name: 'OREB' })).toBeInTheDocument()
  expect(within(weights).getByRole('columnheader', { name: 'DREB' })).toBeInTheDocument()
  expect(within(weights).queryByRole('columnheader', { name: 'REB' })).not.toBeInTheDocument()
  expect(
    within(weights)
      .getAllByRole('columnheader')
      .filter((cell) => cell.textContent !== ''),
  ).toHaveLength(19)
  expect(within(weights).queryByRole('textbox')).not.toBeInTheDocument()

  const raw = within(weights).getByRole('row', { name: /^Weight/ })
  expect(within(raw).getByText('2.53')).toBeInTheDocument()
  expect(within(raw).getByText('0.35')).toBeInTheDocument()

  // 17 cats at 1, blk 2.53, to 0.35: sum 19.88, mean 19.88 / 19.
  const mean = 19.88 / 19
  const relative = within(weights).getByRole('row', { name: /^Relative to mean/ })
  expect(
    within(relative).getByText(String(Number((2.53 / mean).toFixed(2)))),
  ).toBeInTheDocument()
  expect(
    within(relative).getByText(String(Number((0.35 / mean).toFixed(2)))),
  ).toBeInTheDocument()
  expect(
    within(relative).getAllByText(String(Number((1 / mean).toFixed(2)))),
  ).toHaveLength(17)

  const board = screen.getByRole('table', { name: 'Mock draft board' })
  expect(within(board).getByText(/Slot3 Center/)).toBeInTheDocument()
  expect(within(board).getByText('3 Team Chino')).toBeInTheDocument()
  expect(within(board).queryByText(/Slot1 Center/)).not.toBeInTheDocument()

  const standings = screen.getByRole('table', {
    name: 'Projected rotisserie standings',
  })
  expect(within(standings).getByText('Rival Team')).toBeInTheDocument()
  expect(within(standings).getByText('93')).toBeInTheDocument()
  expect(within(standings).getByText('2000')).toBeInTheDocument()
  expect(within(standings).getByText('1900')).toBeInTheDocument()
})

test('selecting another slot swaps the drilldown', async () => {
  await loadSaved()

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
