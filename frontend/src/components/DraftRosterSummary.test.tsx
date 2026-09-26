import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test } from 'vitest'
import type { DraftPick } from '../api/draft.ts'
import theme from '../theme.ts'
import DraftRosterSummary from './DraftRosterSummary.tsx'

const CHINO = 5

function pick(
  overall_pick: number,
  espn_team_id: number,
  positions: string[],
): DraftPick {
  return {
    overall_pick,
    round: 1,
    slot: overall_pick,
    team: espn_team_id === CHINO ? 'Team Chino' : `Team ${espn_team_id}`,
    espn_team_id,
    espn_player_id: 1000 + overall_pick,
    player_id: overall_pick,
    full_name: `Player ${overall_pick}`,
    positions,
    nba_team: 'DEN',
    injury_status: null,
  }
}

function chips() {
  return within(
    screen.getByRole('list', { name: 'Roster positions' }),
  ).getAllByRole('listitem')
}

afterEach(() => {
  cleanup()
})

test('renders a chip per position and the drafted total out of 17', () => {
  render(
    <ThemeProvider theme={theme}>
      <DraftRosterSummary
        picks={[
          pick(1, 4, ['C']),
          pick(2, CHINO, ['PG']),
          pick(3, CHINO, ['SF', 'PF']),
        ]}
        userEspnTeamId={CHINO}
        round={1}
      />
    </ThemeProvider>,
  )

  expect(chips().map((chip) => chip.textContent)).toEqual([
    'PG 1',
    'SG 0',
    'SF 1',
    'PF 1',
    'C 0',
  ])
  expect(screen.getByText('Drafted 2 / 17')).toBeInTheDocument()
  for (const chip of chips()) {
    expect(chip).not.toHaveAttribute('data-hole')
  }
})

test('flags an empty position once the draft is past round 5', () => {
  render(
    <ThemeProvider theme={theme}>
      <DraftRosterSummary
        picks={[pick(1, CHINO, ['PG']), pick(2, CHINO, ['SF', 'PF'])]}
        userEspnTeamId={CHINO}
        round={6}
      />
    </ThemeProvider>,
  )

  const [pg, sg, sf, pf, c] = chips()
  expect(sg).toHaveAttribute('data-hole', 'true')
  expect(c).toHaveAttribute('data-hole', 'true')
  expect(pg).not.toHaveAttribute('data-hole')
  expect(sf).not.toHaveAttribute('data-hole')
  expect(pf).not.toHaveAttribute('data-hole')
})

test('does not flag empty positions in round 5 or earlier', () => {
  render(
    <ThemeProvider theme={theme}>
      <DraftRosterSummary picks={[]} userEspnTeamId={CHINO} round={5} />
    </ThemeProvider>,
  )

  for (const chip of chips()) {
    expect(chip).not.toHaveAttribute('data-hole')
  }
  expect(screen.getByText('Drafted 0 / 17')).toBeInTheDocument()
})
