import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import type { Projection } from '../api/projections.ts'
import { DEFAULT_WEIGHTS } from '../lib/catWeights.ts'
import theme from '../theme.ts'
import ProjectionsPage from './ProjectionsPage.tsx'

function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  )
}

function renderPage(
  ui: ReactElement,
  initialEntries: string[] = ['/projections'],
) {
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
    oreb: 80,
    dreb: 400,
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

const THREE_ROWS: Projection[] = [
  projectionRow({
    id: 1,
    espn_player_id: 3112335,
    first_name: 'Nikola',
    last_name: 'Jokic',
    full_name: 'Nikola Jokic',
    positions: ['C'],
    nba_team: 'DEN',
    pts: 2050,
    oreb: null,
    dreb: null,
    pf: null,
    dd: null,
    td: null,
    missing_stat_keys: ['oreb', 'dreb', 'pf', 'dd', 'td'],
    espn_roto_rank: 1,
  }),
  projectionRow({
    id: 2,
    first_name: 'Shai',
    last_name: 'Gilgeous-Alexander',
    full_name: 'Shai Gilgeous-Alexander',
    positions: ['PG'],
    nba_team: 'OKC',
    pts: 2500,
    espn_roto_rank: 2,
  }),
  projectionRow({
    id: 3,
    first_name: 'Jayson',
    last_name: 'Tatum',
    full_name: 'Jayson Tatum',
    positions: ['SF', 'PF'],
    nba_team: 'BOS',
    pts: 1500,
    oreb: 0,
    espn_roto_rank: 3,
  }),
]

function jsonBody(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

function stubProjections(
  rows: Projection[],
  weightSets: {
    id: number
    name: string
    weights: Record<string, number>
    updated_at: string
  }[] = [],
) {
  let sets = weightSets.map((set) => ({
    ...set,
    weights: { ...set.weights },
  }))
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.includes('/api/weight_sets')) {
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          name?: string
          weights?: Record<string, number>
        }
        const created = {
          id: Math.max(0, ...sets.map((set) => set.id)) + 1,
          name: body.name ?? '',
          weights: body.weights ?? {},
          updated_at: '2026-09-22T12:00:00.000Z',
        }
        sets = [...sets, created]
        return jsonBody(created)
      }
      if (method === 'PATCH') {
        const id = Number(url.split('/').pop())
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          name?: string
          weights?: Record<string, number>
        }
        const existing = sets.find((set) => set.id === id)
        const updated = {
          id,
          name: body.name ?? existing?.name ?? '',
          weights: body.weights ?? existing?.weights ?? {},
          updated_at: '2026-09-23T12:00:00.000Z',
        }
        sets = sets.map((set) => (set.id === id ? updated : set))
        return jsonBody(updated)
      }
      if (method === 'DELETE') {
        const id = Number(url.split('/').pop())
        sets = sets.filter((set) => set.id !== id)
        return jsonBody({})
      }
      return jsonBody(sets)
    }
    return jsonBody(rows)
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

function cellByHeader(playerName: string, header: string) {
  const row = screen.getByText(playerName).closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
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

test('shows empty-state copy to use Update from source when there are no rows', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/api/weight_sets')) return jsonBody([])
    return jsonBody([])
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage(<ProjectionsPage />)

  expect(
    await screen.findByRole('heading', { name: '2026–27 projections' }),
  ).toBeInTheDocument()
  expect(
    await screen.findByText(/No projections yet\. Use Update from source\./),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /update from source/i }),
  ).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/projections?source=espn&season=2027',
  )
})

test('shows the player name from a mocked projection row', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/weight_sets')) return jsonBody([])
      return {
        ok: true,
        json: async () => [
          {
            id: 1,
            player_id: 1,
            espn_player_id: 3112335,
            first_name: 'Nikola',
            last_name: 'Jokic',
            full_name: 'Nikola Jokic',
            positions: ['C'],
            nba_team: 'DEN',
            injury_status: null,
            source: 'espn',
            season: 2027,
            gp: 82,
            min: 2870,
            fgm: 820,
            fga: 1400,
            fg_pct: 820 / 1400,
            ftm: 410,
            fta: 500,
            ft_pct: 410 / 500,
            tpm: 164,
            tpa: 410,
            tp_pct: 164 / 410,
            oreb: null,
            dreb: null,
            ast: 820,
            ato: 820 / 246,
            stl: 123,
            str: 123 / 246,
            blk: 64,
            to: 246,
            pf: null,
            dd: null,
            td: null,
            pts: 2050,
            ppm: 2050 / 2870,
            imported_at: '2026-09-18T12:00:00.000Z',
            missing_stat_keys: ['oreb', 'dreb', 'pf', 'dd', 'td'],
            estimated_stat_keys: [],
            espn_roto_rank: 1,
          },
        ],
      }
    }),
  )

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)
  expect(cells[orebIndex]).toHaveTextContent('—')
  expect(cells[orebIndex].textContent).not.toBe('0.0')

  const ptsIndex = headers.indexOf('PTS')
  expect(ptsIndex).toBeGreaterThan(-1)
  expect(cells[ptsIndex]).toHaveTextContent('25.0')
})

