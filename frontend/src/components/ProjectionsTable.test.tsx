import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Projection } from '../api/projections.ts'
import {
  CAT_Z_CAP,
  TOTAL_Z_CAP,
  heatBackground,
} from '../lib/heatmap.ts'
import { SCORED_CAT_IDS, type ScoredCat } from '../lib/statBasis.ts'
import type { ZScoresResult } from '../lib/zScores.ts'
import theme from '../theme.ts'
import ProjectionsTable, {
  ROW_HEIGHT,
  Z_ROW_HEIGHT,
} from './ProjectionsTable.tsx'

function renderTable(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

function cellsFor(playerName: string) {
  const row = screen.getByText(playerName).closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  return { cells, headers }
}

function cellText(playerName: string, header: string) {
  const { cells, headers } = cellsFor(playerName)
  const index = headers.indexOf(header)
  expect(index).toBeGreaterThan(-1)
  return cells[index]
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect

function viewportRect() {
  return {
    width: 1200,
    height: 2000,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 2000,
    x: 0,
    y: 0,
    toJSON() {},
  }
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = () => viewportRect()
})

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
  cleanup()
})

const jokic: Projection = {
  id: 1,
  player_id: 1,
  espn_player_id: 3112335,
  first_name: 'Nikola',
  last_name: 'Jokic',
  full_name: 'Nikola Jokic',
  positions: ['C'],
  nba_team: 'DEN',
  injury_status: null,
  source: 'espn',
  season: 2027,
  gp: 82,
  min: 2870,
  fgm: 820,
  fga: 1400,
  fg_pct: 820 / 1400,
  ftm: 410,
  fta: 500,
  ft_pct: 410 / 500,
  tpm: 164,
  tpa: 410,
  tp_pct: 164 / 410,
  oreb: null,
  dreb: null,
  ast: 820,
  ato: 820 / 246,
  stl: 123,
  str: 123 / 246,
  blk: 64,
  to: 246,
  pf: null,
  dd: null,
  td: null,
  pts: 2050,
  ppm: 2050 / 2870,
  imported_at: '2026-09-18T12:00:00.000Z',
  missing_stat_keys: ['oreb', 'dreb', 'pf', 'dd', 'td'],
  estimated_stat_keys: [],
  espn_roto_rank: 1,
  dataset: 'projection',
  prior_season: null,
}

function zScoresFor(
  rowId: number,
  cats: Partial<Record<ScoredCat, number | null>>,
  total: number | null,
): ZScoresResult {
  const full = {} as Record<ScoredCat, number | null>
  for (const cat of SCORED_CAT_IDS) {
    full[cat] = cats[cat] === undefined ? 0 : cats[cat]
  }
  return {
    poolSize: 1,
    scores: new Map([[rowId, { cats: full, total }]]),
  }
}

const zViewScores = zScoresFor(
  1,
  { pts: 1.23, to: -0.45, oreb: null },
  1.23,
)

test('shows empty-state copy when there are no rows', () => {
  renderTable(
    <ProjectionsTable
      rows={[]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(screen.getByText(/Update from source/i)).toBeInTheDocument()
})

test('renders NULL OREB as an em dash and combined FGM/FGA per game', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(screen.getByText('Nikola Jokic')).toBeInTheDocument()

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)
  expect(cells[orebIndex]).toHaveTextContent('—')
  expect(cells[orebIndex].textContent).not.toBe('0.0')

  const fgIndex = headers.indexOf('FGM/FGA')
  expect(fgIndex).toBeGreaterThan(-1)
  expect(cells[fgIndex]).toHaveTextContent('10.0/17.1')
})

test('exposes sort labels and reports the clicked column', () => {
  const onSort = vi.fn()

  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={onSort}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  for (const label of ['Player', 'Team', 'Pos', 'ESPN Rank', 'GP', 'MIN', 'PTS']) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  }

  fireEvent.click(screen.getByRole('button', { name: /^PTS$/ }))
  expect(onSort).toHaveBeenCalledWith('pts')

  fireEvent.click(screen.getByRole('button', { name: /^ESPN Rank$/ }))
  expect(onSort).toHaveBeenCalledWith('rank')
})

