import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      name: 'Run mock draft (FNBA Total-Z, season totals)',
    }),
  )

  expect(await screen.findByText(/Pool of 128/)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/mock_drafts',
    expect.objectContaining({ method: 'POST' }),
  )
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
      name: 'Run mock draft (FNBA Total-Z, season totals)',
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
      name: 'Run mock draft (FNBA Total-Z, season totals)',
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
