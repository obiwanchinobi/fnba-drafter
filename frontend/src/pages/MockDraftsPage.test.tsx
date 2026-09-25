import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import type { MockDraft } from '../api/mockDrafts.ts'
import theme from '../theme.ts'
import MockDraftsPage from './MockDraftsPage.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderPage(initialPath = '/mock-drafts') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route path="/mock-drafts" element={<MockDraftsPage />} />
          <Route path="/mock-drafts/:id" element={<MockDraftsPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

function draft(id: number): MockDraft {
  return {
    id,
    policy: 'fnba_total_z',
    source: 'espn',
    season: 2027,
    projection_imported_at: '2026-09-22T03:00:00.000Z',
    pool_size: 128,
    user_team: 'Team Chino',
    weight_set_name: null,
    weights: null,
    created_at: '2026-09-22T04:00:00.000Z',
    runs: [
      {
        id: id * 10 + 1,
        user_slot: 1,
        winners: ['Team Chino'],
        user_rank: 1,
        user_roto_points: 92.5,
        draft_order: ['Team Chino', 'Succulent Chinese Meal'],
        standings: [
          {
            team: 'Team Chino',
            roto_points: 92.5,
            rank: 1,
            cats: { pts: { value: 2000, points: 8 } },
          },
        ],
        picks: [
          {
            overall_pick: 9,
            round: 2,
            slot: 8,
            team: 'Succulent Chinese Meal',
            player_id: 9,
            full_name: 'Late Guard',
            positions: ['PG'],
            nba_team: 'DEN',
            injury_status: null,
            roster_slot: 'PG',
            z_total: 1.5,
            z_weighted: null,
          },
        ],
      },
    ],
  }
}

test('lists saved mock drafts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [draft(4)],
    }),
  )

  renderPage()

  expect(await screen.findByText('fnba_total_z')).toBeInTheDocument()
  expect(screen.queryByText('No mock drafts yet.')).not.toBeInTheDocument()
})

test('run button posts and shows the new draft', async () => {
  const created = draft(9)
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === 'POST') {
      return { ok: true, json: async () => created }
    }
    if (url === '/api/mock_drafts/9') {
      return { ok: true, json: async () => created }
    }
    return { ok: true, json: async () => [created] }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage()
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Run mock draft',
    }),
  )

  expect(await screen.findByText(/Pool of 128/)).toBeInTheDocument()
  expect(screen.getByText(/same player in all 8 permutations/)).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(
    ([input, init]) =>
      String(input) === '/api/mock_drafts' && init?.method === 'POST',
  )
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ policy: 'fnba_total_z' })
})

test('shows the board after a run is selected', async () => {
  const saved = draft(4)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/mock_drafts/4') {
        return { ok: true, json: async () => saved }
      }
      return { ok: true, json: async () => [saved] }
    }),
  )

  renderPage()
  fireEvent.click(await screen.findByTestId('mock-draft-4'))
  fireEvent.click(await screen.findByTestId('mock-draft-run-1'))

  expect(await screen.findByText(/Late Guard/)).toBeInTheDocument()
})

test('shows an error when the run fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: false,
          status: 422,
          json: async () => ({ error: 'board_too_small' }),
        }
      }
      return { ok: true, json: async () => [] }
    }),
  )

  renderPage()
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Run mock draft',
    }),
  )

  expect(
    await screen.findByText(
      'Not enough draftable players to fill 8 teams × 16 rounds',
    ),
  ).toBeInTheDocument()
})

test('opening /mock-drafts/7 fetches that draft on mount', async () => {
  const saved = draft(7)
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/mock_drafts/7') {
      return { ok: true, json: async () => saved }
    }
    return { ok: true, json: async () => [saved] }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage('/mock-drafts/7')

  expect(await screen.findByText(/Pool of 128/)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith('/api/mock_drafts/7')
})

test('clicking a row navigates to its id', async () => {
  const saved = draft(4)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/mock_drafts/4') {
        return { ok: true, json: async () => saved }
      }
      return { ok: true, json: async () => [saved] }
    }),
  )

  renderPage()
  fireEvent.click(await screen.findByTestId('mock-draft-4'))

  await waitFor(() => {
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/mock-drafts\/4$/)
  })
})

