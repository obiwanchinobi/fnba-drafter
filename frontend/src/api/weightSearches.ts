import type { CatWeights } from '../lib/catWeights.ts'
import type { DraftRunView } from '../lib/draftBoard.ts'

// The best draft found for one Team Chino slot, with the weights that drove it.
export type WeightSearchRun = DraftRunView & {
  weight_set_name: string
  weights: CatWeights
  rank: number
  roto_points: number
  margin: number
  won: boolean
}

export type WeightSearch = {
  budget: number
  seed: number
  projection_imported_at: string
  runs: WeightSearchRun[]
}

const ERROR_MESSAGES: Record<string, string> = {
  board_too_small:
    'Not enough draftable players to fill 8 teams × 16 rounds',
}

export async function runWeightSearch(
  options: { budget?: number } = {},
): Promise<WeightSearch> {
  const body: { budget?: number } = {}
  if (typeof options.budget === 'number') body.budget = options.budget
  const response = await fetch('/api/weight_searches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await weightSearchErrorMessage(response))
  }
  return (await response.json()) as WeightSearch
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
