import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import { DEFAULT_WEIGHTS } from '../lib/catWeights.ts'
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
  dataset: 'projection' as const,
  onDatasetChange: () => {},
  search: '',
  onSearchChange: () => {},
  position: 'All' as const,
  onPositionChange: () => {},
  teams: [] as string[],
  onTeamsChange: () => {},
  view: 'values' as const,
  onViewChange: () => {},
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

test('renders Dataset select with projection and actual labels', () => {
  renderToolbar(<ProjectionsToolbar source="espn" {...idleHandlers} />)

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /dataset/i }))

  expect(
    screen.getByRole('option', { name: '2026-27 projections (ESPN)' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: '2025-26 actuals (ESPN)' }),
  ).toBeInTheDocument()
})

test('changing the dataset select calls onDatasetChange', () => {
  const onDatasetChange = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      onDatasetChange={onDatasetChange}
    />,
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /dataset/i }))
  fireEvent.click(
    screen.getByRole('option', { name: '2025-26 actuals (ESPN)' }),
  )

  expect(onDatasetChange).toHaveBeenCalledWith('actual')
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

test('empty NBA team field shows All with a shrunk floating label', () => {
  renderToolbar(
    <ProjectionsToolbar source="espn" {...idleHandlers} teams={[]} />,
  )

  const teamSelect = screen.getByRole('combobox', { name: /nba team/i })
  expect(teamSelect).toHaveTextContent('All')
  expect(document.getElementById('projections-team-label')).toHaveAttribute(
    'data-shrink',
    'true',
  )
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

test('renders Values and Z-scores view buttons', () => {
  renderToolbar(<ProjectionsToolbar source="espn" {...idleHandlers} />)

  const group = screen.getByRole('group', { name: 'View' })
  expect(group).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Values' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Z-scores' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('clicking Z-scores calls onViewChange with z', () => {
  const onViewChange = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      onViewChange={onViewChange}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Z-scores' }))
  expect(onViewChange).toHaveBeenCalledWith('z')
})

test('renders Per game and Season totals basis buttons', () => {
  renderToolbar(<ProjectionsToolbar source="espn" {...idleHandlers} />)

  const group = screen.getByRole('group', { name: 'Basis' })
  expect(group).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Per game' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Season totals' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('clicking Season totals calls onBasisChange with total', () => {
  const onBasisChange = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      onBasisChange={onBasisChange}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Season totals' }))
  expect(onBasisChange).toHaveBeenCalledWith('total')
})

function weightSet(id: number, name: string) {
  return {
    id,
    name,
    weights: { ...DEFAULT_WEIGHTS },
    updated_at: '2026-09-22T12:00:00.000Z',
  }
}

test('weights controls are absent on the values view and present for z-scores', () => {
  const { rerender } = renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      view="values"
      weightSets={[weightSet(9, 'Bench fouls')]}
      activeWeightSetId={9}
    />,
  )

  expect(
    screen.queryByRole('combobox', { name: /weights/i }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'New weights' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Edit weights' }),
  ).not.toBeInTheDocument()

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsToolbar
        source="espn"
        {...idleHandlers}
        view="z"
        weightSets={[weightSet(9, 'Bench fouls')]}
        activeWeightSetId={9}
      />
    </ThemeProvider>,
  )

  expect(screen.getByRole('combobox', { name: /weights/i })).toBe(
    document.getElementById('projections-weights'),
  )
  expect(screen.getByRole('button', { name: 'New weights' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit weights' })).toBeInTheDocument()
})

test('the Weights select lists Default then saved names and reports the chosen id', () => {
  const onWeightSetChange = vi.fn()
  const sets = [weightSet(2, 'Bench fouls'), weightSet(5, 'Punt fouls')]
  const { rerender } = renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      view="z"
      weightSets={sets}
      activeWeightSetId="default"
      onWeightSetChange={onWeightSetChange}
    />,
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /weights/i }))
  expect(
    screen.getAllByRole('option').map((option) => option.textContent),
  ).toEqual(['Default', 'Bench fouls', 'Punt fouls'])
  fireEvent.click(screen.getByRole('option', { name: 'Punt fouls' }))
  expect(onWeightSetChange).toHaveBeenCalledWith(5)

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsToolbar
        source="espn"
        {...idleHandlers}
        view="z"
        weightSets={sets}
        activeWeightSetId={5}
        onWeightSetChange={onWeightSetChange}
      />
    </ThemeProvider>,
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /weights/i }))
  fireEvent.click(screen.getByRole('option', { name: 'Default' }))
  expect(onWeightSetChange).toHaveBeenCalledWith('default')
})

test('Edit weights is disabled for Default and enabled for a saved collection', () => {
  const sets = [weightSet(9, 'Bench fouls')]
  const { rerender } = renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      view="z"
      weightSets={sets}
      activeWeightSetId="default"
    />,
  )

  expect(screen.getByRole('button', { name: 'Edit weights' })).toBeDisabled()

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsToolbar
        source="espn"
        {...idleHandlers}
        view="z"
        weightSets={sets}
        activeWeightSetId={9}
      />
    </ThemeProvider>,
  )

  expect(screen.getByRole('button', { name: 'Edit weights' })).toBeEnabled()
})

test('New weights and Edit weights call their callbacks', () => {
  const onCreateWeights = vi.fn()
  const onEditWeights = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      view="z"
      weightSets={[weightSet(9, 'Bench fouls')]}
      activeWeightSetId={9}
      onCreateWeights={onCreateWeights}
      onEditWeights={onEditWeights}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'New weights' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit weights' }))
  expect(onCreateWeights).toHaveBeenCalledTimes(1)
  expect(onEditWeights).toHaveBeenCalledTimes(1)
})

test('heatmap switch is absent in values view and present in z view', () => {
  const { rerender } = renderToolbar(
    <ProjectionsToolbar source="espn" {...idleHandlers} view="values" />,
  )

  expect(
    screen.queryByRole('switch', { name: 'Heatmap' }),
  ).not.toBeInTheDocument()

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsToolbar source="espn" {...idleHandlers} view="z" />
    </ThemeProvider>,
  )

  expect(screen.getByRole('switch', { name: 'Heatmap' })).toBeInTheDocument()
})

test('toggling Heatmap calls the handler with true', () => {
  const onHeatmapChange = vi.fn()

  renderToolbar(
    <ProjectionsToolbar
      source="espn"
      {...idleHandlers}
      view="z"
      heatmap={false}
      onHeatmapChange={onHeatmapChange}
    />,
  )

  fireEvent.click(screen.getByRole('switch', { name: 'Heatmap' }))
  expect(onHeatmapChange).toHaveBeenCalledWith(true)
})