test('a successful run navigates to the created id', async () => {
  const created = draft(9)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return { ok: true, json: async () => created }
      }
      if (url === '/api/mock_drafts/9') {
        return { ok: true, json: async () => created }
      }
      return { ok: true, json: async () => [created] }
    }),
  )

  renderPage()
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Run mock draft',
    }),
  )

  await waitFor(() => {
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/mock-drafts\/9$/)
  })
  expect(await screen.findByText(/Pool of 128/)).toBeInTheDocument()
})

test('an unknown id shows the load error and still lists drafts', async () => {
  const saved = draft(4)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/mock_drafts/99') {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'not_found' }),
        }
      }
      return { ok: true, json: async () => [saved] }
    }),
  )

  renderPage('/mock-drafts/99')

  expect(
    await screen.findByText('Failed to load mock draft (404)'),
  ).toBeInTheDocument()
  expect(screen.getByText('fnba_total_z')).toBeInTheDocument()
})

test('the Weights select lists collections returned by /api/weight_sets', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/weight_sets') {
        return {
          ok: true,
          json: async () => [
            {
              id: 9,
              name: 'Blocks only',
              weights: { blk: 1 },
              updated_at: '2026-09-24T00:00:00.000Z',
            },
          ],
        }
      }
      return { ok: true, json: async () => [] }
    }),
  )

  renderPage()
  expect(
    await screen.findByText(/both use unweighted Total-Z/),
  ).toBeInTheDocument()
  expect(screen.getByText(/FNBA Total-Z, season totals/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit weights' })).toBeDisabled()
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /weights/i }))
  expect(await screen.findByRole('option', { name: 'Default' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Blocks only' })).toBeInTheDocument()
})

test('choosing a collection posts its weight_set_id', async () => {
  const created = draft(9)
  created.weight_set_name = 'Blocks only'
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/mock_drafts' && method === 'POST') {
      return { ok: true, json: async () => created }
    }
    if (url === '/api/weight_sets') {
      return {
        ok: true,
        json: async () => [
          {
            id: 9,
            name: 'Blocks only',
            weights: { blk: 2 },
            updated_at: '2026-09-24T00:00:00.000Z',
          },
        ],
      }
    }
    if (url === '/api/mock_drafts/9') {
      return { ok: true, json: async () => created }
    }
    return { ok: true, json: async () => [created] }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage()
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: /weights/i }))
  fireEvent.click(await screen.findByRole('option', { name: 'Blocks only' }))
  expect(screen.getByText(/Team Chino ranks by Blocks only/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Run mock draft' }))

  await waitFor(() => {
    const post = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === '/api/mock_drafts' &&
        (init?.method ?? '').toUpperCase() === 'POST',
    )
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      policy: 'fnba_total_z',
      weight_set_id: 9,
    })
  })
})

test('the list shows the collection name', async () => {
  const saved = draft(4)
  saved.weight_set_name = 'Blocks only'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/weight_sets') {
        return { ok: true, json: async () => [] }
      }
      return { ok: true, json: async () => [saved] }
    }),
  )

  renderPage()

  expect(await screen.findByRole('cell', { name: 'Blocks only' })).toBeInTheDocument()
})

test('a weighted draft says Team Chino ranks by the named collection', async () => {
  const saved = draft(4)
  saved.weight_set_name = 'Blocks only'
  saved.weights = { blk: 2 } as MockDraft['weights']
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/weight_sets') {
        return { ok: true, json: async () => [] }
      }
      if (url === '/api/mock_drafts/4') {
        return { ok: true, json: async () => saved }
      }
      return { ok: true, json: async () => [saved] }
    }),
  )

  renderPage('/mock-drafts/4')

  expect(
    await screen.findByText(/Team Chino ranks by Blocks only/),
  ).toBeInTheDocument()
  expect(screen.getByText(/other seven teams/)).toBeInTheDocument()
  expect(
    screen.queryByText(/same player in all 8 permutations/),
  ).not.toBeInTheDocument()
})

