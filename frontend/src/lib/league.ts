/**
 * League roster facts shared across the frontend.
 * Source: ESPN mSettings 2026-09-21 and docs/context/product-vision.md.
 *
 * ROSTER_SIZE = 17 rostered players per team (11 starters + 6 bench; IR excluded).
 * POOL_SIZE = 8 teams × 17 = 136, the rostered-player pool for z-scores and mock drafts.
 */
export const TEAM_COUNT = 8
export const ROSTER_SIZE = 17
export const POOL_SIZE = TEAM_COUNT * ROSTER_SIZE
export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const
