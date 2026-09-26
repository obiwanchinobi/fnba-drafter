import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test } from 'vitest'
import type { ReactElement } from 'react'
import { formatPick, type DraftPick, type DraftRunView } from '../lib/draftBoard.ts'
import theme from '../theme.ts'
import MockDraftBoard from './MockDraftBoard.tsx'

const TEAMS = [
  'Team Chino',
  'Team Two',
  'Team Three',
  'Team Four',
  'Team Five',
  'Team Six',
  'Team Seven',
  'Team Eight',
]

function renderBoard(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

afterEach(() => {
  cleanup()
})

function runWith(picks: DraftPick[]): DraftRunView {
  return {
    user_slot: 4,
    draft_order: [...TEAMS],
    standings: [],
    picks,
  }
}

const lateWing: DraftPick = {
  overall_pick: 9,
  round: 2,
  slot: 8,
  team: 'Team Eight',
  player_id: 42,
  full_name: 'Late Wing',
  positions: ['SF', 'PF'],
  nba_team: 'LAL',
  injury_status: 'OUT',
  roster_slot: 'SF',
  z_total: 3.5,
  z_weighted: null,
}

test('a pick shows in the right round and slot cell', () => {
  renderBoard(<MockDraftBoard run={runWith([lateWing])} userTeam="Team Chino" />)

  const rows = screen.getAllByRole('row')
  expect(rows).toHaveLength(18)

  const round2 = within(rows[2]).getAllByRole('cell')
  expect(round2).toHaveLength(8)
  expect(round2[7]).toHaveTextContent(formatPick(lateWing))
  expect(round2[7]).not.toHaveTextContent('OUT')
  expect(round2[7]).not.toHaveTextContent('LAL')
  expect(within(rows[1]).getAllByRole('cell')[7]).toHaveTextContent('')
  expect(round2[6]).toHaveTextContent('')
})

test('the user column is highlighted by team name, not user_slot', () => {
  renderBoard(<MockDraftBoard run={runWith([])} userTeam="Team Chino" />)

  const headers = screen.getAllByRole('columnheader')
  expect(headers.map((header) => header.textContent)).toEqual([
    '1 Team Chino',
    '2 Team Two',
    '3 Team Three',
    '4 Team Four',
    '5 Team Five',
    '6 Team Six',
    '7 Team Seven',
    '8 Team Eight',
  ])
  expect(headers[0]).toHaveAttribute('data-user-team', 'true')
  expect(headers[3]).not.toHaveAttribute('data-user-team')
  expect(headers[3]).toHaveTextContent('Team Four')
})

test('a pick with z_weighted shows the weighted value', () => {
  const weighted = { ...lateWing, z_weighted: 4.25 }
  renderBoard(<MockDraftBoard run={runWith([weighted])} userTeam="Team Chino" />)

  const round2 = within(screen.getAllByRole('row')[2]).getAllByRole('cell')
  expect(round2[7]).toHaveTextContent(formatPick(weighted))
  expect(round2[7]).toHaveTextContent('Z 3.50 · W 4.25')
})