test('shows an injury icon beside the name and no Inj column', () => {
  const rows: Projection[] = [
    { ...jokic, id: 1, full_name: 'Out Player', injury_status: 'OUT' },
    {
      ...jokic,
      id: 2,
      player_id: 2,
      full_name: 'Day To Day Player',
      injury_status: 'DAY_TO_DAY',
    },
    {
      ...jokic,
      id: 3,
      player_id: 3,
      full_name: 'Active Player',
      injury_status: 'ACTIVE',
    },
    {
      ...jokic,
      id: 4,
      player_id: 4,
      full_name: 'Healthy Player',
      injury_status: null,
    },
    {
      ...jokic,
      id: 5,
      player_id: 5,
      full_name: 'Unknown Player',
      injury_status: 'QUESTIONABLE',
    },
  ]

  renderTable(
    <ProjectionsTable
      rows={rows}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(
    screen.queryByRole('columnheader', { name: 'Inj' }),
  ).not.toBeInTheDocument()

  const outCell = cellText('Out Player', 'Player')
  expect(outCell.textContent).toBe('Out Player')
  const outIcon = within(outCell).getByRole('img', { name: 'Out' })
  expect(outIcon).toHaveAttribute('title', 'Out')
  expect(outIcon).toHaveStyle({
    color: theme.palette.error.main,
    fontSize: '16px',
  })

  const dayCell = cellText('Day To Day Player', 'Player')
  expect(dayCell.textContent).toBe('Day To Day Player')
  const dayIcon = within(dayCell).getByRole('img', { name: 'Day to day' })
  expect(dayIcon).toHaveAttribute('title', 'Day to day')
  expect(dayIcon).toHaveStyle({
    color: theme.palette.warning.main,
    fontSize: '16px',
  })

  expect(
    within(cellText('Active Player', 'Player')).queryByRole('img'),
  ).toBeNull()
  expect(
    within(cellText('Healthy Player', 'Player')).queryByRole('img'),
  ).toBeNull()
  expect(
    within(cellText('Unknown Player', 'Player')).queryByRole('img'),
  ).toBeNull()
})

test('estimated OREB cell is italic with the FNBA estimate title', () => {
  const estimated = {
    ...jokic,
    oreb: 213.4,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  const ptsIndex = headers.indexOf('PTS')
  expect(orebIndex).toBeGreaterThan(-1)
  expect(ptsIndex).toBeGreaterThan(-1)

  expect(cells[orebIndex]).toHaveStyle({ fontStyle: 'italic' })
  expect(cells[orebIndex]).toHaveAttribute(
    'title',
    'FNBA estimate (not projected by ESPN)',
  )
  expect(cells[ptsIndex]).not.toHaveStyle({ fontStyle: 'italic' })
  expect(cells[ptsIndex]).not.toHaveAttribute('title')
})

const priorSeason = {
  season: 2026,
  gp: 70,
  oreb: 192,
  dreb: 644,
  pf: 173,
  dd: 55,
  td: 34,
}

test('estimated OREB shows per-game delta against prior-season actual', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)

  const delta = within(cells[orebIndex]).getByTitle('vs 2025-26 actual per game')
  expect(delta).toHaveTextContent('+0.2')
  expect(cells[orebIndex]).toHaveStyle({ fontStyle: 'italic' })
  expect(cells[orebIndex]).toHaveAttribute(
    'title',
    'FNBA estimate (not projected by ESPN)',
  )
})

test('estimated PF shows a positive delta when fouls rose', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    pf: 200,
    missing_stat_keys: ['oreb', 'dreb', 'dd', 'td'],
    estimated_stat_keys: ['pf'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const pfIndex = headers.indexOf('PF')
  expect(pfIndex).toBeGreaterThan(-1)

  const delta = within(cells[pfIndex]).getByTitle('vs 2025-26 actual per game')
  expect(delta.textContent).toMatch(/^\+/)
})

