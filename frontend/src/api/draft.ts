import { REFRESH_ERROR_MESSAGES } from './projections.ts'

export type DraftPick = {
  overall_pick: number
  round: number
  slot: number
  team: string
  espn_team_id: number
  espn_player_id: number
  player_id: number | null
  full_name: string
  positions: string[]
  nba_team: string
  injury_status: string | null
}

export type DraftState = {
  season: number
  draft_order: string[]
  user_team: string
  user_espn_team_id: number
  in_progress: boolean
  drafted: boolean
  refreshed_at: string | null
  picks: DraftPick[]
}

export async function fetchDraft(): Promise<DraftState> {
  const response = await fetch('/api/draft')
  if (!response.ok) {
    throw new Error(`Failed to load draft (${response.status})`)
  }
  return (await response.json()) as DraftState
}

export async function refreshDraft(): Promise<DraftState> {
  const response = await fetch('/api/draft/refresh', { method: 'POST' })
  if (!response.ok) {
    throw new Error(await refreshErrorMessage(response))
  }
  return (await response.json()) as DraftState
}

async function refreshErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error && REFRESH_ERROR_MESSAGES[body.error]) {
      return REFRESH_ERROR_MESSAGES[body.error]
    }
    if (body.error) return body.error
  } catch {
    // non-JSON error bodies still map to a status message
  }
  return `Failed to refresh draft picks (${response.status})`
}