test('shows an error when the projections request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/weight_sets')) return jsonBody([])
      throw new Error('Failed to load projections')
    }),
  )

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Failed to load projections')).toBeInTheDocument()
})

test('search jok leaves one player and does not refetch', async () => {
  const fetchMock = stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(screen.getByText('Shai Gilgeous-Alexander')).toBeInTheDocument()
  expect(screen.getByText('Jayson Tatum')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText(/player name/i), {
    target: { value: 'jok' },
  })

  expect(playerNames()).toEqual(['Nikola Jokic'])
  expect(screen.queryByText('Shai Gilgeous-Alexander')).not.toBeInTheDocument()
  expect(screen.queryByText('Jayson Tatum')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('location')).toHaveTextContent('/projections?q=jok')
})

test('position C keeps centers', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /^C$/ }))

  expect(playerNames()).toEqual(['Nikola Jokic'])
  expect(screen.queryByText('Shai Gilgeous-Alexander')).not.toBeInTheDocument()
  expect(screen.queryByText('Jayson Tatum')).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/projections?pos=C')
})

test('position G keeps guards and F/C keeps forwards and centers', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /^G$/ }))
  expect(playerNames()).toEqual(['Shai Gilgeous-Alexander'])

  fireEvent.click(screen.getByRole('button', { name: 'F/C' }))
  expect(playerNames()).toEqual(['Nikola Jokic', 'Jayson Tatum'])
})

test('team DEN keeps Nuggets and does not refetch', async () => {
  const fetchMock = stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /nba team/i }))
  fireEvent.click(screen.getByRole('option', { name: 'DEN' }))
  fireEvent.keyDown(screen.getByRole('listbox', { name: /nba team/i }), {
    key: 'Escape',
  })

  expect(playerNames()).toEqual(['Nikola Jokic'])
  expect(screen.queryByText('Shai Gilgeous-Alexander')).not.toBeInTheDocument()
  expect(screen.queryByText('Jayson Tatum')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?teams=DEN',
  )
})

test('clicking PTS header reorders rows by points', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(playerNames()).toEqual([
    'Nikola Jokic',
    'Shai Gilgeous-Alexander',
    'Jayson Tatum',
  ])

  fireEvent.click(screen.getByRole('button', { name: /^PTS$/ }))

  expect(playerNames()).toEqual([
    'Shai Gilgeous-Alexander',
    'Nikola Jokic',
    'Jayson Tatum',
  ])
})

test('clicking ESPN Rank header sorts ESPN rank ascending first with NULL last', async () => {
  stubProjections([
    projectionRow({
      id: 2,
      full_name: 'Shai Gilgeous-Alexander',
      positions: ['PG'],
      nba_team: 'OKC',
      espn_roto_rank: 2,
    }),
    projectionRow({
      id: 4,
      full_name: 'Unranked Player',
      positions: ['SF'],
      nba_team: 'NYK',
      espn_roto_rank: null,
    }),
    projectionRow({
      id: 3,
      full_name: 'Jayson Tatum',
      positions: ['SF', 'PF'],
      nba_team: 'BOS',
      espn_roto_rank: 3,
    }),
    projectionRow({
      id: 1,
      full_name: 'Nikola Jokic',
      positions: ['C'],
      nba_team: 'DEN',
      espn_roto_rank: 1,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()

  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers.filter((header) => header === 'ESPN Rank')).toHaveLength(1)
  const rankIndex = headers.indexOf('ESPN Rank')
  expect(rankIndex).toBeGreaterThan(-1)

  const rankHeader = screen.getByRole('button', { name: /^ESPN Rank$/ })

  fireEvent.click(rankHeader)
  expect(playerNames()).toEqual([
    'Nikola Jokic',
    'Shai Gilgeous-Alexander',
    'Jayson Tatum',
    'Unranked Player',
  ])
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4)
  expect(
    within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[rankIndex]?.textContent),
  ).toEqual(['1', '2', '3', '—'])

  fireEvent.click(rankHeader)
  expect(playerNames()).toEqual([
    'Jayson Tatum',
    'Shai Gilgeous-Alexander',
    'Nikola Jokic',
    'Unranked Player',
  ])
  expect(
    within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[rankIndex]?.textContent),
  ).toEqual(['3', '2', '1', '—'])
})

