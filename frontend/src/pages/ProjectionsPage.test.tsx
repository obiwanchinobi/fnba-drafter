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
    espn_roto_rank: overrides.id,
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
  const table = screen.getByRole('table', { name: 'Player projections' })
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
    /ESPN credentials are missing/i,
  )
  expect(screen.getByText('Nikola Jokic')).toBeInTheDocument()
  expect(screen.getByText('Shai Gilgeous-Alexander')).toBeInTheDocument()
})
