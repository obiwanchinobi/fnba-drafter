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
  estimated_stat_keys: [],
  espn_roto_rank: 1,
  prior_season: null,
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

  for (const label of ['Player', 'Team', 'Pos', 'Rank', 'GP', 'MIN', 'PTS']) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  }

  fireEvent.click(screen.getByRole('button', { name: /^PTS$/ }))
  expect(onSort).toHaveBeenCalledWith('pts')

  fireEvent.click(screen.getByRole('button', { name: /^Rank$/ }))
  expect(onSort).toHaveBeenCalledWith('rank')
})

test('estimated OREB cell is italic with the FNBA estimate title', () => {
  const estimated = {
    ...jokic,
    oreb: 213.4,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  const ptsIndex = headers.indexOf('PTS')
  expect(orebIndex).toBeGreaterThan(-1)
  expect(ptsIndex).toBeGreaterThan(-1)

  expect(cells[orebIndex]).toHaveStyle({ fontStyle: 'italic' })
  expect(cells[orebIndex]).toHaveAttribute(
    'title',
    'FNBA estimate (not projected by ESPN)',
  )
  expect(cells[ptsIndex]).not.toHaveStyle({ fontStyle: 'italic' })
  expect(cells[ptsIndex]).not.toHaveAttribute('title')
})

const priorSeason = {
  season: 2026,
  gp: 70,
  oreb: 192,
  dreb: 644,
  pf: 173,
  dd: 55,
  td: 34,
}

test('estimated OREB shows per-game delta against prior-season actual', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)

  const delta = within(cells[orebIndex]).getByTitle('vs 2025-26 actual per game')
  expect(delta).toHaveTextContent('+0.2')
  expect(cells[orebIndex]).toHaveStyle({ fontStyle: 'italic' })
  expect(cells[orebIndex]).toHaveAttribute(
    'title',
    'FNBA estimate (not projected by ESPN)',
  )
})

test('estimated PF shows a positive delta when fouls rose', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    pf: 200,
    missing_stat_keys: ['oreb', 'dreb', 'dd', 'td'],
    estimated_stat_keys: ['pf'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const pfIndex = headers.indexOf('PF')
  expect(pfIndex).toBeGreaterThan(-1)

  const delta = within(cells[pfIndex]).getByTitle('vs 2025-26 actual per game')
  expect(delta.textContent).toMatch(/^\+/)
})

test('estimated cell has no delta when prior_season is null', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: null,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)
  expect(
    within(cells[orebIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
  expect(cells[orebIndex].textContent).not.toMatch(/[+-]/)
})

test('ESPN-supplied cats never show a delta', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const ptsIndex = headers.indexOf('PTS')
  const astIndex = headers.indexOf('AST')
  expect(ptsIndex).toBeGreaterThan(-1)
  expect(astIndex).toBeGreaterThan(-1)
  expect(
    within(cells[ptsIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
  expect(
    within(cells[astIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
})
