import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { MockDraft } from '../api/mockDrafts.ts'
import theme from '../theme.ts'
import MockDraftsPage from './MockDraftsPage.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderPage(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
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

  renderPage(<MockDraftsPage />)

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

  renderPage(<MockDraftsPage />)
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

  renderPage(<MockDraftsPage />)
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

  renderPage(<MockDraftsPage />)
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
