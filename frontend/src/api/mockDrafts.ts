import type { DraftPick, TeamStanding } from '../lib/draftBoard.ts'

export type MockDraftRunSummary = {
  user_slot: number
  winners: string[]
  user_rank: number | null
  user_roto_points: number | null
}

export type MockDraftSummary = {
  id: number
  policy: string
  source: string
  season: number
  projection_imported_at: string
  pool_size: number
  user_team: string
  created_at: string
  runs: MockDraftRunSummary[]
}

export type MockDraftRun = MockDraftRunSummary & {
  id: number
  draft_order: string[]
  standings: TeamStanding[]
  picks: DraftPick[]
}

export type MockDraft = Omit<MockDraftSummary, 'runs'> & {
  runs: MockDraftRun[]
}

const ERROR_MESSAGES: Record<string, string> = {
  board_too_small:
    'Not enough draftable players to fill 8 teams × 16 rounds',
  unknown_policy: 'Unknown pick policy',
}

export async function fetchMockDrafts(): Promise<MockDraftSummary[]> {
  const response = await fetch('/api/mock_drafts')
  if (!response.ok) {
    throw new Error(`Failed to load mock drafts (${response.status})`)
  }
  return (await response.json()) as MockDraftSummary[]
}

export async function fetchMockDraft(id: number): Promise<MockDraft> {
  const response = await fetch(`/api/mock_drafts/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to load mock draft (${response.status})`)
  }
  return (await response.json()) as MockDraft
}

export async function createMockDraft(options: {
  policy: string
}): Promise<MockDraft> {
  const response = await fetch('/api/mock_drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy: options.policy }),
  })
  if (!response.ok) {
    throw new Error(await mockDraftErrorMessage(response))
  }
  return (await response.json()) as MockDraft
}

async function mockDraftErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error && ERROR_MESSAGES[body.error]) {
      return ERROR_MESSAGES[body.error]
    }
    if (body.error) return body.error
  } catch {
    // non-JSON error bodies still map to a status message
  }
  return `Failed to run mock draft (${response.status})`
}
