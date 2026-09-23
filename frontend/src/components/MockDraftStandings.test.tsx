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
    const value = String(chino.cats[key]?.value)
    expect(chinoCells[index + 3]).toHaveTextContent(points)
    expect(chinoCells[index + 3].textContent).not.toContain(value)
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
})
