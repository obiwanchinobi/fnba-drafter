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
  espn_roto_rank: number | null
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
