export type DraftPick = {
  overall_pick: number
  round: number
  slot: number
  team: string
  player_id: number
  full_name: string
  positions: string[]
  nba_team: string
  injury_status: string | null
  roster_slot: string
  z_total: number
}

export type CategoryPoints = { value: number; points: number }

export type TeamStanding = {
  team: string
  roto_points: number
  rank: number
  cats: Record<string, CategoryPoints>
}

export type DraftRunView = {
  user_slot: number
  draft_order: string[]
  standings: TeamStanding[]
  picks: DraftPick[]
}

function cellIndex(value: number, size: number): number | null {
  if (!Number.isInteger(value) || value < 1 || value > size) return null
  return value - 1
}

// Place by pick.round and pick.slot. Do not re-derive the snake from overall_pick.
export function picksToGrid(
  picks: DraftPick[],
  teamCount: number,
  rounds: number,
): (DraftPick | null)[][] {
  const grid: (DraftPick | null)[][] = Array.from({ length: rounds }, () =>
    Array.from({ length: teamCount }, (): DraftPick | null => null),
  )

  for (const pick of picks) {
    const row = cellIndex(pick.round, rounds)
    const column = cellIndex(pick.slot, teamCount)
    if (row == null || column == null) continue
    grid[row][column] = pick
  }

  return grid
}

export function formatPick(pick: DraftPick): string {
  const positions = pick.positions.join('/')
  const totalZ = pick.z_total.toFixed(2)
  return `${pick.overall_pick}. ${pick.full_name} ${positions} ${pick.roster_slot} ${totalZ}`
}