test('estimated cell has no delta when prior_season is null', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: null,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(orebIndex).toBeGreaterThan(-1)
  expect(
    within(cells[orebIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
  expect(cells[orebIndex].textContent).not.toMatch(/[+-]/)
})

test('projection dataset aria-label includes the season range', () => {
  renderTable(
    <ProjectionsTable
      dataset="projection"
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(
    screen.getByRole('table', { name: 'Player projections 2026-27' }),
  ).toBeInTheDocument()
})

test('actual dataset aria-label includes the season range', () => {
  const actual: Projection = {
    ...jokic,
    dataset: 'actual',
    season: 2026,
    espn_roto_rank: 1,
    estimated_stat_keys: [],
  }

  renderTable(
    <ProjectionsTable
      dataset="actual"
      rows={[actual]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No actuals yet. Use Update from source."
    />,
  )

  expect(
    screen.getByRole('table', { name: 'Player actuals 2025-26' }),
  ).toBeInTheDocument()
})

test('actuals rank is an em dash and estimated_stat_keys do not italicize', () => {
  const actual: Projection = {
    ...jokic,
    dataset: 'actual',
    season: 2026,
    oreb: 192,
    estimated_stat_keys: [],
    espn_roto_rank: 1,
  }

  renderTable(
    <ProjectionsTable
      dataset="actual"
      rows={[actual]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No actuals yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const rankIndex = headers.indexOf('ESPN Rank')
  const orebIndex = headers.indexOf('OREB')
  expect(rankIndex).toBeGreaterThan(-1)
  expect(orebIndex).toBeGreaterThan(-1)
  expect(cells[rankIndex]).toHaveTextContent('—')
  expect(cells[orebIndex]).not.toHaveStyle({ fontStyle: 'italic' })
  expect(cells[orebIndex]).not.toHaveAttribute('title')
  expect(
    within(cells[orebIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
})

test('ESPN-supplied cats never show a delta', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const ptsIndex = headers.indexOf('PTS')
  const astIndex = headers.indexOf('AST')
  expect(ptsIndex).toBeGreaterThan(-1)
  expect(astIndex).toBeGreaterThan(-1)
  expect(
    within(cells[ptsIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
  expect(
    within(cells[astIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
})

test('z cells render signed two-decimal z and an em dash for null', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const ptsIndex = headers.indexOf('PTS')
  const toIndex = headers.indexOf('TO')
  const orebIndex = headers.indexOf('OREB')
  expect(cells[ptsIndex]).toHaveTextContent(/^\+1\.23/)
  expect(cells[toIndex]).toHaveTextContent(/^-0\.45/)
  expect(cells[orebIndex]).toHaveTextContent(/^—/)
})

test('z view shows the basis value under each scored z-score', () => {
  const { rerender } = renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      basis="per_game"
      zScores={zViewScores}
    />,
  )

  const pts = cellText('Nikola Jokic', 'PTS')
  expect(pts.childNodes[0]?.textContent).toBe('+1.23')
  expect(within(pts).getByTestId('basis-value')).toHaveTextContent('25.0')

  const oreb = cellText('Nikola Jokic', 'OREB')
  expect(within(oreb).getByTestId('basis-value')).toHaveTextContent('—')

  for (const header of ['Total Z', 'ESPN Rank', 'GP', 'MIN']) {
    expect(
      within(cellText('Nikola Jokic', header)).queryByTestId('basis-value'),
    ).not.toBeInTheDocument()
  }

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsTable
        rows={[jokic]}
        sortBy={null}
        sortDirection="desc"
        onSort={() => {}}
        emptyMessage="No projections yet. Use Update from source."
        view="z"
        basis="total"
        zScores={zViewScores}
      />
    </ThemeProvider>,
  )

  expect(
    within(cellText('Nikola Jokic', 'PTS')).getByTestId('basis-value').textContent,
  ).toBe('2050')
})

test('values view does not render a basis value under cells', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="values"
      basis="per_game"
    />,
  )

  expect(screen.queryByTestId('basis-value')).not.toBeInTheDocument()
})

test('Total Z header is absent in values view and present and sortable in z view', () => {
  const onSort = vi.fn()

  const { rerender } = renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={onSort}
      emptyMessage="No projections yet. Use Update from source."
      view="values"
    />,
  )

  expect(
    screen.queryByRole('button', { name: 'Total Z' }),
  ).not.toBeInTheDocument()

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsTable
        rows={[jokic]}
        sortBy={null}
        sortDirection="desc"
        onSort={onSort}
        emptyMessage="No projections yet. Use Update from source."
        view="z"
        zScores={zViewScores}
      />
    </ThemeProvider>,
  )

  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers.indexOf('Total Z')).toBe(headers.indexOf('ESPN Rank') + 1)
  fireEvent.click(screen.getByRole('button', { name: 'Total Z' }))
  expect(onSort).toHaveBeenCalledWith('z_total')
})

test('FGM header label switches from FGM/FGA in z view', () => {
  const { rerender } = renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(screen.getByRole('button', { name: 'FGM/FGA' })).toBeInTheDocument()

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsTable
        rows={[jokic]}
        sortBy={null}
        sortDirection="desc"
        onSort={() => {}}
        emptyMessage="No projections yet. Use Update from source."
        view="z"
        zScores={zViewScores}
      />
    </ThemeProvider>,
  )

  expect(screen.getByRole('button', { name: /^FGM$/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'FGM/FGA' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^FTM$/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^3PM$/ })).toBeInTheDocument()
})

test('delta caption is absent in z view', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const orebIndex = headers.indexOf('OREB')
  expect(
    within(cells[orebIndex]).queryByTitle('vs 2025-26 actual per game'),
  ).toBeNull()
  expect(cells[orebIndex]).toHaveStyle({ fontStyle: 'italic' })
  expect(cells[orebIndex]).toHaveAttribute(
    'title',
    'FNBA estimate (not projected by ESPN)',
  )
})

test('GP still renders its raw value in z view', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
    />,
  )

  const row = screen.getByText('Nikola Jokic').closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  const gpIndex = headers.indexOf('GP')
  expect(cells[gpIndex]).toHaveTextContent('82')
})

test('z view aria-label gains a z-scores suffix', () => {
  renderTable(
    <ProjectionsTable
      dataset="projection"
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
    />,
  )

  expect(
    screen.getByRole('table', { name: 'Player projections 2026-27, z-scores' }),
  ).toBeInTheDocument()
})

test('PTS shows 25.0 per game and 2050 on season totals', () => {
  const { rerender } = renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      basis="per_game"
    />,
  )

  expect(cellText('Nikola Jokic', 'PTS')).toHaveTextContent('25.0')
  expect(cellText('Nikola Jokic', 'GP')).toHaveTextContent('82')
  expect(cellText('Nikola Jokic', 'MIN')).toHaveTextContent('35.0')

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsTable
        rows={[jokic]}
        sortBy={null}
        sortDirection="desc"
        onSort={() => {}}
        emptyMessage="No projections yet. Use Update from source."
        basis="total"
      />
    </ThemeProvider>,
  )

  expect(cellText('Nikola Jokic', 'PTS')).toHaveTextContent('2050')
  expect(cellText('Nikola Jokic', 'PTS').textContent).toBe('2050')
  expect(cellText('Nikola Jokic', 'GP')).toHaveTextContent('82')
  expect(cellText('Nikola Jokic', 'MIN')).toHaveTextContent('2870')
})