test('NULL OREB sorts last in both directions and does not render as 0.0', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  const jokicRow = (await screen.findByText('Nikola Jokic')).closest('tr')
  expect(jokicRow).not.toBeNull()
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)
  const jokicCells = within(jokicRow as HTMLTableRowElement).getAllByRole(
    'cell',
  )
  expect(jokicCells[orebIndex]).toHaveTextContent('—')
  expect(jokicCells[orebIndex].textContent).not.toBe('0.0')

  fireEvent.click(screen.getByRole('button', { name: /^OREB$/ }))
  expect(playerNames()).toEqual([
    'Shai Gilgeous-Alexander',
    'Jayson Tatum',
    'Nikola Jokic',
  ])

  fireEvent.click(screen.getByRole('button', { name: /^OREB$/ }))
  expect(playerNames()).toEqual([
    'Jayson Tatum',
    'Shai Gilgeous-Alexander',
    'Nikola Jokic',
  ])
})

test('Update from source POSTs refresh then GETs projections again', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/weight_sets')) return jsonBody([])
    if (init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          source: 'espn',
          season: 2027,
          player_count: 3,
          imported_at: '2026-09-18T13:00:00.000Z',
        }),
      }
    }
    return {
      ok: true,
      json: async () => THREE_ROWS,
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /update from source/i }))

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  const calls = fetchMock.mock.calls.map(([input, init]) => [
    String(input),
    init?.method ?? 'GET',
  ])
  expect(calls).toEqual([
    ['/api/projections?source=espn&season=2027', 'GET'],
    ['/api/weight_sets', 'GET'],
    ['/api/projections/refresh', 'POST'],
    ['/api/projections?source=espn&season=2027', 'GET'],
  ])
  expect(fetchMock.mock.calls[2]?.[1]).toEqual(
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ source: 'espn', season: 2027 }),
    }),
  )
  expect(await screen.findByText(/Imported 3 players/)).toBeInTheDocument()
  expect(screen.getByText(/Last imported:/)).toBeInTheDocument()
})

test('refresh credentials error shows an alert and keeps the current rows', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/api/weight_sets')) return jsonBody([])
    if (init?.method === 'POST') {
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: 'espn_credentials_missing' }),
      }
    }
    return {
      ok: true,
      json: async () => THREE_ROWS,
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /update from source/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Log in to ESPN in Chrome/i,
  )
  expect(screen.getByText('Nikola Jokic')).toBeInTheDocument()
  expect(screen.getByText('Shai Gilgeous-Alexander')).toBeInTheDocument()
})

test('shows the estimate caption when any row has estimated_stat_keys', async () => {
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'Nikola Jokic',
      positions: ['C'],
      nba_team: 'DEN',
      oreb: 213.4,
      estimated_stat_keys: ['oreb'],
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(
    await screen.findByText(
      'Italic values are FNBA estimates. ESPN does not project OREB, DREB, PF, DD or TD.',
    ),
  ).toBeInTheDocument()
})

test('does not show the estimate caption when no row is estimated', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(
    screen.queryByText(
      'Italic values are FNBA estimates. ESPN does not project OREB, DREB, PF, DD or TD.',
    ),
  ).not.toBeInTheDocument()
})

test('default dataset fetches projections and the chip reads Projection', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(screen.getByTestId('dataset-chip')).toHaveTextContent('Projection')
  expect(
    screen.getByRole('table', { name: 'Player projections 2026-27' }),
  ).toBeInTheDocument()
})

test('switching to actuals fetches season stats and labels the dataset', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/weight_sets')) return jsonBody([])
    if (url.startsWith('/api/season_stats')) {
      return {
        ok: true,
        json: async () => [],
      }
    }
    return {
      ok: true,
      json: async () => [
        projectionRow({
          id: 1,
          full_name: 'Nikola Jokic',
          positions: ['C'],
          nba_team: 'DEN',
          oreb: 213.4,
          estimated_stat_keys: ['oreb'],
        }),
      ],
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Italic values are FNBA estimates. ESPN does not project OREB, DREB, PF, DD or TD.',
    ),
  ).toBeInTheDocument()

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /dataset/i }))
  fireEvent.click(
    screen.getByRole('option', { name: '2025-26 actuals (ESPN)' }),
  )

  expect(
    await screen.findByText('No actuals yet. Use Update from source.'),
  ).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/season_stats?source=espn&season=2026',
  )
  expect(screen.getByTestId('dataset-chip')).toHaveTextContent('Actual')
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?dataset=actual&sort=pts',
  )
  expect(
    screen.queryByText(
      'Italic values are FNBA estimates. ESPN does not project OREB, DREB, PF, DD or TD.',
    ),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('table', { name: 'Player actuals 2025-26' }),
  ).toBeInTheDocument()
})

