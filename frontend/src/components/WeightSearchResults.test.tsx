import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test } from 'vitest'
import type { WeightSearch, WeightSearchSlot } from '../api/weightSearches.ts'
import theme from '../theme.ts'
import WeightSearchResults from './WeightSearchResults.tsx'

afterEach(() => {
  cleanup()
})

function slot(n: number, margin: number): WeightSearchSlot {
  return {
    user_slot: n,
    weight_set: {
      id: 100 + n,
      name: `Draft slot ${n}`,
      weights: {} as WeightSearchSlot['weight_set']['weights'],
      updated_at: '2026-09-26T00:00:00.000Z',
    },
    rank: margin > 0 ? 1 : 2,
    roto_points: 90 + margin,
    margin,
    won: margin > 0,
    evaluations: 500,
  }
}

function result(): WeightSearch {
  const margins = [4.5, -2, 0, 1, 3, -0.5, 2, 6]
  return {
    budget: 500,
    seed: 42,
    projection_imported_at: '2026-09-22T03:00:00.000Z',
    slots: margins.map((margin, index) => slot(index + 1, margin)),
  }
}

function renderResults() {
  return render(
    <ThemeProvider theme={theme}>
      <WeightSearchResults result={result()} userTeam="Team Chino" />
    </ThemeProvider>,
  )
}

test('renders one row per draft slot', () => {
  renderResults()

  for (let n = 1; n <= 8; n += 1) {
    expect(screen.getByTestId(`weight-search-slot-${n}`)).toBeInTheDocument()
  }
})

test('labels each slot Wins, Ties or Loses by margin', () => {
  renderResults()

  expect(
    within(screen.getByTestId('weight-search-slot-1')).getByText('Wins'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('Loses'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-3')).getByText('Ties'),
  ).toBeInTheDocument()
})

test('shows the saved collection name, rank, points and signed margin', () => {
  renderResults()

  const row = within(screen.getByTestId('weight-search-slot-1'))
  expect(row.getByText('Draft slot 1')).toBeInTheDocument()
  expect(row.getByText('94.5')).toBeInTheDocument()
  expect(row.getByText('+4.5')).toBeInTheDocument()
  expect(
    within(screen.getByTestId('weight-search-slot-2')).getByText('-2'),
  ).toBeInTheDocument()
})

test('names the user team column and the opponent assumption', () => {
  renderResults()

  expect(
    screen.getByRole('columnheader', { name: 'Team Chino rank' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/Searched 500 weight collections per slot/),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/other seven teams use unweighted Total-Z/),
  ).toBeInTheDocument()
})
