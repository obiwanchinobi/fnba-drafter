import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { DraftState } from '../api/draft.ts'
import theme from '../theme.ts'
import DraftPanel from './DraftPanel.tsx'

function renderPanel(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

const DRAFT: DraftState = {
  season: 2027,
  draft_order: ['Trust in Pizza', 'Team Chino'],
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
