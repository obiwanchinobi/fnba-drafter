export const DEFAULT_PROJECTION_SOURCE = 'espn'
export const DEFAULT_PROJECTION_SEASON = 2027

export type Projection = {
  id: number
  player_id: number
  espn_player_id: number | null
  first_name: string
  last_name: string
  full_name: string
  positions: string[]
  nba_team: string
  injury_status: string | null
  source: string
  season: number
  gp: number | null
  min: number | null
  fgm: number | null
  fga: number | null
  fg_pct: number | null
  ftm: number | null
  fta: number | null
  ft_pct: number | null
  tpm: number | null
  tpa: number | null
  tp_pct: number | null
  oreb: number | null
  dreb: number | null
  ast: number | null
  ato: number | null
  stl: number | null
  str: number | null
  blk: number | null
  to: number | null
  pf: number | null
  dd: number | null
  td: number | null
  pts: number | null
  ppm: number | null
  imported_at: string
  missing_stat_keys: string[]
  estimated_stat_keys: string[]
  espn_roto_rank: number | null
  prior_season: {
    season: number
    gp: number | null
    oreb: number | null
    dreb: number | null
    pf: number | null
    dd: number | null
    td: number | null
  } | null
}

export type ProjectionRefresh = {
  source: string
  season: number
  player_count: number
  imported_at: string
}

const REFRESH_ERROR_MESSAGES: Record<string, string> = {
  espn_credentials_missing:
    'Log in to ESPN in Chrome, then try Update from source again',
  espn_cookies_unreadable:
    'Allow Keychain access so FNBA can read your ESPN Chrome session, then try again',
  espn_fetch_failed: 'Failed to fetch projections from source',
  unknown_source: 'Unknown projection source',
}

export async function fetchProjections(options?: {
  source?: string
  season?: number
}): Promise<Projection[]> {
  const source = options?.source ?? DEFAULT_PROJECTION_SOURCE
  const season = options?.season ?? DEFAULT_PROJECTION_SEASON
  const params = new URLSearchParams({
    source,
    season: String(season),
  })
  const response = await fetch(`/api/projections?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load projections (${response.status})`)
  }
  return (await response.json()) as Projection[]
}

export async function refreshProjections(options?: {
  source?: string
  season?: number
}): Promise<ProjectionRefresh> {
  const source = options?.source ?? DEFAULT_PROJECTION_SOURCE
  const season = options?.season ?? DEFAULT_PROJECTION_SEASON
  const response = await fetch('/api/projections/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, season }),
  })
  if (!response.ok) {
    throw new Error(await refreshErrorMessage(response))
  }
  return (await response.json()) as ProjectionRefresh
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
  return `Failed to refresh projections (${response.status})`
}