test('Delete arms on the first click and removes the row on the second', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  const saved = draft(4)
  let rows = [saved]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/weight_sets') {
      return { ok: true, json: async () => [] }
    }
    if (method === 'DELETE' && url === '/api/mock_drafts/4') {
      rows = []
      return { ok: true, status: 204, json: async () => ({}) }
    }
    return { ok: true, json: async () => rows }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage()
  const row = await screen.findByTestId('mock-draft-4')
  fireEvent.click(within(row).getByRole('button', { name: 'Delete' }))

  expect(
    within(row).getByRole('button', { name: 'Are you sure' }),
  ).toBeInTheDocument()
  expect(
    fetchMock.mock.calls.some(
      ([, init]) => (init?.method ?? '').toUpperCase() === 'DELETE',
    ),
  ).toBe(false)
  expect(confirm).not.toHaveBeenCalled()
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/mock-drafts$/)

  fireEvent.click(within(row).getByRole('button', { name: 'Are you sure' }))

  await waitFor(() => {
    expect(screen.queryByTestId('mock-draft-4')).not.toBeInTheDocument()
  })
  expect(screen.getByText('No mock drafts yet.')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/mock_drafts/4',
    expect.objectContaining({ method: 'DELETE' }),
  )
  expect(confirm).not.toHaveBeenCalled()
})

test('deleting the open draft navigates to /mock-drafts and hides the detail', async () => {
  const saved = draft(4)
  let rows = [saved]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/weight_sets') {
      return { ok: true, json: async () => [] }
    }
    if (method === 'DELETE' && url === '/api/mock_drafts/4') {
      rows = []
      return { ok: true, status: 204, json: async () => ({}) }
    }
    if (url === '/api/mock_drafts/4') {
      return { ok: true, json: async () => saved }
    }
    return { ok: true, json: async () => rows }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage('/mock-drafts/4')
  expect(await screen.findByText(/Pool of 128/)).toBeInTheDocument()

  const row = screen.getByTestId('mock-draft-4')
  fireEvent.click(within(row).getByRole('button', { name: 'Delete' }))
  expect(screen.getByText(/Pool of 128/)).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/mock-drafts\/4$/)

  fireEvent.click(within(row).getByRole('button', { name: 'Are you sure' }))

  await waitFor(() => {
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/mock-drafts$/)
  })
  expect(screen.queryByText(/Pool of 128/)).not.toBeInTheDocument()
  expect(screen.getByText('No mock drafts yet.')).toBeInTheDocument()
})

test('a failed delete shows the error and keeps the row', async () => {
  const saved = draft(4)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url === '/api/weight_sets') {
        return { ok: true, json: async () => [] }
      }
      if (method === 'DELETE') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'delete_failed' }),
        }
      }
      return { ok: true, json: async () => [saved] }
    }),
  )

  renderPage()
  const row = await screen.findByTestId('mock-draft-4')
  fireEvent.click(within(row).getByRole('button', { name: 'Delete' }))
  fireEvent.click(within(row).getByRole('button', { name: 'Are you sure' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('delete_failed')
  expect(screen.getByTestId('mock-draft-4')).toBeInTheDocument()
  expect(
    within(screen.getByTestId('mock-draft-4')).getByRole('button', {
      name: 'Delete',
    }),
  ).toBeInTheDocument()
})

test('New weights opens the dialog and a save refetches and selects it', async () => {
  const savedSet = {
    id: 3,
    name: 'Punt fouls',
    weights: { blk: 1 },
    updated_at: '2026-09-24T00:00:00.000Z',
  }
  let sets: unknown[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/weight_sets' && method === 'POST') {
      sets = [savedSet]
      return { ok: true, json: async () => savedSet }
    }
    if (url === '/api/weight_sets') {
      return { ok: true, json: async () => sets }
    }
    return { ok: true, json: async () => [] }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'New weights' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), {
    target: { value: 'Punt fouls' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /weights/i })).toHaveTextContent(
      'Punt fouls',
    )
  })
  expect(
    fetchMock.mock.calls
      .filter(([input]) => String(input).includes('/api/weight_sets'))
      .map(([input, init]) => [String(input), (init?.method ?? 'GET').toUpperCase()]),
  ).toEqual([
    ['/api/weight_sets', 'GET'],
    ['/api/weight_sets', 'POST'],
    ['/api/weight_sets', 'GET'],
  ])
})
