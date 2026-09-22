import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { MockDraftRun } from '../api/mockDrafts.ts'
import theme from '../theme.ts'
import MockDraftRunsTable from './MockDraftRunsTable.tsx'

afterEach(() => {
  cleanup()
})

function run(slot: number, winner: string): MockDraftRun {
  return {
    id: slot,
    user_slot: slot,
    winners: [winner],
    user_rank: slot === 1 ? 1 : 3,
    user_roto_points: slot === 1 ? 100 : 80,
    draft_order: [winner, 'Team Chino'],
    standings: [
      {
        team: winner,
        roto_points: 100,
        rank: 1,
        cats: {},
      },
      {
        team: 'Team Chino',
        roto_points: slot === 1 ? 100 : 80,
        rank: slot === 1 ? 1 : 3,
        cats: {},
      },
    ],
    picks: [],
  }
}

test('shows the slot winner and Team Chino rank', () => {
  const onSelectRun = vi.fn()
  render(
    <ThemeProvider theme={theme}>
      <MockDraftRunsTable
        runs={[run(1, 'Team Chino'), run(2, "Adam's All Stars")]}
        userTeam="Team Chino"
        selectedSlot={null}
        onSelectRun={onSelectRun}
      />
    </ThemeProvider>,
  )

  expect(screen.getByText("Adam's All Stars")).toBeInTheDocument()
  expect(screen.getAllByText('100').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByTestId('mock-draft-run-2'))
  expect(onSelectRun).toHaveBeenCalledWith(2)
})