test('toggling to z-scores then clicking TO puts the fewest-turnover player first', async () => {
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'High TO',
      positions: ['C'],
      nba_team: 'DEN',
      to: 300,
    }),
    projectionRow({
      id: 2,
      full_name: 'Mid TO',
      positions: ['PG'],
      nba_team: 'OKC',
      to: 200,
    }),
    projectionRow({
      id: 3,
      full_name: 'Low TO',
      positions: ['SF'],
      nba_team: 'BOS',
      to: 100,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('High TO')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  fireEvent.click(screen.getByRole('button', { name: /^TO$/ }))

  expect(playerNames()).toEqual(['Low TO', 'Mid TO', 'High TO'])
})

test('toggling to z-scores orders by the composite and clicking Total Z flips it', async () => {
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'Low BLK',
      positions: ['C'],
      nba_team: 'DEN',
      blk: 10,
    }),
    projectionRow({
      id: 2,
      full_name: 'High BLK',
      positions: ['PG'],
      nba_team: 'OKC',
      blk: 80,
    }),
    projectionRow({
      id: 3,
      full_name: 'Mid BLK',
      positions: ['SF'],
      nba_team: 'BOS',
      blk: 40,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Low BLK')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  expect(playerNames()).toEqual(['High BLK', 'Mid BLK', 'Low BLK'])

  fireEvent.click(screen.getByRole('button', { name: 'Total Z' }))
  expect(playerNames()).toEqual(['Low BLK', 'Mid BLK', 'High BLK'])
  expect(screen.getByRole('columnheader', { name: 'Total Z' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
})

test('toggling to z-scores sorts by Total Z and back to values clears the z sort', async () => {
  // PTS feeds the composite twice (PTS and PPM), so the Scorer leads Total Z
  // while the Blocker beats the Bystander on BLK alone.
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'Bystander',
      positions: ['C'],
      nba_team: 'DEN',
      blk: 10,
      pts: 2000,
    }),
    projectionRow({
      id: 2,
      full_name: 'Blocker',
      positions: ['PG'],
      nba_team: 'OKC',
      blk: 80,
      pts: 2000,
    }),
    projectionRow({
      id: 3,
      full_name: 'Scorer',
      positions: ['SF', 'PF'],
      nba_team: 'BOS',
      blk: 40,
      pts: 2200,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Bystander')).toBeInTheDocument()
  expect(playerNames()).toEqual(['Bystander', 'Blocker', 'Scorer'])

  fireEvent.click(screen.getByRole('button', { name: /^PTS$/ }))
  expect(playerNames()).toEqual(['Scorer', 'Bystander', 'Blocker'])

  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  expect(playerNames()).toEqual(['Scorer', 'Blocker', 'Bystander'])
  expect(screen.getByRole('columnheader', { name: 'Total Z' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  expect(
    screen.getByRole('columnheader', { name: /^PTS$/ }),
  ).not.toHaveAttribute('aria-sort')
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&sort=z_total',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Values' }))
  expect(playerNames()).toEqual(['Bystander', 'Blocker', 'Scorer'])
  expect(
    screen.queryByRole('columnheader', { name: 'Total Z' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('columnheader', { name: /^PTS$/ }),
  ).not.toHaveAttribute('aria-sort')
  expect(screen.getByTestId('location').textContent).toBe('/projections')
})

test('toggling to z-scores with an active collection sorts by Weighted Z', async () => {
  // Foul Light leads Total Z on fouls; zeroing PF lifts Foul Heavy on blocks.
  stubProjections(
    [
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
    ],
    [
      {
        id: 9,
        name: 'Bench fouls',
        weights: { ...DEFAULT_WEIGHTS, pf: 0 },
        updated_at: '2026-09-22T12:00:00.000Z',
      },
    ],
  )

  renderPage(<ProjectionsPage />, ['/projections?weights=9'])

  expect(await screen.findByText('Foul Heavy')).toBeInTheDocument()
  expect(playerNames()).toEqual(['Foul Light', 'Foul Average', 'Foul Heavy'])
  expect(
    screen.queryByRole('columnheader', { name: 'Weighted Z' }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))

  expect(playerNames()).toEqual(['Foul Heavy', 'Foul Light', 'Foul Average'])
  expect(
    screen.getByRole('columnheader', { name: 'Weighted Z' }),
  ).toHaveAttribute('aria-sort', 'descending')
  expect(
    screen.getByRole('columnheader', { name: 'Total Z' }),
  ).not.toHaveAttribute('aria-sort')
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&weights=9&sort=z_weighted',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Total Z' }))
  expect(playerNames()).toEqual(['Foul Light', 'Foul Heavy', 'Foul Average'])
})

test('search filtering does not change a player displayed z', async () => {
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'Star Player',
      positions: ['C'],
      nba_team: 'DEN',
      pts: 3000,
    }),
    projectionRow({
      id: 2,
      full_name: 'Scrub Player',
      positions: ['SF'],
      nba_team: 'BOS',
      pts: 1000,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Star Player')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))

  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const ptsIndex = headers.indexOf('PTS')
  const scrubBefore = screen.getByText('Scrub Player').closest('tr')
  expect(scrubBefore).not.toBeNull()
  expect(
    within(scrubBefore as HTMLTableRowElement).getAllByRole('cell')[ptsIndex],
  ).toHaveTextContent('-1.00')

  fireEvent.change(screen.getByLabelText(/player name/i), {
    target: { value: 'scrub' },
  })

  expect(playerNames()).toEqual(['Scrub Player'])
  const scrubAfter = screen.getByText('Scrub Player').closest('tr')
  expect(scrubAfter).not.toBeNull()
  expect(
    within(scrubAfter as HTMLTableRowElement).getAllByRole('cell')[ptsIndex],
  ).toHaveTextContent('-1.00')
})

test('PTS sort follows the active basis without refetching', async () => {
  const fetchMock = stubProjections([
    projectionRow({
      id: 1,
      full_name: 'High Rate',
      positions: ['C'],
      nba_team: 'DEN',
      gp: 60,
      pts: 1800,
    }),
    projectionRow({
      id: 2,
      full_name: 'High Volume',
      positions: ['PG'],
      nba_team: 'OKC',
      gp: 82,
      pts: 2050,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('High Rate')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^PTS$/ }))
  expect(playerNames()).toEqual(['High Rate', 'High Volume'])

  fireEvent.click(screen.getByRole('button', { name: 'Season totals' }))
  expect(playerNames()).toEqual(['High Volume', 'High Rate'])
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('columnheader', { name: /^PTS$/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Per game' }))
  expect(playerNames()).toEqual(['High Rate', 'High Volume'])
  expect(screen.getByRole('columnheader', { name: /^PTS$/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
})

test('MIN sort uses total minutes on season totals', async () => {
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'High Rate Minutes',
      positions: ['C'],
      nba_team: 'DEN',
      gp: 50,
      min: 2000,
    }),
    projectionRow({
      id: 2,
      full_name: 'High Volume Minutes',
      positions: ['PG'],
      nba_team: 'OKC',
      gp: 82,
      min: 2870,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('High Rate Minutes')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^MIN$/ }))
  expect(playerNames()).toEqual(['High Rate Minutes', 'High Volume Minutes'])

  fireEvent.click(screen.getByRole('button', { name: 'Season totals' }))
  expect(playerNames()).toEqual(['High Volume Minutes', 'High Rate Minutes'])
  expect(screen.getByRole('columnheader', { name: /^MIN$/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
})

test('a row with pts null shows an em dash for Total Z', async () => {
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'Complete Player',
      positions: ['C'],
      nba_team: 'DEN',
    }),
    projectionRow({
      id: 2,
      full_name: 'Missing Points',
      positions: ['SF'],
      nba_team: 'BOS',
      pts: null,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Missing Points')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))

  const row = screen.getByText('Missing Points').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const totalIndex = headers.indexOf('Total Z')
  expect(totalIndex).toBeGreaterThan(-1)
  expect(cells[totalIndex]).toHaveTextContent('—')
  expect(
    screen.getByText(
      'Z-scores vs the top 1 rostered players (8 teams × 17 roster spots, ≥ 20 GP). TO and PF are reversed so positive is better.',
    ),
  ).toBeInTheDocument()
})

test('a non-default collection shows weighted z and the rank change beside total z', async () => {
  stubProjections(
    [
      projectionRow({
        id: 1,
        full_name: 'Foul Heavy',
        positions: ['PG'],
        nba_team: 'OKC',
        pf: 240,
      }),
      projectionRow({
        id: 2,
        full_name: 'Foul Light',
        positions: ['C'],
        nba_team: 'DEN',
        pf: 80,
      }),
    ],
    [
      {
        id: 9,
        name: 'Bench fouls',
        weights: { ...DEFAULT_WEIGHTS, pf: 0 },
        updated_at: '2026-09-22T12:00:00.000Z',
      },
    ],
  )

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Foul Heavy')).toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: /weights/i }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))

  const weights = screen.getByRole('combobox', { name: /weights/i })
  expect(weights).toBe(document.getElementById('projections-weights'))
  expect(document.querySelectorAll('#projections-weights')).toHaveLength(1)
  expect(
    screen.queryByRole('button', { name: 'Weighted Z' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Δ Rank' })).not.toBeInTheDocument()

  fireEvent.mouseDown(weights)
  fireEvent.click(await screen.findByRole('option', { name: 'Bench fouls' }))

  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers.indexOf('Weighted Z')).toBe(headers.indexOf('Total Z') + 1)
  expect(headers.indexOf('Δ Rank')).toBe(headers.indexOf('Weighted Z') + 1)
  expect(
    screen.getByText(
      /Weighted Z applies "Bench fouls"; Total Z uses equal weights; Δ Rank is places gained under the collection\./,
    ),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('table', {
      name: 'Player projections 2026-27, z-scores, weighted by Bench fouls',
    }),
  ).toBeInTheDocument()

  expect(
    screen.getByRole('columnheader', { name: 'Weighted Z' }),
  ).toHaveAttribute('aria-sort', 'descending')
  expect(
    screen.getByRole('columnheader', { name: 'Total Z' }),
  ).not.toHaveAttribute('aria-sort')
  expect(playerNames()).toEqual(['Foul Heavy', 'Foul Light'])
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&weights=9&sort=z_weighted',
  )
  expect(cellByHeader('Foul Heavy', 'Δ Rank').textContent).toBe('+1')
  expect(cellByHeader('Foul Light', 'Δ Rank').textContent).toBe('-1')

  fireEvent.click(screen.getByRole('button', { name: 'Values' }))
  expect(
    screen.queryByRole('combobox', { name: /weights/i }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Bench fouls',
  )
  expect(cellByHeader('Foul Heavy', 'Δ Rank').textContent).toBe('+1')

  fireEvent.click(screen.getByRole('button', { name: 'Season totals' }))
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Bench fouls',
  )
  expect(cellByHeader('Foul Light', 'Δ Rank').textContent).toBe('-1')
  fireEvent.click(screen.getByRole('button', { name: 'Per game' }))

  fireEvent.click(screen.getByRole('button', { name: /^C$/ }))
  expect(playerNames()).toEqual(['Foul Light'])
  expect(cellByHeader('Foul Light', 'Δ Rank').textContent).toBe('-1')

  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  expect(cellByHeader('Foul Heavy', 'Δ Rank').textContent).toBe('+1')
  expect(cellByHeader('Foul Light', 'Δ Rank').textContent).toBe('-1')

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /weights/i }))
  fireEvent.click(screen.getByRole('option', { name: 'Default' }))

  expect(
    screen.queryByRole('button', { name: 'Weighted Z' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Δ Rank' })).not.toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Total Z' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  expect(playerNames()).toEqual(['Foul Light', 'Foul Heavy'])
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&sort=z_total',
  )
  expect(
    screen.queryByText(/Weighted Z applies "Bench fouls"/),
  ).not.toBeInTheDocument()
})

test('loads /api/weight_sets once when the page mounts', async () => {
  const fetchMock = stubProjections(THREE_ROWS, [
    {
      id: 9,
      name: 'Bench fouls',
      weights: { ...DEFAULT_WEIGHTS },
      updated_at: '2026-09-22T12:00:00.000Z',
    },
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(
    fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/weight_sets'),
    ),
  ).toEqual([['/api/weight_sets']])

  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /weights/i }))
  expect(screen.getByRole('option', { name: 'Bench fouls' })).toBeInTheDocument()
  expect(
    fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/weight_sets'),
    ),
  ).toHaveLength(1)
})

test('saving a collection reloads weight sets and selects the saved name', async () => {
  const fetchMock = stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  fireEvent.click(screen.getByRole('button', { name: 'New weights' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), {
    target: { value: 'Punt fouls' },
  })
  fireEvent.change(within(dialog).getByLabelText('PF'), {
    target: { value: '0' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
      'Punt fouls',
    )
  })
  expect(
    screen.getByText(/Weighted Z applies "Punt fouls"/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Weighted Z' })).toBeInTheDocument()
  expect(
    fetchMock.mock.calls
      .filter(([input]) => String(input).includes('/api/weight_sets'))
      .map(([input, init]) => [String(input), init?.method ?? 'GET']),
  ).toEqual([
    ['/api/weight_sets', 'GET'],
    ['/api/weight_sets', 'POST'],
    ['/api/weight_sets', 'GET'],
  ])
})

// Foul Light leads Total Z on fouls; zeroing PF lifts Foul Heavy to the top
// on blocks.
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

const BENCH_FOULS = {
  id: 9,
  name: 'Bench fouls',
  weights: { ...DEFAULT_WEIGHTS, pf: 0 },
  updated_at: '2026-09-22T12:00:00.000Z',
}

test('saving a collection sorts by Weighted Z', async () => {
  stubProjections(FOUL_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Foul Heavy')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  expect(playerNames()).toEqual(['Foul Light', 'Foul Heavy', 'Foul Average'])

  fireEvent.click(screen.getByRole('button', { name: 'New weights' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), {
    target: { value: 'Punt fouls' },
  })
  fireEvent.change(within(dialog).getByLabelText('PF'), {
    target: { value: '0' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Weighted Z' }),
    ).toHaveAttribute('aria-sort', 'descending')
  })
  expect(playerNames()).toEqual(['Foul Heavy', 'Foul Light', 'Foul Average'])
  expect(
    screen.getByRole('columnheader', { name: 'Total Z' }),
  ).not.toHaveAttribute('aria-sort')
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&weights=1&sort=z_weighted',
  )
})

test('selecting a collection from the Weights select sorts by Weighted Z', async () => {
  stubProjections(FOUL_ROWS, [BENCH_FOULS])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Foul Heavy')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
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
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&weights=9&sort=z_weighted',
  )
})

test('editing the active collection re-sorts by Weighted Z', async () => {
  const fetchMock = stubProjections(FOUL_ROWS, [BENCH_FOULS])

  renderPage(<ProjectionsPage />, ['/projections?view=z&weights=9&sort=pts'])

  expect(await screen.findByText('Foul Heavy')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Bench fouls',
  )
  expect(screen.getByRole('columnheader', { name: /^PTS$/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&weights=9&sort=pts',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Edit weights' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByLabelText('Name')).toHaveValue('Bench fouls')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/projections?view=z&weights=9&sort=z_weighted',
    )
  })
  expect(playerNames()).toEqual(['Foul Heavy', 'Foul Light', 'Foul Average'])
  expect(
    screen.getByRole('columnheader', { name: 'Weighted Z' }),
  ).toHaveAttribute('aria-sort', 'descending')
  expect(
    screen.getByRole('columnheader', { name: /^PTS$/ }),
  ).not.toHaveAttribute('aria-sort')
  expect(
    fetchMock.mock.calls
      .filter(([input]) => String(input).includes('/api/weight_sets'))
      .map(([input, init]) => [String(input), init?.method ?? 'GET']),
  ).toEqual([
    ['/api/weight_sets', 'GET'],
    ['/api/weight_sets/9', 'PATCH'],
    ['/api/weight_sets', 'GET'],
  ])
})

test('deleting the active collection returns to Default and removes weighted columns', async () => {
  const fetchMock = stubProjections(
    [
      projectionRow({
        id: 1,
        full_name: 'Foul Heavy',
        positions: ['PG'],
        nba_team: 'OKC',
        pf: 240,
      }),
      projectionRow({
        id: 2,
        full_name: 'Foul Light',
        positions: ['C'],
        nba_team: 'DEN',
        pf: 80,
      }),
    ],
    [
      {
        id: 9,
        name: 'Bench fouls',
        weights: { ...DEFAULT_WEIGHTS, pf: 0 },
        updated_at: '2026-09-22T12:00:00.000Z',
      },
    ],
  )

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Foul Heavy')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /weights/i }))
  fireEvent.click(screen.getByRole('option', { name: 'Bench fouls' }))
  expect(
    screen.getByRole('columnheader', { name: 'Weighted Z' }),
  ).toHaveAttribute('aria-sort', 'descending')

  fireEvent.click(screen.getByRole('button', { name: 'Edit weights' }))
  const dialog = screen.getByRole('dialog')
  const callsBeforeConfirm = fetchMock.mock.calls.length
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
  expect(fetchMock.mock.calls.length).toBe(callsBeforeConfirm)
  expect(
    within(dialog).getByRole('button', { name: 'Are you sure' }),
  ).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Are you sure' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Weighted Z' }),
    ).not.toBeInTheDocument()
  })
  expect(screen.queryByRole('button', { name: 'Δ Rank' })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Default',
  )
  expect(screen.getByRole('columnheader', { name: 'Total Z' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&sort=z_total',
  )
  expect(
    screen.queryByText(/Weighted Z applies "Bench fouls"/),
  ).not.toBeInTheDocument()
  expect(
    fetchMock.mock.calls
      .filter(([input]) => String(input).includes('/api/weight_sets'))
      .map(([input, init]) => [
        String(input),
        (init?.method ?? 'GET').toUpperCase(),
      ]),
  ).toEqual([
    ['/api/weight_sets', 'GET'],
    ['/api/weight_sets/9', 'DELETE'],
    ['/api/weight_sets', 'GET'],
  ])
})

test('query params initialise the toolbar and table', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />, [
    '/projections?view=z&basis=total&pos=C&q=jok&sort=pts&dir=asc',
  ])

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(playerNames()).toEqual(['Nikola Jokic'])
  expect(screen.queryByText('Shai Gilgeous-Alexander')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/player name/i)).toHaveValue('jok')
  expect(screen.getByRole('button', { name: 'Z-scores' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Season totals' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: /^C$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('columnheader', { name: 'Total Z' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: /^PTS$/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&basis=total&pos=C&q=jok&sort=pts&dir=asc',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Values' }))

  expect(screen.queryByRole('columnheader', { name: 'Total Z' })).not.toBeInTheDocument()
  expect(cellByHeader('Nikola Jokic', 'PTS')).toHaveTextContent('2050')
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?basis=total&pos=C&q=jok&sort=pts&dir=asc',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Per game' }))

  expect(cellByHeader('Nikola Jokic', 'PTS')).toHaveTextContent('25.0')
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?pos=C&q=jok&sort=pts&dir=asc',
  )
})