test('FGM/FGA shows combined season totals', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      basis="total"
    />,
  )

  expect(cellText('Nikola Jokic', 'FGM/FGA')).toHaveTextContent('820/1400')
})

test('estimated DD keeps one decimal on season totals', () => {
  const estimated = {
    ...jokic,
    dd: 40.5,
    missing_stat_keys: ['oreb', 'dreb', 'pf', 'td'],
    estimated_stat_keys: ['dd'],
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      basis="total"
    />,
  )

  expect(cellText('Nikola Jokic', 'DD').textContent).toBe('40.5')
})

test('delta caption is absent on season totals', () => {
  const estimated = {
    ...jokic,
    gp: 72,
    oreb: 213,
    missing_stat_keys: ['dreb', 'pf', 'dd', 'td'],
    estimated_stat_keys: ['oreb'],
    prior_season: priorSeason,
  }

  renderTable(
    <ProjectionsTable
      rows={[estimated]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      basis="total"
    />,
  )

  const orebCell = cellText('Nikola Jokic', 'OREB')
  expect(within(orebCell).queryByTitle('vs 2025-26 actual per game')).toBeNull()
  expect(orebCell).toHaveStyle({ fontStyle: 'italic' })
})

test('FG% is identical on per-game and season totals', () => {
  const { rerender } = renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      basis="per_game"
    />,
  )

  const perGamePct = cellText('Nikola Jokic', 'FG%').textContent

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsTable
        rows={[jokic]}
        sortBy={null}
        sortDirection="desc"
        onSort={() => {}}
        emptyMessage="No projections yet. Use Update from source."
        basis="total"
      />
    </ThemeProvider>,
  )

  expect(cellText('Nikola Jokic', 'FG%').textContent).toBe(perGamePct)
})

