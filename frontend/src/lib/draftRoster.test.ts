import { expect, test } from 'vitest'
import type { DraftPick } from '../api/draft.ts'
import { rosterSummary } from './draftRoster.ts'

const CHINO = 5

function pick(
  overall_pick: number,
  espn_team_id: number,
  positions: string[],
): DraftPick {
  return {
    overall_pick,
    round: 1,
    slot: overall_pick,
    team: espn_team_id === CHINO ? 'Team Chino' : `Team ${espn_team_id}`,
    espn_team_id,
    espn_player_id: 1000 + overall_pick,
    player_id: overall_pick,
    full_name: `Player ${overall_pick}`,
    positions,
    nba_team: 'DEN',
    injury_status: null,
  }
}

test('no picks gives zero for every position and a zero total', () => {
  expect(rosterSummary([], CHINO)).toEqual({
    total: 0,
    byPosition: { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 },
  })
})

test('a dual-position pick counts toward each listed position', () => {
  const summary = rosterSummary([pick(1, CHINO, ['PG', 'SG'])], CHINO)

  expect(summary).toEqual({
    total: 1,
    byPosition: { PG: 1, SG: 1, SF: 0, PF: 0, C: 0 },
  })
})

test("other teams' picks are ignored", () => {
  const summary = rosterSummary(
    [pick(1, 4, ['C']), pick(2, CHINO, ['SF']), pick(3, 7, ['PG', 'SG'])],
    CHINO,
  )

  expect(summary).toEqual({
    total: 1,
    byPosition: { PG: 0, SG: 0, SF: 1, PF: 0, C: 0 },
  })
})

test('the total counts Chino picks only, even when positions sum higher', () => {
  const summary = rosterSummary(
    [
      pick(1, 4, ['C']),
      pick(2, CHINO, ['PG']),
      pick(3, CHINO, ['SF', 'PF']),
      pick(4, CHINO, ['C']),
    ],
    CHINO,
  )

  expect(summary.total).toBe(3)
  expect(summary.byPosition).toEqual({ PG: 1, SG: 0, SF: 1, PF: 1, C: 1 })
})

test('positions outside the five scored slots are ignored', () => {
  const summary = rosterSummary([pick(1, CHINO, ['G', 'PG'])], CHINO)

  expect(summary).toEqual({
    total: 1,
    byPosition: { PG: 1, SG: 0, SF: 0, PF: 0, C: 0 },
  })
})
