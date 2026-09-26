import { expect, test } from 'vitest'
import {
  parseProjectionsSearch,
  serializeProjectionsSearch,
  type ProjectionsUrlState,
} from './projectionsUrlState.ts'

const DEFAULTS: ProjectionsUrlState = {
  dataset: 'projection',
  view: 'values',
  basis: 'per_game',
  weights: 'default',
  position: 'All',
  teams: [],
  search: '',
  sort: null,
  heat: false,
}

test('empty params yield defaults', () => {
  expect(parseProjectionsSearch(new URLSearchParams())).toEqual(DEFAULTS)
})

test('round-trips every key including heat', () => {
  const state: ProjectionsUrlState = {
    dataset: 'actual',
    view: 'z',
    basis: 'total',
    weights: 12,
    position: 'F/C',
    teams: ['DEN', 'BOS'],
    search: 'jok ic',
    sort: { column: 'pts', direction: 'asc' },
    heat: true,
  }

  const params = serializeProjectionsSearch(state)

  expect(parseProjectionsSearch(params)).toEqual(state)
  expect(params.get('dataset')).toBe('actual')
  expect(params.get('view')).toBe('z')
  expect(params.get('basis')).toBe('total')
  expect(params.get('weights')).toBe('12')
  expect(params.get('pos')).toBe('F/C')
  expect(params.get('teams')).toBe('DEN,BOS')
  expect(params.get('q')).toBe('jok ic')
  expect(params.get('sort')).toBe('pts')
  expect(params.get('dir')).toBe('asc')
  expect(params.get('heat')).toBe('1')
  expect(params.has('source')).toBe(false)
})

test('bad pos, dataset, basis, sort, dir, and weights fall back', () => {
  const params = new URLSearchParams({
    dataset: 'nope',
    view: 'bars',
    basis: 'weekly',
    weights: 'abc',
    pos: 'XX',
    sort: 'not-a-column',
    dir: 'sideways',
    heat: 'yes',
    teams: 'DEN,BOS',
    q: 'jok',
  })

  expect(parseProjectionsSearch(params)).toEqual({
    ...DEFAULTS,
    teams: ['DEN', 'BOS'],
    search: 'jok',
  })

  expect(
    parseProjectionsSearch(new URLSearchParams('sort=pts&dir=sideways')).sort,
  ).toEqual({ column: 'pts', direction: 'desc' })
  expect(
    parseProjectionsSearch(new URLSearchParams('sort=rank&dir=sideways')).sort,
  ).toEqual({ column: 'rank', direction: 'asc' })
  expect(parseProjectionsSearch(new URLSearchParams('dir=asc')).sort).toBeNull()

  for (const weights of ['0', '-1', '1.5', '01', 'default', '']) {
    expect(
      parseProjectionsSearch(new URLSearchParams({ weights })).weights,
    ).toBe('default')
  }
})

test('defaults are omitted on serialize', () => {
  expect(serializeProjectionsSearch(DEFAULTS).toString()).toBe('')

  const explicitDefaults = new URLSearchParams(
    'dataset=projection&view=values&basis=per_game&weights=default&pos=All&heat=0',
  )
  expect(
    serializeProjectionsSearch(parseProjectionsSearch(explicitDefaults)).toString(),
  ).toBe('')

  const params = serializeProjectionsSearch({
    ...DEFAULTS,
    view: 'z',
    sort: { column: 'pts', direction: 'desc' },
  })
  expect(params.get('view')).toBe('z')
  expect(params.get('sort')).toBe('pts')
  expect(params.has('dir')).toBe(false)
  expect(params.has('dataset')).toBe(false)
  expect(params.has('basis')).toBe(false)
  expect(params.has('weights')).toBe(false)
  expect(params.has('pos')).toBe(false)
  expect(params.has('q')).toBe(false)
  expect(params.has('teams')).toBe(false)
  expect(params.has('heat')).toBe(false)

  const rank = serializeProjectionsSearch({
    ...DEFAULTS,
    sort: { column: 'rank', direction: 'asc' },
  })
  expect(rank.get('sort')).toBe('rank')
  expect(rank.has('dir')).toBe(false)
  expect(
    parseProjectionsSearch(rank).sort,
  ).toEqual({ column: 'rank', direction: 'asc' })

  const rankDesc = serializeProjectionsSearch({
    ...DEFAULTS,
    sort: { column: 'rank', direction: 'desc' },
  })
  expect(rankDesc.get('dir')).toBe('desc')
})

test('teams splits and joins on commas', () => {
  expect(
    parseProjectionsSearch(new URLSearchParams('teams=DEN,BOS,NY')).teams,
  ).toEqual(['DEN', 'BOS', 'NY'])

  const params = serializeProjectionsSearch({
    ...DEFAULTS,
    teams: ['DEN', 'BOS', 'NY'],
  })
  expect(params.get('teams')).toBe('DEN,BOS,NY')
  expect(parseProjectionsSearch(params).teams).toEqual(['DEN', 'BOS', 'NY'])
  expect(params.toString()).toBe('teams=DEN%2CBOS%2CNY')
})
