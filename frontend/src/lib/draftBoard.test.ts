import { expect, test } from 'vitest'
import { formatPick, picksToGrid, type DraftPick } from './draftBoard.ts'

function pick(
  overrides: Partial<DraftPick> &
    Pick<DraftPick, 'overall_pick' | 'round' | 'slot'>,
): DraftPick {
  return {
    team: 'Team A',
    player_id: overrides.overall_pick,
    full_name: `Player ${overrides.overall_pick}`,
    positions: ['PG'],
    nba_team: 'DEN',
    injury_status: null,
    roster_slot: 'PG',
    z_total: 1.25,
    z_weighted: null,
    ...overrides,
  }
}

test('grid is 17 x 8', () => {
  const grid = picksToGrid([], 8, 17)
  expect(grid).toHaveLength(17)
  for (const row of grid) {
    expect(row).toHaveLength(8)
    expect(row.every((cell) => cell == null)).toBe(true)
  }
})

test('places snake picks in the cells their round and slot name', () => {
  const first = pick({
    overall_pick: 1,
    round: 1,
    slot: 1,
    full_name: 'Opening Pick',
  })
  const ninth = pick({
    overall_pick: 9,
    round: 2,
    slot: 8,
    full_name: 'Ninth Pick',
  })
  const tenth = pick({
    overall_pick: 10,
    round: 2,
    slot: 7,
    full_name: 'Tenth Pick',
  })
  const grid = picksToGrid([tenth, first, ninth], 8, 17)

  expect(grid[0]?.[0]).toMatchObject({
    overall_pick: 1,
    round: 1,
    slot: 1,
    full_name: 'Opening Pick',
  })
  expect(grid[1]?.[7]).toMatchObject({
    overall_pick: 9,
    round: 2,
    slot: 8,
    full_name: 'Ninth Pick',
  })
  expect(grid[1]?.[6]).toMatchObject({
    overall_pick: 10,
    round: 2,
    slot: 7,
    full_name: 'Tenth Pick',
  })
})

test('trusts pick.round and pick.slot instead of re-deriving the snake', () => {
  const labeled = pick({
    overall_pick: 1,
    round: 2,
    slot: 8,
    full_name: 'Trust The Slot',
    player_id: 99,
  })
  const grid = picksToGrid([labeled], 8, 17)

  expect(grid[1]?.[7]?.full_name).toBe('Trust The Slot')
  expect(grid[0]?.[0]).toBeNull()
})

test('a hole in the picks leaves a null cell', () => {
  const grid = picksToGrid(
    [pick({ overall_pick: 1, round: 1, slot: 1, full_name: 'Only Pick' })],
    8,
    17,
  )

  expect(grid[0]?.[0]?.full_name).toBe('Only Pick')
  expect(grid[0]?.[1]).toBeNull()
  expect(grid[1]?.[7]).toBeNull()
})

test('ignores picks whose round or slot is outside the grid', () => {
  const grid = picksToGrid(
    [
      pick({ overall_pick: 1, round: 1, slot: 1, full_name: 'Kept' }),
      pick({ overall_pick: 200, round: 18, slot: 1, full_name: 'Past Last Round' }),
      pick({ overall_pick: 201, round: 1, slot: 9, full_name: 'Past Last Slot' }),
      pick({ overall_pick: 202, round: 0, slot: 1, full_name: 'Zero Round' }),
    ],
    8,
    17,
  )

  expect(grid).toHaveLength(17)
  expect(grid[0]).toHaveLength(8)
  expect(grid[0]?.[0]?.full_name).toBe('Kept')
  expect(grid.flat().some((cell) => cell?.full_name === 'Past Last Round')).toBe(
    false,
  )
  expect(grid.flat().some((cell) => cell?.full_name === 'Past Last Slot')).toBe(
    false,
  )
  expect(grid.flat().some((cell) => cell?.full_name === 'Zero Round')).toBe(false)
})

test('formatPick includes name, positions, roster slot, and overall pick number', () => {
  const text = formatPick(
    pick({
      overall_pick: 1,
      round: 1,
      slot: 1,
      full_name: 'Player Name',
      positions: ['PG', 'SG'],
      roster_slot: 'PG',
      z_total: 12.34,
    }),
  )

  expect(text).toBe('1. Player Name PG/SG PG 12.34')
})

test('formatPick prefixes total z and weighted z when z_weighted is a number', () => {
  const text = formatPick(
    pick({
      overall_pick: 1,
      round: 1,
      slot: 1,
      full_name: 'Player Name',
      positions: ['PG', 'SG'],
      roster_slot: 'PG',
      z_total: 12.34,
      z_weighted: 1.5,
    }),
  )

  expect(text).toBe('1. Player Name PG/SG PG Z 12.34 · W 1.50')
})
