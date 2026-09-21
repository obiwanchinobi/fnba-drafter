import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Projection } from '../api/projections.ts'
import theme from '../theme.ts'
import ProjectionsPage from './ProjectionsPage.tsx'

function renderPage(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
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

function stubProjections(rows: Projection[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => rows,
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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('shows empty-state copy to use Update from source when there are no rows', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
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
    vi.fn().mockResolvedValue({
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
    vi.fn().mockRejectedValue(new Error('Failed to load projections')),
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
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('position C keeps centers', async () => {
  stubProjections(THREE_ROWS)

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /^C$/ }))

  expect(playerNames()).toEqual(['Nikola Jokic'])
  expect(screen.queryByText('Shai Gilgeous-Alexander')).not.toBeInTheDocument()
  expect(screen.queryByText('Jayson Tatum')).not.toBeInTheDocument()
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
  expect(fetchMock).toHaveBeenCalledTimes(1)
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

test('clicking Rank header sorts ESPN rank ascending first with NULL last', async () => {
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
  expect(headers.filter((header) => header === 'Rank')).toHaveLength(1)
  const rankIndex = headers.indexOf('Rank')
  expect(rankIndex).toBeGreaterThan(-1)

  const rankHeader = screen.getByRole('button', { name: /^Rank$/ })

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
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  const calls = fetchMock.mock.calls.map(([input, init]) => [
    String(input),
    init?.method ?? 'GET',
  ])
  expect(calls).toEqual([
    ['/api/projections?source=espn&season=2027', 'GET'],
    ['/api/projections/refresh', 'POST'],
    ['/api/projections?source=espn&season=2027', 'GET'],
  ])
  expect(fetchMock.mock.calls[1]?.[1]).toEqual(
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

test('clicking Total Z orders by the composite', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: 'Total Z' }))

  expect(playerNames()).toEqual(['High BLK', 'Mid BLK', 'Low BLK'])
})

test('toggling view keeps the active sort column', async () => {
  stubProjections([
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
  ])

  renderPage(<ProjectionsPage />)

  expect(await screen.findByText('Nikola Jokic')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^PTS$/ }))
  expect(playerNames()).toEqual([
    'Shai Gilgeous-Alexander',
    'Nikola Jokic',
    'Jayson Tatum',
  ])

  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  expect(playerNames()).toEqual([
    'Shai Gilgeous-Alexander',
    'Nikola Jokic',
    'Jayson Tatum',
  ])
  expect(screen.getByRole('columnheader', { name: /^PTS$/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Values' }))
  expect(playerNames()).toEqual([
    'Shai Gilgeous-Alexander',
    'Nikola Jokic',
    'Jayson Tatum',
  ])
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
  expect(fetchMock).toHaveBeenCalledTimes(1)
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
      'Z-scores vs the top 1 rostered players (8 teams × 16 roster spots, ≥ 20 GP). TO and PF are reversed so positive is better.',
    ),
  ).toBeInTheDocument()
})
