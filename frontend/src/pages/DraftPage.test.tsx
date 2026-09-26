import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import type { DraftPick, DraftState } from '../api/draft.ts'
import type { Projection } from '../api/projections.ts'
import type { WeightSet } from '../api/weightSets.ts'
import { DEFAULT_WEIGHTS } from '../lib/catWeights.ts'
import theme from '../theme.ts'
import DraftPage from './DraftPage.tsx'

function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  )
}

function renderPage(ui: ReactElement, initialEntries: string[] = ['/draft']) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

function projectionRow(
  overrides: Partial<Projection> &
    Pick<Projection, 'id' | 'full_name' | 'positions' | 'nba_team'>,
): Projection {
  const nameParts = overrides.full_name.split(' ')
  return {
    player_id: overrides.id,
    espn_player_id: overrides.id,
    first_name: nameParts[0] ?? '',
    last_name: nameParts.slice(1).join(' '),
    injury_status: null,
    source: 'espn',
    season: 2027,
    gp: 82,
    min: 2870,
    fgm: 800,
    fga: 1400,
    fg_pct: 800 / 1400,
    ftm: 400,
    fta: 500,
    ft_pct: 400 / 500,
    tpm: 160,
    tpa: 400,
    tp_pct: 160 / 400,
    oreb: 100,
    dreb: 500,
    ast: 400,
    ato: 2,
    stl: 80,
    str: 1,
    blk: 40,
    to: 200,
    pf: 160,
    dd: 40,
    td: 5,
    pts: 2000,
    ppm: 2000 / 2870,
    imported_at: '2026-09-18T12:00:00.000Z',
    missing_stat_keys: [],
    estimated_stat_keys: [],
    espn_roto_rank: overrides.id,
    dataset: 'projection',
    prior_season: null,
    ...overrides,
  }
}

const ROWS: Projection[] = [
  projectionRow({
    id: 1,
    full_name: 'Nikola Jokic',
    positions: ['C'],
    nba_team: 'DEN',
    pts: 2050,
  }),
  projectionRow({
    id: 2,
    full_name: 'Shai Gilgeous-Alexander',
    positions: ['PG'],
    nba_team: 'OKC',
    pts: 2500,
  }),
  projectionRow({
    id: 3,
    full_name: 'Jayson Tatum',
    positions: ['SF', 'PF'],
    nba_team: 'BOS',
    pts: 1500,
  }),
]

// Foul Light leads Total Z on fouls; zeroing PF lifts Foul Heavy on blocks.
const FOUL_ROWS: Projection[] = [
  projectionRow({
    id: 1,
    full_name: 'Foul Light',
    positions: ['C'],
    nba_team: 'DEN',
    pf: 80,
    blk: 40,
  }),
  projectionRow({
    id: 2,
    full_name: 'Foul Average',
    positions: ['SF'],
    nba_team: 'BOS',
    pf: 160,
    blk: 30,
  }),
  projectionRow({
    id: 3,
    full_name: 'Foul Heavy',
    positions: ['PG'],
    nba_team: 'OKC',
    pf: 240,
    blk: 80,
  }),
]

const BENCH_FOULS: WeightSet = {
  id: 9,
  name: 'Bench fouls',
  weights: { ...DEFAULT_WEIGHTS, pf: 0 },
  updated_at: '2026-09-22T12:00:00.000Z',
}

const JOKIC_PICK: DraftPick = {
  overall_pick: 1,
  round: 1,
  slot: 1,
  team: 'Trust in Pizza',
  espn_team_id: 4,
  espn_player_id: 3112335,
  player_id: 1,
  full_name: 'Nikola Jokic',
  positions: ['C'],
  nba_team: 'DEN',
  injury_status: 'ACTIVE',
}

const SGA_PICK: DraftPick = {
  overall_pick: 2,
  round: 1,
  slot: 2,
  team: 'Team Chino',
  espn_team_id: 5,
  espn_player_id: 4278073,
  player_id: 2,
  full_name: 'Shai Gilgeous-Alexander',
  positions: ['PG'],
  nba_team: 'OKC',
  injury_status: null,
}

const TATUM_PICK: DraftPick = {
  overall_pick: 2,
  round: 1,
  slot: 2,
  team: 'Team Chino',
  espn_team_id: 5,
  espn_player_id: 4065648,
  player_id: 3,
  full_name: 'Jayson Tatum',
  positions: ['SF', 'PF'],
  nba_team: 'BOS',
  injury_status: null,
}

function draftState(overrides: Partial<DraftState> = {}): DraftState {
  return {
    season: 2027,
    draft_order: [
      'Trust in Pizza',
      'Team Chino',
      'Team 3',
      'Team 4',
      'Team 5',
      'Team 6',
      'Team 7',
      'Team 8',
    ],
    user_team: 'Team Chino',
    user_espn_team_id: 5,
    in_progress: true,
    drafted: false,
    refreshed_at: '2026-09-26T11:05:00Z',
    picks: [JOKIC_PICK],
    ...overrides,
  }
}