test('editing a control keeps heat in the query', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />, ['/projections?heat=1'])

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))

  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&sort=z_total&heat=1',
  )

  fireEvent.change(screen.getByLabelText(/player name/i), {
    target: { value: 'jok' },
  })

  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&q=jok&sort=z_total&heat=1',
  )
  expect(playerNames()).toEqual(['Nikola Jokic'])
})

test('an unknown weights id shows Default and stays in the url', async () => {
  stubProjections(THREE_ROWS, [
    {
      id: 9,
      name: 'Bench fouls',
      weights: { ...DEFAULT_WEIGHTS, pf: 0 },
      updated_at: '2026-09-22T12:00:00.000Z',
    },
  ])

  renderPage(<ProjectionsPage />, ['/projections?view=z&weights=999'])

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Default',
  )
  expect(
    screen.queryByRole('button', { name: 'Weighted Z' }),
  ).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&weights=999',
  )
})

test('a known weights id selects that collection', async () => {
  stubProjections(THREE_ROWS, [
    {
      id: 9,
      name: 'Bench fouls',
      weights: { ...DEFAULT_WEIGHTS, pf: 0 },
      updated_at: '2026-09-22T12:00:00.000Z',
    },
  ])

  renderPage(<ProjectionsPage />, ['/projections?view=z&weights=9'])

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
    'Bench fouls',
  )
  expect(screen.getByRole('button', { name: 'Weighted Z' })).toBeInTheDocument()
})

