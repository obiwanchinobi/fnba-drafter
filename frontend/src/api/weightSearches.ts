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

// The search as saved by the API: GET and POST /api/weight_search.
export type SavedWeightSearch = WeightSearch & {
  created_at: string
}

const ERROR_MESSAGES: Record<string, string> = {
  board_too_small:
    'Not enough draftable players to fill 8 teams × 16 rounds',
}

// The last saved search, or null when none has been run yet.
export async function fetchWeightSearch(): Promise<SavedWeightSearch | null> {
  const response = await fetch('/api/weight_search')
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Failed to load winning weights (${response.status})`)
  }
  const body = (await response.json()) as Partial<SavedWeightSearch> | null
  if (!body || !Array.isArray(body.runs)) {
    throw new Error('Unexpected winning weights response')
  }
  return body as SavedWeightSearch
}

export async function runWeightSearch(
  options: { budget?: number } = {},
): Promise<SavedWeightSearch> {
  const body: { budget?: number } = {}
  if (typeof options.budget === 'number') body.budget = options.budget
  const response = await fetch('/api/weight_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await weightSearchErrorMessage(response))
  }
  return (await response.json()) as SavedWeightSearch
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