test('totals basis aria-label gains a season totals suffix', () => {
  renderTable(
    <ProjectionsTable
      dataset="projection"
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      basis="total"
    />,
  )

  expect(
    screen.getByRole('table', {
      name: 'Player projections 2026-27, season totals',
    }),
  ).toBeInTheDocument()
})

function projectionCopy(id: number): Projection {
  return {
    ...jokic,
    id,
    player_id: id,
    full_name: `Player ${id}`,
  }
}

function cellBackground(cell: HTMLElement): string {
  const inline = cell.style.backgroundColor.trim()
  if (inline) return inline
  const css = injectedRuleText(cell)
  const match = css.match(/background(?:-color)?:\s*([^;]+)/i)
  if (match?.[1]) return match[1].trim()
  const computed = getComputedStyle(cell).backgroundColor.trim()
  if (
    computed &&
    computed !== 'rgba(0, 0, 0, 0)' &&
    computed !== 'transparent'
  ) {
    return computed
  }
  return ''
}

function expectHeat(
  cell: HTMLElement,
  z: number | null,
  cap: number,
) {
  const expected = heatBackground(z, cap)
  expect(expected).toBeTruthy()
  expect(cellBackground(cell)).toBe(expected)
}

function expectUnpainted(cell: HTMLElement) {
  expect(cellBackground(cell)).toBe('')
}

function injectedRuleText(element: Element): string {
  const styles = [...document.querySelectorAll('style')]
    .map((node) => node.textContent ?? '')
    .join('\n')
  const chunks: string[] = []
  for (const className of element.classList) {
    const needle = `.${className}`
    let from = 0
    while (from < styles.length) {
      const at = styles.indexOf(needle, from)
      if (at === -1) break
      const open = styles.indexOf('{', at)
      const close = open === -1 ? -1 : styles.indexOf('}', open)
      if (open === -1 || close === -1) break
      chunks.push(styles.slice(at, close + 1))
      from = close + 1
    }
  }
  return chunks.join('\n')
}

test('mounts only the viewport window for 300 rows', () => {
  const rows = Array.from({ length: 300 }, (_, index) => projectionCopy(index + 1))

  renderTable(
    <ProjectionsTable
      rows={rows}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr')
  expect(bodyRows.length).toBeLessThan(300)
  expect(screen.getByText('Player 1')).toBeInTheDocument()
  expect(screen.queryByText('Player 300')).not.toBeInTheDocument()

  const dataRows = [...bodyRows].filter(
    (row) => row.getAttribute('aria-hidden') !== 'true',
  )
  const spacerHeight = [...bodyRows]
    .filter((row) => row.getAttribute('aria-hidden') === 'true')
    .reduce(
      (sum, row) => sum + Number.parseFloat((row as HTMLElement).style.height || '0'),
      0,
    )
  expect(spacerHeight + dataRows.length * ROW_HEIGHT).toBe(300 * ROW_HEIGHT)
})

test('mounts only the viewport window for 300 rows in z view', () => {
  const rows = Array.from({ length: 300 }, (_, index) => projectionCopy(index + 1))

  renderTable(
    <ProjectionsTable
      rows={rows}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
    />,
  )

  const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr')
  expect(bodyRows.length).toBeLessThan(300)
  expect(screen.getByText('Player 1')).toBeInTheDocument()
  expect(screen.queryByText('Player 300')).not.toBeInTheDocument()

  const dataRows = [...bodyRows].filter(
    (row) => row.getAttribute('aria-hidden') !== 'true',
  )
  const spacerHeight = [...bodyRows]
    .filter((row) => row.getAttribute('aria-hidden') === 'true')
    .reduce(
      (sum, row) => sum + Number.parseFloat((row as HTMLElement).style.height || '0'),
      0,
    )
  expect(spacerHeight + dataRows.length * Z_ROW_HEIGHT).toBe(
    300 * Z_ROW_HEIGHT,
  )
})

test('keeps a bounded scroll container and a sticky header', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  const container = screen
    .getByRole('table')
    .closest('[class*="MuiTableContainer"]')
  expect(container).not.toBeNull()
  const element = container as HTMLElement
  const computed = getComputedStyle(element)
  const overflowIsAuto = computed.overflow === 'auto'
  const maxHeightIsBounded =
    computed.maxHeight !== '' &&
    computed.maxHeight !== 'none' &&
    computed.maxHeight !== '0px'
  if (!overflowIsAuto || !maxHeightIsBounded) {
    const css = injectedRuleText(element)
    expect(css).toMatch(/overflow:\s*auto/)
    expect(css).toMatch(/max-height:\s*(?!none\b)\S+/)
  }

  expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
  expect(
    screen
      .getAllByRole('columnheader')
      .some((cell) => cell.classList.contains('MuiTableCell-stickyHeader')),
  ).toBe(true)
})

