import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { DraftPick, DraftState } from '../api/draft.ts'
import theme from '../theme.ts'
import DraftPanel from './DraftPanel.tsx'

function renderPanel(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

const ORDER = [
  'Trust in Pizza',
  'Team 2',
  'Team 3',
  'Team Chino',
  'Team 5',
  'Team 6',
  'Team 7',
  'Team 8',
]

function pick(overall_pick: number, team: string): DraftPick {
  return {
    overall_pick,
    round: 1,
    slot: overall_pick,
    team,
    espn_team_id: overall_pick,
    espn_player_id: 1000 + overall_pick,
    player_id: overall_pick,
    full_name: `Player ${overall_pick}`,
    positions: ['PG'],
    nba_team: 'DEN',
    injury_status: null,
  }
}

function picksMade(count: number): DraftPick[] {
  return Array.from({ length: count }, (_, i) =>
    pick(i + 1, ORDER[i % ORDER.length] as string),
  )
}

function orderChips() {
  return within(screen.getByRole('list', { name: 'Draft order' })).getAllByRole(
    'listitem',
  )
}

const DRAFT: DraftState = {
  season: 2027,
  draft_order: ORDER,
  user_team: 'Team Chino',
  user_espn_team_id: 5,
  in_progress: true,
  drafted: false,
  refreshed_at: '2026-09-26T11:05:00Z',
  picks: [],
}

const idle = {
  refreshing: false,
  error: null,
  onRefresh: () => {},
  hideDrafted: false,
  onHideDraftedChange: () => {},
}

afterEach(() => {
  cleanup()
})

test('shows Not refreshed yet before the first refresh', () => {
  renderPanel(<DraftPanel {...idle} draft={null} />)

  expect(screen.getByText('Not refreshed yet')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh picks' })).toBeEnabled()
  expect(
    screen.getByText('Draft order not published yet. Refresh picks.'),
  ).toBeInTheDocument()
})

test('asks for a refresh when the draft order is empty', () => {
  renderPanel(<DraftPanel {...idle} draft={{ ...DRAFT, draft_order: [] }} />)

  expect(
    screen.getByText('Draft order not published yet. Refresh picks.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Draft order' })).toBeNull()
})

test('renders the order strip and the clock with picks until the user', () => {
  renderPanel(<DraftPanel {...idle} draft={{ ...DRAFT, picks: picksMade(5) }} />)

  const chips = orderChips()
  expect(chips.map((chip) => chip.textContent)).toEqual([
    '1 Trust in Pizza',
    '2 Team 2',
    '3 Team 3',
    '4 Team Chino',
    '5 Team 5',
    '6 Team 6',
    '7 Team 7',
    '8 Team 8',
  ])
  expect(chips[5]).toHaveAttribute('data-on-clock', 'true')
  expect(chips[3]).toHaveAttribute('data-user', 'true')
  expect(chips[3]).not.toHaveAttribute('data-on-clock')
  expect(chips[0]).not.toHaveAttribute('data-user')

  expect(
    screen.getByText(
      'Pick 6 of 136, round 1: Team 6. Your next pick is #13 (7 picks away).',
    ),
  ).toBeInTheDocument()
})

test('says the user is on the clock when it is their pick', () => {
  renderPanel(<DraftPanel {...idle} draft={{ ...DRAFT, picks: picksMade(3) }} />)

  const chips = orderChips()
  expect(chips[3]).toHaveAttribute('data-on-clock', 'true')
  expect(chips[3]).toHaveAttribute('data-user', 'true')
  expect(
    screen.getByText(
      'Pick 4 of 136, round 1: Team Chino. You are on the clock.',
    ),
  ).toBeInTheDocument()
})

test('uses the singular when the user picks after the next pick', () => {
  renderPanel(<DraftPanel {...idle} draft={{ ...DRAFT, picks: picksMade(2) }} />)

  expect(
    screen.getByText(
      'Pick 3 of 136, round 1: Team 3. Your next pick is #4 (1 pick away).',
    ),
  ).toBeInTheDocument()
})

test('reports a complete draft once every pick is made', () => {
  renderPanel(
    <DraftPanel {...idle} draft={{ ...DRAFT, picks: picksMade(136) }} />,
  )

  expect(
    screen.getByText('Draft complete: 136 of 136 picks made.'),
  ).toBeInTheDocument()
  expect(
    orderChips().some((chip) => chip.hasAttribute('data-on-clock')),
  ).toBe(false)
})

test('shows the last refreshed time and forwards refresh and hide toggles', () => {
  const onRefresh = vi.fn()
  const onHideDraftedChange = vi.fn()

  renderPanel(
    <DraftPanel
      {...idle}
      draft={DRAFT}
      onRefresh={onRefresh}
      onHideDraftedChange={onHideDraftedChange}
    >
      <div data-testid="panel-child">clock</div>
    </DraftPanel>,
  )

  expect(
    screen.getByText(
      `Last refreshed ${new Date('2026-09-26T11:05:00Z').toLocaleString()}`,
    ),
  ).toBeInTheDocument()
  expect(screen.getByTestId('panel-child')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Refresh picks' }))
  expect(onRefresh).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('switch', { name: 'Hide drafted' }))
  expect(onHideDraftedChange).toHaveBeenCalledWith(true)
})

test('shows the error and disables the button while refreshing', () => {
  renderPanel(
    <DraftPanel
      {...idle}
      draft={DRAFT}
      refreshing
      error="Failed to fetch projections from source"
    />,
  )

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Failed to fetch projections from source',
  )
  expect(screen.getByRole('button', { name: 'Refresh picks' })).toBeDisabled()
})
