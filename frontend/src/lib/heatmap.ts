/**
 * Diverging cell colour for a stored z.
 * Positive is blue and negative is red; zero and null stay on the paper.
 * Alpha is min(|z| / cap, 1) * 0.5. TO and PF are already reversed upstream.
 */
import { alpha } from '@mui/material/styles'

export const HEAT_POSITIVE = '#1f6fd6'
export const HEAT_NEGATIVE = '#d43d3d'
export const CAT_Z_CAP = 3
export const TOTAL_Z_CAP = 12

export function heatBackground(
  z: number | null,
  cap: number,
): string | undefined {
  if (z == null || z === 0) return undefined
  const strength = Math.min(Math.abs(z) / cap, 1) * 0.5
  return alpha(z > 0 ? HEAT_POSITIVE : HEAT_NEGATIVE, strength)
}