test('Weighted Z and Δ Rank headers are absent by default', () => {
  const { rerender } = renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
    />,
  )

  expect(
    screen.queryByRole('button', { name: 'Weighted Z' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Δ Rank' }),
  ).not.toBeInTheDocument()

  rerender(
    <ThemeProvider theme={theme}>
      <ProjectionsTable
        rows={[jokic]}
        sortBy={null}
        sortDirection="desc"
        onSort={() => {}}
        emptyMessage="No projections yet. Use Update from source."
        view="z"
        zScores={zViewScores}
      />
    </ThemeProvider>,
  )

  expect(
    screen.queryByRole('button', { name: 'Weighted Z' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Δ Rank' }),
  ).not.toBeInTheDocument()
})

test('Weighted Z and Δ Rank render after Total Z for a weighted collection', () => {
  const onSort = vi.fn()
  const rows = [
    { ...jokic, id: 1, full_name: 'Up Two' },
    { ...jokic, id: 2, player_id: 2, full_name: 'Down One' },
    { ...jokic, id: 3, player_id: 3, full_name: 'Flat' },
    { ...jokic, id: 4, player_id: 4, full_name: 'Unranked' },
  ]

  renderTable(
    <ProjectionsTable
      rows={rows}
      sortBy={null}
      sortDirection="desc"
      onSort={onSort}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
      weighted={{
        name: 'Bench fouls',
        totals: new Map<number, number | null>([
          [1, 1.5],
          [2, -0.25],
          [3, 0],
          [4, null],
        ]),
        rankDelta: new Map<number, number | null>([
          [1, 2],
          [2, -1],
          [3, 0],
          [4, null],
        ]),
      }}
    />,
  )

  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers.indexOf('Weighted Z')).toBe(headers.indexOf('Total Z') + 1)
  expect(headers.indexOf('Δ Rank')).toBe(headers.indexOf('Weighted Z') + 1)

  fireEvent.click(screen.getByRole('button', { name: 'Weighted Z' }))
  expect(onSort).toHaveBeenCalledWith('z_weighted')
  fireEvent.click(screen.getByRole('button', { name: 'Δ Rank' }))
  expect(onSort).toHaveBeenCalledWith('z_rank_delta')

  expect(cellText('Up Two', 'Weighted Z')).toHaveTextContent('+1.50')
  expect(cellText('Down One', 'Weighted Z')).toHaveTextContent('-0.25')
  expect(cellText('Flat', 'Weighted Z').textContent).toBe('+0.00')
  expect(cellText('Unranked', 'Weighted Z')).toHaveTextContent('—')
  expect(cellText('Up Two', 'Δ Rank').textContent).toBe('+2')
  expect(cellText('Down One', 'Δ Rank').textContent).toBe('-1')
  expect(cellText('Flat', 'Δ Rank').textContent).toBe('0')
  expect(cellText('Unranked', 'Δ Rank').textContent).toBe('—')
})

test('z view aria-label includes the collection name when weighted', () => {
  renderTable(
    <ProjectionsTable
      dataset="projection"
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
      weighted={{
        name: 'Bench fouls',
        totals: new Map<number, number | null>([[1, 1.25]]),
        rankDelta: new Map<number, number | null>([[1, 2]]),
      }}
    />,
  )

  expect(
    screen.getByRole('table', {
      name: 'Player projections 2026-27, z-scores, weighted by Bench fouls',
    }),
  ).toBeInTheDocument()
})

test('heatmap colours scored cats and z totals from the fixture z', () => {
  const ptsZ = zViewScores.scores.get(1)?.cats.pts ?? null
  const toZ = zViewScores.scores.get(1)?.cats.to ?? null
  const orebZ = zViewScores.scores.get(1)?.cats.oreb ?? null
  const astZ = zViewScores.scores.get(1)?.cats.ast ?? null
  const totalZ = zViewScores.scores.get(1)?.total ?? null
  expect(ptsZ).toBe(1.23)
  expect(toZ).toBe(-0.45)
  expect(orebZ).toBeNull()
  expect(astZ).toBe(0)
  expect(totalZ).toBe(1.23)

  const injured = { ...jokic, injury_status: 'OUT' }
  const weightedZ = -4.5

  renderTable(
    <ProjectionsTable
      rows={[injured]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
      heatmap
      weighted={{
        name: 'Bench fouls',
        totals: new Map<number, number | null>([[1, weightedZ]]),
        rankDelta: new Map<number, number | null>([[1, 2]]),
      }}
    />,
  )

  const pts = cellText('Nikola Jokic', 'PTS')
  const to = cellText('Nikola Jokic', 'TO')
  expectHeat(pts, ptsZ, CAT_Z_CAP)
  expectHeat(to, toZ, CAT_Z_CAP)
  expect(cellBackground(pts)).not.toBe(cellBackground(to))
  expect(within(pts).getByTestId('basis-value')).toHaveTextContent('25.0')
  expectUnpainted(cellText('Nikola Jokic', 'OREB'))
  expectUnpainted(cellText('Nikola Jokic', 'AST'))
  expectHeat(cellText('Nikola Jokic', 'Total Z'), totalZ, TOTAL_Z_CAP)
  expectHeat(cellText('Nikola Jokic', 'Weighted Z'), weightedZ, TOTAL_Z_CAP)
  expectUnpainted(cellText('Nikola Jokic', 'Δ Rank'))
  expectUnpainted(cellText('Nikola Jokic', 'ESPN Rank'))
  expectUnpainted(cellText('Nikola Jokic', 'GP'))
  expectUnpainted(cellText('Nikola Jokic', 'MIN'))
  const player = cellText('Nikola Jokic', 'Player')
  expect(within(player).getByRole('img', { name: 'Out' })).toBeInTheDocument()
  expect(cellBackground(player)).not.toBe(cellBackground(pts))
})

test('heatmap off leaves z cells unpainted', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="z"
      zScores={zViewScores}
      heatmap={false}
    />,
  )

  expectUnpainted(cellText('Nikola Jokic', 'PTS'))
  expectUnpainted(cellText('Nikola Jokic', 'TO'))
  expectUnpainted(cellText('Nikola Jokic', 'Total Z'))
  expect(within(cellText('Nikola Jokic', 'PTS')).getByTestId('basis-value')).toHaveTextContent(
    '25.0',
  )
})

test('values view ignores heatmap', () => {
  renderTable(
    <ProjectionsTable
      rows={[jokic]}
      sortBy={null}
      sortDirection="desc"
      onSort={() => {}}
      emptyMessage="No projections yet. Use Update from source."
      view="values"
      zScores={zViewScores}
      heatmap
    />,
  )

  expect(cellText('Nikola Jokic', 'PTS')).toHaveTextContent('25.0')
  expectUnpainted(cellText('Nikola Jokic', 'PTS'))
  expectUnpainted(cellText('Nikola Jokic', 'TO'))
  expect(screen.queryByTestId('basis-value')).not.toBeInTheDocument()
})
