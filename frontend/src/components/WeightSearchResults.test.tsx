import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { WeightSearchRun } from '../api/weightSearches.ts'
import { DEFAULT_WEIGHTS } from '../lib/catWeights.ts'
import theme from '../theme.ts'
import WeightSearchResults from './WeightSearchResults.tsx'

afterEach(() => {
  cleanup()
})

const RUN_AT = '2026-09-26T09:00:00.000Z'

function run(
  n: number,
  overrides: Partial<WeightSearchRun> = {},
): WeightSearchRun {
  return {
    user_slot: n,
    weight_set_name: `Draft slot ${n}`,
    weights: DEFAULT_WEIGHTS,
    rank: 1,
    roto_points: 94.5,
    margin: 4.5,
    win_rate: 0.75,
    mean_margin: 2.25,
    worst_margin: -3.5,
    margins: null,
    scenario_count: 24,
    noise_sd: 1.2,
    budget: 300,
    seed: 42,
    projection_imported_at: '2026-09-22T03:00:00.000Z',
    created_at: RUN_AT,
    draft_order: [],
    standings: [],
    picks: [],
    ...overrides,
  }
}

function renderResults(
  runs: WeightSearchRun[],
  selectedSlot: number | null = null,
  onSelectSlot: (userSlot: number) => void = () => {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <WeightSearchResults
        runs={runs}
        scenarioCount={24}
        userTeam="Team Chino"
        selectedSlot={selectedSlot}
        onSelectSlot={onSelectSlot}
      />
    </ThemeProvider>,
  )
}

test('renders rows only for the slots that have a run', () => {
  renderResults([run(2), run(5)])

  expect(screen.getByTestId('weight-search-slot-2')).toBeInTheDocument()
  expect(screen.getByTestId('weight-search-slot-5')).toBeInTheDocument()
  for (const n of [1, 3, 4, 6, 7, 8]) {
    expect(screen.queryByTestId(`weight-search-slot-${n}`)).not.toBeInTheDocument()
  }
})

test('names the confidence columns and no longer labels a single margin a win', () => {
  renderResults([run(1)])

  for (const name of [
    'Slot',
    'Collection',
    'Wins',
    'Mean margin',
    'Worst margin',
    'Base margin',
    'Base rank',
    'Last run',
  ]) {
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
  }
  expect(screen.queryByRole('columnheader', { name: 'Result' })).not.toBeInTheDocument()
  expect(screen.queryByText('Loses')).not.toBeInTheDocument()
})

test('formats wins as scenarios won out of scenarios run', () => {
  renderResults([
    run(1, { win_rate: 0.75 }),
    run(2, { win_rate: 0, scenario_count: 12 }),
    run(3, { win_rate: null }),
  ])

  expect(
    within(screen.getByTestId('weight-search-slot-1')).getByText('18 of 24'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('0 of 12'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-3')).queryByText(/ of /),
  ).not.toBeInTheDocument()
})

test('shows signed mean, worst and base margins', () => {
  renderResults([
    run(1, { mean_margin: 2.25, worst_margin: -3.5, margin: 4.5 }),
    run(2, { mean_margin: -1.125, worst_margin: 0, margin: -2 }),
  ])

  const first = screen.getByTestId('weight-search-slot-1')
  const cells = within(first).getAllByRole('cell')
  expect(cells.map((cell) => cell.textContent)).toEqual([
    '1',
    'Draft slot 1',
    '18 of 24',
    '+2.25',
    '-3.5',
    '+4.5',
    '1st',
    new Date(RUN_AT).toLocaleString(),
  ])

  const second = within(screen.getByTestId('weight-search-slot-2'))
  expect(second.getByText('-1.13')).toBeInTheDocument()
  expect(second.getByText('0')).toBeInTheDocument()
  expect(second.getByText('-2')).toBeInTheDocument()
})

test('shows the base scenario rank as an ordinal, matching the standings table', () => {
  renderResults([
    run(1, { rank: 1 }),
    run(2, { rank: 2 }),
    run(3, { rank: 3 }),
    run(4, { rank: 7 }),
  ])

  expect(
    within(screen.getByTestId('weight-search-slot-1')).getByText('1st'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('2nd'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-3')).getByText('3rd'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-4')).getByText('7th'),
  ).toBeInTheDocument()
})

test('explains wins and the base margin', () => {
  renderResults([run(1)])

  expect(
    screen.getByText(/Wins counts the scenarios where Team Chino finishes first/),
  ).toBeInTheDocument()
  expect(screen.getByText(/Base margin is scenario 0/)).toBeInTheDocument()
  expect(screen.getByText(/Base rank is where Team Chino finishes/)).toBeInTheDocument()
})

test('clicking a slot row selects that slot', () => {
  const onSelectSlot = vi.fn()
  renderResults([run(1), run(3)], null, onSelectSlot)

  fireEvent.click(screen.getByTestId('weight-search-slot-3'))

  expect(onSelectSlot).toHaveBeenCalledWith(3)
})

test('marks only the selected slot row as selected', () => {
  renderResults([run(1), run(3)], 3)

  expect(screen.getByTestId('weight-search-slot-3')).toHaveClass('Mui-selected')
  expect(screen.getByTestId('weight-search-slot-1')).not.toHaveClass(
    'Mui-selected',
  )
})
