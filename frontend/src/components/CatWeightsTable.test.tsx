import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test } from 'vitest'
import { DEFAULT_WEIGHTS, type CatWeights } from '../lib/catWeights.ts'
import { SCORED_CAT_IDS, SCORED_CAT_LABELS } from '../lib/statBasis.ts'
import theme from '../theme.ts'
import CatWeightsTable from './CatWeightsTable.tsx'

afterEach(() => {
  cleanup()
})

function renderTable(weights: CatWeights, label = 'Blocks only weights') {
  return render(
    <ThemeProvider theme={theme}>
      <CatWeightsTable weights={weights} label={label} />
    </ThemeProvider>,
  )
}

test('uses the label as the table accessible name', () => {
  renderTable(DEFAULT_WEIGHTS, 'Draft slot 4 weights')

  expect(
    screen.getByRole('table', { name: 'Draft slot 4 weights' }),
  ).toBeInTheDocument()
})

test('renders one header cell per scored category, in order', () => {
  renderTable(DEFAULT_WEIGHTS)

  const table = screen.getByRole('table', { name: 'Blocks only weights' })
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent)
    .filter((text) => text !== '')
  expect(headers).toEqual(SCORED_CAT_IDS.map((cat) => SCORED_CAT_LABELS[cat]))
  expect(
    within(table).queryByRole('columnheader', { name: 'REB' }),
  ).not.toBeInTheDocument()
})

test('shows raw weights and the relative-to-mean row', () => {
  // 17 cats at 1, blk 2.5, to 0.5: sum 20, mean 20 / 19.
  renderTable({ ...DEFAULT_WEIGHTS, blk: 2.5, to: 0.5 })

  const table = screen.getByRole('table', { name: 'Blocks only weights' })
  const raw = within(table).getByRole('row', { name: /^Weight/ })
  expect(within(raw).getByText('2.5')).toBeInTheDocument()
  expect(within(raw).getByText('0.5')).toBeInTheDocument()
  expect(within(raw).getAllByText('1')).toHaveLength(17)

  const mean = 20 / 19
  const relative = within(table).getByRole('row', {
    name: /^Relative to mean/,
  })
  expect(
    within(relative).getByText(String(Number((2.5 / mean).toFixed(2)))),
  ).toBeInTheDocument()
  expect(
    within(relative).getByText(String(Number((0.5 / mean).toFixed(2)))),
  ).toBeInTheDocument()
  expect(
    within(relative).getAllByText(String(Number((1 / mean).toFixed(2)))),
  ).toHaveLength(17)
})

test('formats a missing weight as an em dash in both rows', () => {
  const weights: Partial<CatWeights> = { ...DEFAULT_WEIGHTS }
  delete weights.blk
  renderTable(weights as CatWeights)

  const table = screen.getByRole('table', { name: 'Blocks only weights' })
  const raw = within(table).getByRole('row', { name: /^Weight/ })
  expect(within(raw).getAllByText('—')).toHaveLength(1)
  expect(within(raw).getAllByText('1')).toHaveLength(18)

  // The relative row needs every weight to compute the mean.
  const relative = within(table).getByRole('row', {
    name: /^Relative to mean/,
  })
  expect(within(relative).getAllByText('—')).toHaveLength(19)
})
