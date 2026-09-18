import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import theme from '../theme.ts'
import ProjectionsPage from './ProjectionsPage.tsx'

function renderPage(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

afterEach(() => {
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
  expect(await screen.findByText(/Update from source/i)).toBeInTheDocument()
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
