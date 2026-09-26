import type { CatWeights } from '../lib/catWeights.ts'
import type { DraftRunView } from '../lib/draftBoard.ts'

// The best weight collection found for one Team Chino draft slot, scored
// across a seeded set of opponent scenarios. `margin`, `rank`, `roto_points`,
// `draft_order`, `standings` and `picks` describe scenario 0, the base board.
export type WeightSearchRun = DraftRunView & {
  weight_set_name: string
  weights: CatWeights
  rank: number
  roto_points: number
  margin: number
  win_rate: number | null
  mean_margin: number | null
  worst_margin: number | null
  margins: number[] | null
  scenario_count: number | null
  noise_sd: number | null
  budget: number | null
  seed: number | null
  projection_imported_at: string | null
  created_at: string
}

// GET /api/weight_search: every saved slot run, ordered by slot.
export type WeightSearchList = {
  scenario_count: number
  runs: WeightSearchRun[]
}

const ERROR_MESSAGES: Record<string, string> = {
  board_too_small:
    'Not enough draftable players to fill 8 teams × 17 rounds',
  invalid_slot: 'Draft slot must be a whole number from 1 to 8',
}

export async function fetchWeightSearch(): Promise<WeightSearchList> {
  const response = await fetch('/api/weight_search')
  if (!response.ok) {
    throw new Error(`Failed to load winning weights (${response.status})`)
  }
  const body = (await response.json()) as Partial<WeightSearchList> | null
  if (!body || !Array.isArray(body.runs)) {
    throw new Error('Unexpected winning weights response')
  }
  return body as WeightSearchList
}

// Runs the search for one slot and returns its saved run, which replaces any
// earlier run for that slot.
export async function runWeightSearch(options: {
  userSlot: number
  budget?: number
}): Promise<WeightSearchRun> {
  const body: { user_slot: number; budget?: number } = {
    user_slot: options.userSlot,
  }
  if (typeof options.budget === 'number') body.budget = options.budget
  const response = await fetch('/api/weight_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await weightSearchErrorMessage(response))
  }
  return (await response.json()) as WeightSearchRun
}

async function weightSearchErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error && ERROR_MESSAGES[body.error]) {
      return ERROR_MESSAGES[body.error]
    }
    if (body.error) return body.error
  } catch {
    // non-JSON error bodies still map to a status message
  }
  return `Failed to find winning weights (${response.status})`
}
