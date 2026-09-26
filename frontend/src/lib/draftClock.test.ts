import { expect, test } from 'vitest'
import { draftClock } from './draftClock.ts'

const ORDER = [
  'Trust in Pizza',
  'Team 2',
  'Team 3',
  'Team Chino',
  'Team 5',
  'Team 6',
  'Team 7',
  'Team 8',
]

test('pick 1 goes to the slot 1 team', () => {
  const clock = draftClock(ORDER, 0, 'Team Chino')

  expect(clock).toEqual({
    nextOverall: 1,
    round: 1,
    slot: 1,
    team: 'Trust in Pizza',
    userNextOverall: 4,
    picksUntilUser: 3,
    complete: false,
  })
})

test('pick 9 opens round 2 with the slot 8 team', () => {
  const clock = draftClock(ORDER, 8, 'Team Chino')

  expect(clock).toMatchObject({
    nextOverall: 9,
    round: 2,
    slot: 8,
    team: 'Team 8',
  })
})

test('Chino at slot 4 with 3 picks made is on the clock', () => {
  const clock = draftClock(ORDER, 3, 'Team Chino')

  expect(clock).toMatchObject({
    nextOverall: 4,
    team: 'Team Chino',
    userNextOverall: 4,
    picksUntilUser: 0,
  })
})

test('Chino at slot 4 with 5 picks made picks next at #13', () => {
  const clock = draftClock(ORDER, 5, 'Team Chino')

  expect(clock).toMatchObject({
    nextOverall: 6,
    round: 1,
    slot: 6,
    team: 'Team 6',
    userNextOverall: 13,
    picksUntilUser: 7,
    complete: false,
  })
})

test('136 picks made means the draft is complete', () => {
  const clock = draftClock(ORDER, 136, 'Team Chino')

  expect(clock).toEqual({
    nextOverall: null,
    round: null,
    slot: null,
    team: null,
    userNextOverall: null,
    picksUntilUser: null,
    complete: true,
  })
})

test('an empty order yields null fields and is not complete', () => {
  expect(draftClock([], 3, 'Team Chino')).toEqual({
    nextOverall: null,
    round: null,
    slot: null,
    team: null,
    userNextOverall: null,
    picksUntilUser: null,
    complete: false,
  })
})

test('a user team missing from the order leaves the user fields null', () => {
  const clock = draftClock(ORDER, 5, 'Someone Else')

  expect(clock).toMatchObject({
    nextOverall: 6,
    team: 'Team 6',
    userNextOverall: null,
    picksUntilUser: null,
    complete: false,
  })
})

test('no user pick remains once Chino has taken the last-round pick', () => {
  // Round 17 is odd, so slot 4 picks at overall 132; nothing of Chino's is left after it.
  const clock = draftClock(ORDER, 132, 'Team Chino')

  expect(clock).toMatchObject({
    nextOverall: 133,
    round: 17,
    slot: 5,
    team: 'Team 5',
    userNextOverall: null,
    picksUntilUser: null,
    complete: false,
  })
})

test('honours a custom team count and round count', () => {
  const clock = draftClock(['A', 'B', 'C'], 3, 'A', 3, 2)

  expect(clock).toMatchObject({
    nextOverall: 4,
    round: 2,
    slot: 3,
    team: 'C',
    userNextOverall: 6,
    picksUntilUser: 2,
    complete: false,
  })
  expect(draftClock(['A', 'B', 'C'], 6, 'A', 3, 2).complete).toBe(true)
})
