import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import theme from '../theme.ts'
import ProjectionsToolbar from './ProjectionsToolbar.tsx'

function renderToolbar(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

afterEach(() => {
  cleanup()
})

const idleHandlers = {
  onSourceChange: () => {},
  search: '',
  onSearchChange: () => {},
  position: 'All',
  onPositionChange: () => {},
  teams: [] as string[],
  onTeamsChange: () => {},
}

test('renders a Source select that includes ESPN', () => {
  renderToolbar(
    <ProjectionsToolbar source="espn" {...idleHandlers} />,
  )

  expect(screen.getByRole('combobox', { name: /source/i })).toBeInTheDocument()
  expect(screen.getByText(/Source:\s*ESPN/)).toBeInTheDocument()

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /source/i }))

  expect(screen.getByRole('option', { name: 'ESPN' })).toBeInTheDocument()
})

test('changing the source select calls onSourceChange', () => {
  const onSourceChange = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source=""
      {...idleHandlers}
      onSourceChange={onSourceChange}
    />,
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /source/i }))
  fireEvent.click(screen.getByRole('option', { name: 'ESPN' }))

  expect(onSourceChange).toHaveBeenCalledWith('espn')
})

test('renders player search, ESPN position chips, and NBA team options', () => {
  renderToolbar(<ProjectionsToolbar source="espn" {...idleHandlers} />)

  expect(screen.getByLabelText(/player name/i)).toBeInTheDocument()

  for (const chip of ['All', 'PG', 'SG', 'SF', 'PF', 'C', 'G', 'F/C']) {
    expect(screen.getByRole('button', { name: chip === 'C' || chip === 'G' ? new RegExp(`^${chip}$`) : chip })).toBeInTheDocument()
  }
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /nba team/i }))
  expect(screen.getAllByRole('option')).toHaveLength(31)
  expect(screen.getByRole('option', { name: 'DEN' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'FA' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'UTAH' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'GS' })).toBeInTheDocument()
})

test('search, position, and team controls notify the page via props', () => {
  const onSearchChange = vi.fn()
  const onPositionChange = vi.fn()
  const onTeamsChange = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      onSearchChange={onSearchChange}
      onPositionChange={onPositionChange}
      onTeamsChange={onTeamsChange}
    />,
  )

  fireEvent.change(screen.getByLabelText(/player name/i), {
    target: { value: 'jok' },
  })
  expect(onSearchChange).toHaveBeenCalledWith('jok')

  fireEvent.click(screen.getByRole('button', { name: /^C$/ }))
  expect(onPositionChange).toHaveBeenCalledWith('C')

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /nba team/i }))
  fireEvent.click(screen.getByRole('option', { name: 'DEN' }))
  expect(onTeamsChange).toHaveBeenCalledWith(['DEN'])
})

test('renders Update from source and calls onUpdateFromSource', () => {
  const onUpdateFromSource = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      onUpdateFromSource={onUpdateFromSource}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: /update from source/i }))
  expect(onUpdateFromSource).toHaveBeenCalledTimes(1)
})

test('Update from source is disabled with a loading spinner while updating', () => {
  renderToolbar(
    <ProjectionsToolbar source="espn" {...idleHandlers} updating />,
  )

  expect(
    screen.getByRole('button', { name: /update from source/i }),
  ).toBeDisabled()
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
})

test('NBA team options include extra abbrevs from loaded rows', () => {
  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      extraTeams={['XYZ']}
    />,
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /nba team/i }))
  expect(screen.getByRole('option', { name: 'XYZ' })).toBeInTheDocument()
  expect(screen.getAllByRole('option')).toHaveLength(32)
})
