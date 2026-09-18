import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Projection } from '../api/projections.ts'
import theme from '../theme.ts'
import ProjectionsTable from './ProjectionsTable.tsx'

function renderTable(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

afterEach(() => {
  cleanup()
})

const jokic: Projection = {
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
}

test('shows empty-state copy when there are no rows', () => {
  renderTable(
    <ProjectionsTable
      rows={[]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(screen.getByText(/Update from source/i)).toBeInTheDocument()
})

test('renders NULL OREB as an em dash and combined FGM/FGA per game', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(screen.getByText('Nikola Jokic')).toBeInTheDocument()

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)
  expect(cells[orebIndex]).toHaveTextContent('—')
  expect(cells[orebIndex].textContent).not.toBe('0.0')

  const fgIndex = headers.indexOf('FGM/FGA')
  expect(fgIndex).toBeGreaterThan(-1)
  expect(cells[fgIndex]).toHaveTextContent('10.0/17.1')
})

test('exposes sort labels and reports the clicked column', () => {
  const onSort = vi.fn()

  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={onSort}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  for (const label of ['Player', 'Team', 'Pos', 'GP', 'MIN', 'PTS']) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  }

  fireEvent.click(screen.getByRole('button', { name: /^PTS$/ }))
  expect(onSort).toHaveBeenCalledWith('pts')
})
