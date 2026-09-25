import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
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

function weightSearchResult() {
  return {
    budget: 500,
    seed: 42,
    projection_imported_at: '2026-09-22T03:00:00.000Z',
    slots: Array.from({ length: 8 }, (_, index) => {
      const n = index + 1
      const margin = n === 2 ? -1.5 : 3
      return {
        user_slot: n,
        weight_set: {
          id: 100 + n,
          name: `Draft slot ${n}`,
          weights: { blk: 1 },
          updated_at: '2026-09-26T00:00:00.000Z',
        },
        rank: margin > 0 ? 1 : 3,
        roto_points: 90 + margin,
        margin,
        won: margin > 0,
        evaluations: 500,
      }
    }),
  }
}

test('explains the search and shows an empty state before the first run', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  renderPage()

  expect(
    screen.getByRole('heading', { name: 'Winning weights' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/searches weight collections per draft slot/)).toBeInTheDocument()
  expect(screen.getByText('No winning weights yet.')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Find winning weights' }),
  ).toBeEnabled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('Find winning weights posts the search and shows per-slot results', async () => {
  const result = weightSearchResult()
  let resolveSearch: (value: unknown) => void = () => {}
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url === '/api/weight_searches' && method === 'POST') {
      return new Promise((resolve) => {
        resolveSearch = resolve
      })
    }
    return { ok: true, json: async () => [] }
  })
  vi.stubGlobal('fetch', fetchMock)

  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Find winning weights' }))

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /Find winning weights/ }),
    ).toBeDisabled()
  })

  resolveSearch({ ok: true, json: async () => result })

  expect(await screen.findByTestId('weight-search-slot-1')).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('Loses'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-1')).getByText('Wins'),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/opponents draft strictly by Total-Z/),
  ).toBeInTheDocument()
  expect(screen.queryByText('No winning weights yet.')).not.toBeInTheDocument()
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Find winning weights' }),
    ).toBeEnabled()
  })

  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [input, init] = fetchMock.mock.calls[0]
  expect(String(input)).toBe('/api/weight_searches')
  expect((init?.method ?? '').toUpperCase()).toBe('POST')
})

test('a failed weight search shows the error alert', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/weight_searches' && init?.method === 'POST') {
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
  fireEvent.click(screen.getByRole('button', { name: 'Find winning weights' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Not enough draftable players to fill 8 teams × 16 rounds',
  )
  expect(screen.queryByTestId('weight-search-slot-1')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Find winning weights' }),
  ).toBeEnabled()
})
