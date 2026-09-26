require "test_helper"

class SnakeDraftTest < ActiveSupport::TestCase
  ALL_POSITIONS = [ "PG", "SG", "SF", "PF", "C" ].freeze

  test "reverses snake direction each round" do
    order = [ "A", "B", "C" ]
    board = 9.times.map do |index|
      { player_id: index + 1, positions: ALL_POSITIONS, value: 100 - index }
    end

    picks = draft(order, board, 3)

    assert_equal [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ], picks.map { |pick| pick[:overall_pick] }
    assert_equal [ 1, 1, 1, 2, 2, 2, 3, 3, 3 ], picks.map { |pick| pick[:round] }
    assert_equal [ 1, 2, 3, 3, 2, 1, 1, 2, 3 ], picks.map { |pick| pick[:slot] }
    assert_equal [ "A", "B", "C", "C", "B", "A", "A", "B", "C" ], picks.map { |pick| pick[:team] }
    assert_equal (1..9).to_a, picks.map { |pick| pick[:player_id] }
    assert_equal (0..8).map { |index| 100 - index }, picks.map { |pick| pick[:value] }
  end

  test "skips a top-ranked player when no open slot accepts that position" do
    centers = 13.times.map do |index|
      { player_id: index + 1, positions: [ "C" ], value: 100 - index }
    end
    guard = { player_id: 99, positions: [ "PG" ], value: 0 }
    board = centers + [ guard ]

    picks = draft([ "Only" ], board, 13)

    assert_equal (1..12).to_a + [ 99 ], picks.map { |pick| pick[:player_id] }
    assert_equal [
      "C",
      "F/C",
      "UTIL",
      "UTIL",
      "UTIL",
      "UTIL",
      "BENCH",
      "BENCH",
      "BENCH",
      "BENCH",
      "BENCH",
      "BENCH",
      "PG"
    ], picks.map { |pick| pick[:roster_slot] }
    assert_equal [ 13 ], board.map { |player| player[:player_id] } - picks.map { |pick| pick[:player_id] }
  end

  test "assigns the earliest open slot: exact, then G or F/C, then UTIL, then BENCH" do
    pg_board = 7.times.map { |index| { player_id: index + 1, positions: [ "PG" ], value: 50 - index } }
    pg_picks = draft([ "Only" ], pg_board, 7)
    assert_equal [ "PG", "G", "UTIL", "UTIL", "UTIL", "UTIL", "BENCH" ], pg_picks.map { |pick| pick[:roster_slot] }

    pf_board = 3.times.map { |index| { player_id: index + 1, positions: [ "PF" ], value: 50 - index } }
    pf_picks = draft([ "Only" ], pf_board, 3)
    assert_equal [ "PF", "F/C", "UTIL" ], pf_picks.map { |pick| pick[:roster_slot] }

    c_board = 2.times.map { |index| { player_id: index + 1, positions: [ "C" ], value: 50 - index } }
    c_picks = draft([ "Only" ], c_board, 2)
    assert_equal [ "C", "F/C" ], c_picks.map { |pick| pick[:roster_slot] }

    both = [ { player_id: 1, positions: [ "C", "PG" ], value: 10 } ]
    both_picks = draft([ "Only" ], both, 1)
    assert_equal [ "PG" ], both_picks.map { |pick| pick[:roster_slot] }
  end

  test "drafts eight teams across sixteen rounds and stops" do
    order = League::TEAMS
    board = 130.times.map do |index|
      { player_id: index + 1, positions: ALL_POSITIONS, value: 1_000 - index }
    end

    picks = draft(order, board, League::ROUNDS)

    assert_equal 128, picks.size
    assert_equal (1..128).to_a, picks.map { |pick| pick[:overall_pick] }
    assert_equal [ 129, 130 ], board.map { |player| player[:player_id] } - picks.map { |pick| pick[:player_id] }
    assert_equal order.first, picks[0][:team]
    assert_equal 1, picks[0][:slot]
    assert_equal 1, picks[0][:round]
    assert_equal 1_000, picks[0][:value]
    assert_equal "PG", picks[0][:roster_slot]
    assert_equal order.last, picks[7][:team]
    assert_equal 8, picks[7][:slot]
    assert_equal order.last, picks[8][:team]
    assert_equal 8, picks[8][:slot]
    assert_equal 2, picks[8][:round]
    assert_equal order.first, picks[15][:team]
    assert_equal 1, picks[15][:slot]
    assert_equal 16, picks[127][:round]
    assert_equal 128, picks[127][:overall_pick]
  end

  test "late round with only a center slot open skips a better guard" do
    fillers = [
      { player_id: 1, positions: [ "PG" ], value: 100 },
      { player_id: 2, positions: [ "SG" ], value: 99 },
      { player_id: 3, positions: [ "SF" ], value: 98 },
      { player_id: 4, positions: [ "PF" ], value: 97 },
      { player_id: 5, positions: [ "PG" ], value: 96 },
      { player_id: 6, positions: [ "SF" ], value: 95 }
    ]
    4.times { |index| fillers << { player_id: 7 + index, positions: [ "PG" ], value: 90 - index } }
    6.times { |index| fillers << { player_id: 11 + index, positions: [ "SG" ], value: 80 - index } }
    guard = { player_id: 50, positions: [ "PG" ], value: 10 }
    center = { player_id: 60, positions: [ "C" ], value: 1 }

    picks = draft([ "Only" ], fillers + [ guard, center ], 17)

    assert_equal 17, picks.size
    assert_equal 60, picks.last[:player_id]
    assert_equal "C", picks.last[:roster_slot]
    remaining = (fillers + [ guard, center ]).map { |player| player[:player_id] } - picks.map { |pick| pick[:player_id] }
    assert_equal [ 50 ], remaining
  end

  test "raises BoardExhausted when the board runs out" do
    board = [ { player_id: 1, positions: ALL_POSITIONS, value: 1 } ]

    assert_raises(SnakeDraft::BoardExhausted) do
      draft([ "A", "B" ], board, 1)
    end
  end

  test "each team takes the first eligible player left in its own order" do
    a = { player_id: 1, positions: ALL_POSITIONS, value: 100, weighted_value: 1 }
    b = { player_id: 2, positions: ALL_POSITIONS, value: 90, weighted_value: 50 }
    c = { player_id: 3, positions: ALL_POSITIONS, value: 80, weighted_value: 40 }
    d = { player_id: 4, positions: ALL_POSITIONS, value: 70, weighted_value: 10 }

    picks = SnakeDraft.new(
      order: [ "Chino", "Other" ],
      orders: { "Chino" => [ b, c, d, a ], "Other" => [ a, b, c, d ] },
      rounds: 2
    ).picks

    assert_equal [ 2, 1, 3, 4 ], picks.map { |pick| pick[:player_id] }
    assert_equal [ "Chino", "Other", "Other", "Chino" ], picks.map { |pick| pick[:team] }
    assert_equal [ 90, 100, 80, 70 ], picks.map { |pick| pick[:value] }
    assert_equal [ 50, 1, 40, 10 ], picks.map { |pick| pick[:weighted_value] }
  end

  test "a player taken by one team is unavailable in every other team's order" do
    a = { player_id: 1, positions: ALL_POSITIONS, value: 100 }
    b = { player_id: 2, positions: ALL_POSITIONS, value: 90 }
    c = { player_id: 3, positions: ALL_POSITIONS, value: 80 }

    picks = SnakeDraft.new(
      order: [ "X", "Y", "Z" ],
      orders: { "X" => [ c, a, b ], "Y" => [ c, b, a ], "Z" => [ c, b, a ] },
      rounds: 1
    ).picks

    assert_equal [ 3, 2, 1 ], picks.map { |pick| pick[:player_id] }
  end

  test "the draft leaves every order unchanged" do
    board = 3.times.map { |index| { player_id: index + 1, positions: ALL_POSITIONS, value: 10 - index } }
    original = board.dup

    draft([ "A" ], board, 2)

    assert_equal original, board
  end

  test "raises BoardExhausted naming the team whose order has nobody left" do
    only = { player_id: 1, positions: ALL_POSITIONS, value: 1, weighted_value: 9 }

    error = assert_raises(SnakeDraft::BoardExhausted) do
      SnakeDraft.new(order: [ "Chino", "Other" ], orders: { "Chino" => [ only ], "Other" => [ only ] }, rounds: 1).picks
    end

    assert_match(/Other/, error.message)
  end

  private
    def draft(order, board, rounds)
      SnakeDraft.new(order: order, orders: order.to_h { |team| [ team, board ] }, rounds: rounds).picks
    end
end
