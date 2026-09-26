import type { DraftPick } from '../api/draft.ts'
import { POSITIONS } from './league.ts'

export type Position = (typeof POSITIONS)[number]

export type RosterSummary = {
  /** Number of the user's picks made so far (out of ROSTER_SIZE). */
  total: number
  /**
   * Picks per ESPN position. A dual-position player counts toward each of
   * its positions, so these can sum to more than `total`.
   */
  byPosition: Record<Position, number>
}

function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value)
}

export function rosterSummary(
  picks: DraftPick[],
  userEspnTeamId: number,
): RosterSummary {
  const byPosition = Object.fromEntries(
    POSITIONS.map((position) => [position, 0]),
  ) as Record<Position, number>
  let total = 0

  for (const pick of picks) {
    if (pick.espn_team_id !== userEspnTeamId) continue
    total += 1
    for (const position of pick.positions) {
      if (isPosition(position)) byPosition[position] += 1
    }
  }

  return { total, byPosition }
}
