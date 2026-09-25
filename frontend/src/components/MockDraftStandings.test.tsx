import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test } from 'vitest'
import type { ReactElement } from 'react'
import type { CategoryPoints, TeamStanding } from '../lib/draftBoard.ts'
import theme from '../theme.ts'
import MockDraftStandings from './MockDraftStandings.tsx'

const CAT_KEYS = [
  'fgm',
  'fg_pct',
  'ftm',
  'ft_pct',
  'tpm',
  'tp_pct',
  'oreb',
  'dreb',
  'ast',
  'ato',
  'stl',
  'str',
  'blk',
  'to',
  'pf',
  'dd',
  'td',
  'pts',
  'ppm',
] as const

const CAT_HEADERS = [
  'FGM',
  'FG%',
  'FTM',
  'FT%',
  '3PM',
  '3P%',
  'OREB',
  'DREB',
  'AST',
  'A/TO',
  'STL',
  'STR',
  'BLK',
  'TO (lower is better)',
  'PF (lower is better)',
  'DD',
  'TD',
  'PTS',
  'PPM',
]

function renderStandings(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

afterEach(() => {
  cleanup()
})

function standing(
  team: string,
  rank: number,
  rotoPoints: number,
  pointOffset: number,
): TeamStanding {
  const cats: Record<string, CategoryPoints> = {}
  CAT_KEYS.forEach((key, index) => {
    cats[key] = { value: 1000 + index, points: pointOffset + index }
  })
  return { team, rank, roto_points: rotoPoints, cats }
}

test('standings render in the given order with tied ranks and category points', () => {
  const tied = standing('Team Tied', 1, 90, 1)
  const chino = standing('Team Chino', 1, 120, 30)
  renderStandings(
    <MockDraftStandings standings={[tied, chino]} userTeam="Team Chino" />,
  )

  const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
  expect(headers).toEqual(['Rank', 'Team', 'Roto points', ...CAT_HEADERS])

  const rows = screen.getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)

  const tiedCells = within(rows[0]).getAllByRole('cell')
  const chinoCells = within(rows[1]).getAllByRole('cell')
  expect(tiedCells[0]).toHaveTextContent('1')
  expect(chinoCells[0]).toHaveTextContent('1')
  expect(tiedCells[1]).toHaveTextContent('Team Tied')
  expect(chinoCells[1]).toHaveTextContent('Team Chino')
  expect(tiedCells[2]).toHaveTextContent('90')
  expect(chinoCells[2]).toHaveTextContent('120')

  CAT_KEYS.forEach((key, index) => {
    const points = String(chino.cats[key]?.points)
    expect(chinoCells[index + 3]).toHaveTextContent(points)
  })

  expect(rows[1]).toHaveAttribute('data-user-team', 'true')
  expect(rows[0]).not.toHaveAttribute('data-user-team')
  expect(
    screen.getByRole('columnheader', { name: 'TO (lower is better)' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('columnheader', { name: 'PF (lower is better)' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/projected rotisserie points for all 16 rostered players/i),
  ).toBeInTheDocument()
  expect(screen.getByText(/no injury or lineup model/i)).toBeInTheDocument()
  expect(screen.queryByText(/simulated season/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/not raw totals/i)).not.toBeInTheDocument()
  expect(
    screen.getByText(/small figure beneath is the team's projected season total/i),
  ).toBeInTheDocument()
})

function cellFor(cells: HTMLElement[], key: (typeof CAT_KEYS)[number]) {
  return cells[CAT_KEYS.indexOf(key) + 3]
}

test('each category cell shows the season total beneath the roto points', () => {
  const chino = standing('Team Chino', 1, 120, 1)
  chino.cats.fgm = { value: 8109.4, points: 8 }
  chino.cats.fg_pct = { value: 0.4797089, points: 4 }
  chino.cats.ato = { value: 1.75035, points: 1 }
  chino.cats.to = { value: 2796, points: 1 }
  chino.cats.ppm = { value: 0.62541, points: 4.5 }
  renderStandings(
    <MockDraftStandings standings={[chino]} userTeam="Team Chino" />,
  )

  const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')

  const fgm = cellFor(cells, 'fgm')
  expect(fgm).toHaveTextContent(/^8\s*8109$/)
  expect(within(fgm).getByText('8109')).toBeInTheDocument()

  const fgPct = cellFor(cells, 'fg_pct')
  expect(fgPct).toHaveTextContent(/^4\s*0\.480$/)

  const ato = cellFor(cells, 'ato')
  expect(ato).toHaveTextContent(/^1\s*1\.75$/)

  const to = cellFor(cells, 'to')
  expect(to).toHaveTextContent(/^1\s*2796$/)

  const ppm = cellFor(cells, 'ppm')
  expect(ppm).toHaveTextContent(/^4\.5\s*0\.63$/)
})

test('a missing category entry renders a dash with no season total', () => {
  const chino = standing('Team Chino', 1, 120, 1)
  delete chino.cats.fgm
  renderStandings(
    <MockDraftStandings standings={[chino]} userTeam="Team Chino" />,
  )

  const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
  expect(cellFor(cells, 'fgm').textContent).toBe('—')
})
