import { ROSTER_SIZE, TEAM_COUNT } from './league.ts'

export type DraftClock = {
  /** Overall number of the pick now on the clock (1-based). */
  nextOverall: number | null
  round: number | null
  /** Slot (1-based index into the first-round order) that owns the next pick. */
  slot: number | null
  team: string | null
  /** Overall number of the user's next pick, null when none remains. */
  userNextOverall: number | null
  /** Picks that will be made before the user's next pick; 0 when on the clock. */
  picksUntilUser: number | null
  complete: boolean
}

const EMPTY: DraftClock = {
  nextOverall: null,
  round: null,
  slot: null,
  team: null,
  userNextOverall: null,
  picksUntilUser: null,
  complete: false,
}

// Same snake rule as SnakeDraft#picks: odd rounds run slot 1..N, even rounds N..1.
function slotForOverall(overall: number, teamCount: number): number {
  const round = Math.ceil(overall / teamCount)
  const pickInRound = ((overall - 1) % teamCount) + 1
  return round % 2 === 1 ? pickInRound : teamCount - pickInRound + 1
}

export function draftClock(
  order: string[],
  madePicks: number,
  userTeam: string,
  teamCount = TEAM_COUNT,
  rounds = ROSTER_SIZE,
): DraftClock {
  if (order.length === 0) return EMPTY

  const total = teamCount * rounds
  if (madePicks >= total) return { ...EMPTY, complete: true }

  const nextOverall = madePicks + 1
  const slot = slotForOverall(nextOverall, teamCount)
  const userSlot = order.indexOf(userTeam) + 1

  let userNextOverall: number | null = null
  if (userSlot > 0) {
    for (let overall = nextOverall; overall <= total; overall += 1) {
      if (slotForOverall(overall, teamCount) === userSlot) {
        userNextOverall = overall
        break
      }
    }
  }

  return {
    nextOverall,
    round: Math.ceil(nextOverall / teamCount),
    slot,
    team: order[slot - 1] ?? null,
    userNextOverall,
    picksUntilUser:
      userNextOverall == null ? null : userNextOverall - nextOverall,
    complete: false,
  }
}