function jsonBody(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

function stubDraft(options: {
  draft: DraftState
  refresh?: () => ReturnType<typeof jsonBody>
  rows?: Projection[]
  weightSets?: WeightSet[]
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/draft/refresh' && method === 'POST') {
      return options.refresh ? options.refresh() : jsonBody(options.draft)
    }
    if (url === '/api/draft') return jsonBody(options.draft)
    if (url.includes('/api/weight_sets')) {
      return jsonBody(options.weightSets ?? [])
    }
    return jsonBody(options.rows ?? ROWS)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function playerNames() {
  const table = screen.getByRole('table')
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent)
}

function rowFor(playerName: string): HTMLTableRowElement {
  const row = screen.getByText(playerName).closest('tr')
  expect(row).not.toBeNull()
  return row as HTMLTableRowElement
}

function cellByHeader(playerName: string, header: string) {
  const cells = within(rowFor(playerName)).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((column) => column.textContent)
  const index = headers.indexOf(header)
  expect(index).toBeGreaterThan(-1)
  return cells[index]
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect

function viewportRect() {
  return {
    width: 1200,
    height: 2000,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 2000,
    x: 0,
    y: 0,
    toJSON() {},
  }
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = () => viewportRect()
})

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('marks drafted players with the pick and greys their row', async () => {
  const fetchMock = stubDraft({ draft: draftState() })

  renderPage(<DraftPage />)

  expect(
    await screen.findByRole('heading', { name: 'Draft night' }),
  ).toBeInTheDocument()
  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith('/api/draft')

  await waitFor(() => {
    expect(cellByHeader('Nikola Jokic', 'Drafted')).toHaveTextContent(
      '#1 Trust in Pizza',
    )
  })
  expect(rowFor('Nikola Jokic')).toHaveAttribute('data-drafted', 'true')
  expect(cellByHeader('Jayson Tatum', 'Drafted').textContent).toBe('')
  expect(rowFor('Jayson Tatum')).not.toHaveAttribute('data-drafted')
  expect(
    screen.getByText(
      `Last refreshed ${new Date('2026-09-26T11:05:00Z').toLocaleString()}`,
    ),
  ).toBeInTheDocument()
})

test('shows the order strip and whose pick it is, then updates after a refresh', async () => {
  const refreshed = draftState({
    refreshed_at: '2026-09-26T11:07:00Z',
    picks: [JOKIC_PICK, SGA_PICK],
  })
  stubDraft({ draft: draftState(), refresh: () => jsonBody(refreshed) })

  renderPage(<DraftPage />)

  expect(
    await screen.findByText(
      'Pick 2 of 136, round 1: Team Chino. You are on the clock.',
    ),
  ).toBeInTheDocument()
  const chips = within(
    screen.getByRole('list', { name: 'Draft order' }),
  ).getAllByRole('listitem')
  expect(chips.map((chip) => chip.textContent)).toEqual([
    '1 Trust in Pizza',
    '2 Team Chino',
    '3 Team 3',
    '4 Team 4',
    '5 Team 5',
    '6 Team 6',
    '7 Team 7',
    '8 Team 8',
  ])
  expect(chips[1]).toHaveAttribute('data-on-clock', 'true')
  expect(chips[1]).toHaveAttribute('data-user', 'true')

  fireEvent.click(screen.getByRole('button', { name: 'Refresh picks' }))

  expect(
    await screen.findByText(
      'Pick 3 of 136, round 1: Team 3. Your next pick is #15 (12 picks away).',
    ),
  ).toBeInTheDocument()
  expect(chips[2]).toHaveAttribute('data-on-clock', 'true')
  expect(chips[1]).not.toHaveAttribute('data-on-clock')
})

test('opens on the z view sorted by Total Z', async () => {
  stubDraft({ draft: draftState() })

  renderPage(<DraftPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/draft?view=z&sort=z_total',
  )
  expect(
    screen.getByRole('columnheader', { name: /Total Z/ }),
  ).toBeInTheDocument()
})

test('shows the Weights select on first render with the saved collections', async () => {
  stubDraft({ draft: draftState(), weightSets: [BENCH_FOULS] })

  renderPage(<DraftPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  const weights = screen.getByRole('combobox', { name: /weights/i })
  expect(weights).toHaveTextContent('Default')
  expect(screen.getByRole('button', { name: 'New weights' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit weights' })).toBeDisabled()

  fireEvent.mouseDown(weights)

  expect(
    within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Default', 'Bench fouls'])
})

test('choosing a collection sorts by Weighted Z and the choice survives Refresh picks', async () => {
  const refreshed = draftState({
    refreshed_at: '2026-09-26T11:07:00Z',
    picks: [
      {
        ...JOKIC_PICK,
        player_id: 1,
        full_name: 'Foul Light',
        positions: ['C'],
        nba_team: 'DEN',
      },
    ],
  })
  stubDraft({
    draft: draftState({ picks: [] }),
    refresh: () => jsonBody(refreshed),
    rows: FOUL_ROWS,
    weightSets: [BENCH_FOULS],
  })

  renderPage(<DraftPage />)

  expect(await screen.findByText('Foul Heavy')).toBeInTheDocument()
  expect(playerNames()).toEqual(['Foul Light', 'Foul Heavy', 'Foul Average'])
  expect(screen.getByRole('columnheader', { name: 'Total Z' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /weights/i }))
  fireEvent.click(await screen.findByRole('option', { name: 'Bench fouls' }))

  expect(playerNames()).toEqual(['Foul Heavy', 'Foul Light', 'Foul Average'])
  expect(
    screen.getByRole('columnheader', { name: 'Weighted Z' }),
  ).toHaveAttribute('aria-sort', 'descending')
  expect(
    screen.getByRole('columnheader', { name: 'Total Z' }),
  ).not.toHaveAttribute('aria-sort')
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Bench fouls',
  )
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/draft?view=z&weights=9&sort=z_weighted',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Refresh picks' }))

  await waitFor(() => {
    expect(cellByHeader('Foul Light', 'Drafted')).toHaveTextContent(
      '#1 Trust in Pizza',
    )
  })
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Bench fouls',
  )
  expect(playerNames()).toEqual(['Foul Heavy', 'Foul Light', 'Foul Average'])
  expect(
    screen.getByRole('columnheader', { name: 'Weighted Z' }),
  ).toHaveAttribute('aria-sort', 'descending')
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/draft?view=z&weights=9&sort=z_weighted',
  )
  expect(
    screen.getByText(/Weighted Z applies "Bench fouls"/),
  ).toBeInTheDocument()
})