function cellBackground(cell: HTMLElement): string {
  const inline = cell.style.backgroundColor.trim()
  if (inline) return inline
  const computed = getComputedStyle(cell).backgroundColor.trim()
  if (
    computed &&
    computed !== 'rgba(0, 0, 0, 0)' &&
    computed !== 'transparent'
  ) {
    return computed
  }
  const styles = [...document.querySelectorAll('style')]
    .map((node) => node.textContent ?? '')
    .join('\n')
  for (const className of cell.classList) {
    const needle = `.${className}`
    let from = 0
    while (from < styles.length) {
      const at = styles.indexOf(needle, from)
      if (at === -1) break
      const open = styles.indexOf('{', at)
      const close = open === -1 ? -1 : styles.indexOf('}', open)
      if (open === -1 || close === -1) break
      const rule = styles.slice(at, close + 1)
      const match = rule.match(/background(?:-color)?:\s*([^;]+)/i)
      if (match?.[1]) return match[1].trim()
      from = close + 1
    }
  }
  return ''
}

test('toggling Heatmap colours a cell and writes heat=1', async () => {
  stubProjections([
    projectionRow({
      id: 1,
      full_name: 'High Scorer',
      positions: ['C'],
      nba_team: 'DEN',
      pts: 2500,
    }),
    projectionRow({
      id: 2,
      full_name: 'Low Scorer',
      positions: ['PG'],
      nba_team: 'OKC',
      pts: 1000,
    }),
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('High Scorer')).toBeInTheDocument()
  expect(
    screen.queryByRole('switch', { name: 'Heatmap' }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))

  const baseCaption =
    'Z-scores vs the top 2 rostered players (8 teams × 17 roster spots, ≥ 20 GP). TO and PF are reversed so positive is better.'
  expect(screen.getByText(baseCaption)).toBeInTheDocument()
  const ptsBefore = cellByHeader('High Scorer', 'PTS')
  expect(cellBackground(ptsBefore)).toBe('')

  fireEvent.click(screen.getByRole('switch', { name: 'Heatmap' }))

  expect(screen.getByTestId('location')).toHaveTextContent(
    '/projections?view=z&sort=z_total&heat=1',
  )
  expect(screen.getByRole('switch', { name: 'Heatmap' })).toBeChecked()
  expect(
    screen.getByText(
      `${baseCaption} Heatmap: blue is above the pool mean, red is below.`,
    ),
  ).toBeInTheDocument()
  expect(cellBackground(cellByHeader('High Scorer', 'PTS'))).not.toBe('')
})
