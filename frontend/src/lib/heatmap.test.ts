import { expect, test } from 'vitest'
import { alpha } from '@mui/material/styles'
import {
  CAT_Z_CAP,
  HEAT_NEGATIVE,
  HEAT_POSITIVE,
  TOTAL_Z_CAP,
  heatBackground,
} from './heatmap.ts'

const FULL_ALPHA = 0.5
const HALF_ALPHA = FULL_ALPHA / 2

test('heatmap hues and caps are the diverging scale', () => {
  expect(HEAT_POSITIVE).toBe('#1f6fd6')
  expect(HEAT_NEGATIVE).toBe('#d43d3d')
  expect(CAT_Z_CAP).toBe(3)
  expect(TOTAL_Z_CAP).toBe(12)
})

test('null and zero z have no background', () => {
  expect(heatBackground(null, CAT_Z_CAP)).toBeUndefined()
  expect(heatBackground(0, CAT_Z_CAP)).toBeUndefined()
  expect(heatBackground(null, TOTAL_Z_CAP)).toBeUndefined()
  expect(heatBackground(0, TOTAL_Z_CAP)).toBeUndefined()
})

test('cap is full intensity and values beyond the cap clamp', () => {
  const fullPositive = alpha(HEAT_POSITIVE, FULL_ALPHA)
  const fullNegative = alpha(HEAT_NEGATIVE, FULL_ALPHA)

  expect(heatBackground(CAT_Z_CAP, CAT_Z_CAP)).toBe(fullPositive)
  expect(heatBackground(-CAT_Z_CAP, CAT_Z_CAP)).toBe(fullNegative)
  expect(heatBackground(TOTAL_Z_CAP, TOTAL_Z_CAP)).toBe(fullPositive)
  expect(heatBackground(-TOTAL_Z_CAP, TOTAL_Z_CAP)).toBe(fullNegative)
  expect(heatBackground(CAT_Z_CAP + 5, CAT_Z_CAP)).toBe(fullPositive)
  expect(heatBackground(-(TOTAL_Z_CAP + 9), TOTAL_Z_CAP)).toBe(fullNegative)
  expect(fullPositive).not.toBe(fullNegative)
})

test('half the cap is half of the full alpha', () => {
  expect(heatBackground(CAT_Z_CAP / 2, CAT_Z_CAP)).toBe(
    alpha(HEAT_POSITIVE, HALF_ALPHA),
  )
  expect(heatBackground(-(CAT_Z_CAP / 2), CAT_Z_CAP)).toBe(
    alpha(HEAT_NEGATIVE, HALF_ALPHA),
  )
  expect(heatBackground(TOTAL_Z_CAP / 2, TOTAL_Z_CAP)).toBe(
    alpha(HEAT_POSITIVE, HALF_ALPHA),
  )
  expect(heatBackground(-(TOTAL_Z_CAP / 2), TOTAL_Z_CAP)).toBe(
    alpha(HEAT_NEGATIVE, HALF_ALPHA),
  )
})