test('Hide drafted removes drafted rows and restores them when toggled off', async () => {
  stubDraft({ draft: draftState() })

  renderPage(<DraftPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  await waitFor(() => {
    expect(rowFor('Nikola Jokic')).toHaveAttribute('data-drafted', 'true')
  })

  fireEvent.click(screen.getByRole('switch', { name: 'Hide drafted' }))

  expect(screen.queryByText('Nikola Jokic')).not.toBeInTheDocument()
  expect(screen.getByText('Jayson Tatum')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('switch', { name: 'Hide drafted' }))

  expect(screen.getByText('Nikola Jokic')).toBeInTheDocument()
})

test('Refresh picks posts to the draft refresh endpoint and shows the new pick', async () => {
  const refreshed = draftState({
    refreshed_at: '2026-09-26T11:07:00Z',
    picks: [JOKIC_PICK, SGA_PICK],
  })
  const fetchMock = stubDraft({
    draft: draftState(),
    refresh: () => jsonBody(refreshed),
  })

  renderPage(<DraftPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  await waitFor(() => {
    expect(rowFor('Nikola Jokic')).toHaveAttribute('data-drafted', 'true')
  })
  expect(cellByHeader('Shai Gilgeous-Alexander', 'Drafted').textContent).toBe(
    '',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Refresh picks' }))

  await waitFor(() => {
    expect(cellByHeader('Shai Gilgeous-Alexander', 'Drafted')).toHaveTextContent(
      '#2 Team Chino',
    )
  })
  expect(rowFor('Shai Gilgeous-Alexander')).toHaveAttribute(
    'data-drafted',
    'true',
  )
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/draft/refresh',
    expect.objectContaining({ method: 'POST' }),
  )
  expect(
    screen.getByText(
      `Last refreshed ${new Date('2026-09-26T11:07:00Z').toLocaleString()}`,
    ),
  ).toBeInTheDocument()
})

test('a 503 from refresh shows the ESPN credentials message', async () => {
  stubDraft({
    draft: draftState({ refreshed_at: null, picks: [] }),
    refresh: () => jsonBody({ error: 'espn_credentials_missing' }, false, 503),
  })

  renderPage(<DraftPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(await screen.findByText('Not refreshed yet')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Refresh picks' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Log in to ESPN in Chrome/,
  )
  expect(rowFor('Nikola Jokic')).not.toHaveAttribute('data-drafted')
})

test('shows position counts and drafted total for Chino picks, updating after a refresh', async () => {
  const refreshed = draftState({
    refreshed_at: '2026-09-26T11:07:00Z',
    picks: [JOKIC_PICK, TATUM_PICK, { ...SGA_PICK, overall_pick: 3, slot: 3 }],
  })
  stubDraft({
    draft: draftState({ picks: [JOKIC_PICK, TATUM_PICK] }),
    refresh: () => jsonBody(refreshed),
  })

  renderPage(<DraftPage />)

  expect(await screen.findByText('Drafted 1 / 17')).toBeInTheDocument()
  const chips = () =>
    within(screen.getByRole('list', { name: 'Roster positions' }))
      .getAllByRole('listitem')
      .map((chip) => chip.textContent)
  expect(chips()).toEqual(['PG 0', 'SG 0', 'SF 1', 'PF 1', 'C 0'])

  fireEvent.click(screen.getByRole('button', { name: 'Refresh picks' }))

  expect(await screen.findByText('Drafted 2 / 17')).toBeInTheDocument()
  expect(chips()).toEqual(['PG 1', 'SG 0', 'SF 1', 'PF 1', 'C 0'])
})
