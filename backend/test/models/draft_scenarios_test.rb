require "test_helper"

class DraftScenariosTest < ActiveSupport::TestCase
  ALL_POSITIONS = [ "PG", "SG", "SF", "PF", "C" ].freeze
  OPPONENTS = (League::TEAMS - [ League::USER_TEAM ]).freeze

  test "yields count scenarios with an order for each of the seven opponents only" do
    scenarios = build(count: 5).to_a

    assert_equal 5, scenarios.size
    scenarios.each do |scenario|
      assert_equal OPPONENTS.sort, scenario[:orders].keys.sort
    end
  end

  test "scenario 0 is the base: every opponent drafts the board in board order" do
    board = shuffled_board
    base = build(board: board, count: 3).first

    OPPONENTS.each do |team|
      assert_equal board.map { |entry| entry[:player_id] }, ids(base[:orders].fetch(team))
    end
  end

  test "orders hold the board's own entry objects" do
    board = shuffled_board
    by_id = board.index_by { |entry| entry[:player_id] }

    build(board: board, count: 3).each do |scenario|
      scenario[:orders].each_value do |order|
        assert_equal board.size, order.size
        order.each { |entry| assert_same by_id.fetch(entry[:player_id]), entry }
      end
    end
  end

  test "the same seed gives identical scenarios and another seed does not" do
    first = build(seed: 7, count: 6).map { |scenario| id_orders(scenario) }
    again = build(seed: 7, count: 6).map { |scenario| id_orders(scenario) }
    other = build(seed: 8, count: 6).map { |scenario| id_orders(scenario) }

    assert_equal first, again
    assert_not_equal first, other
  end

  test "N scenarios have N distinct opponent orders" do
    orders = build(count: 12).map { |scenario| id_orders(scenario) }

    assert_equal 12, orders.uniq.size
  end

  test "opponents within a noisy scenario disagree with each other" do
    noisy = build(count: 2).to_a.last

    assert_operator id_orders(noisy).values.uniq.size, :>, 1
  end

  test "noise sd is the population sd of Total Z minus the ESPN-rank ladder value" do
    board = [ 4.0, 3.0, 2.0, 1.0 ].each_with_index.map do |value, index|
      { player_id: index + 1, positions: ALL_POSITIONS, value: value }
    end
    # Ladder is [4, 3, 2, 1]. Residuals: 4 - 3, 3 - 4, 2 - 2, 1 - 1 = [1, -1, 0, 0].
    espn_ranks = { 1 => 2, 2 => 1, 3 => 3, 4 => 4 }

    scenarios = DraftScenarios.new(board: board, espn_ranks: espn_ranks, seed: 1, count: 2)

    assert_in_delta Math.sqrt(0.5), scenarios.noise_sd, 1e-12
  end

  test "noise sd only measures the top 128 board entries" do
    board, espn_ranks = tail_swapped_board

    assert_in_delta 0.0, DraftScenarios.new(board: board, espn_ranks: espn_ranks, seed: 1, count: 2).noise_sd, 1e-12
  end

  test "with no noise each opponent drafts either Total Z or the ESPN ladder, in about equal shares" do
    board, espn_ranks = tail_swapped_board
    total_z = ids(board)
    espn = total_z[0, 128] + total_z[128, 2].reverse

    orders = DraftScenarios.new(board: board, espn_ranks: espn_ranks, seed: 3, count: 41)
      .drop(1).flat_map { |scenario| id_orders(scenario).values }

    assert_equal 280, orders.size
    assert_equal [ espn, total_z ].sort, orders.uniq.sort
    espn_share = orders.count(espn).fdiv(orders.size)
    assert_in_delta 1 - DraftScenarios::TOTAL_Z_SHARE, espn_share, 0.1
  end

  test "a player with no ESPN rank keeps his own Total Z on the ladder" do
    board, espn_ranks = tail_swapped_board
    espn_ranks.delete(129)
    espn_ranks.delete(130)

    orders = DraftScenarios.new(board: board, espn_ranks: espn_ranks, seed: 3, count: 20)
      .flat_map { |scenario| id_orders(scenario).values }

    assert_equal [ ids(board) ], orders.uniq
  end

  test "noisy orders move players by about the measured sd in Total Z units" do
    board = 300.times.map { |index| { player_id: index + 1, positions: ALL_POSITIONS, value: (300 - index) * 0.1 } }
    # Blocks of four swap with their neighbour: every top-128 player is ranked
    # four ladder rungs away, half up and half down, so residuals are +-0.4 and sd 0.4.
    espn_ranks = board.to_h do |entry|
      index = entry[:player_id] - 1
      [ entry[:player_id], (index / 4).even? ? index + 5 : index - 3 ]
    end
    scenarios = DraftScenarios.new(board: board, espn_ranks: espn_ranks, seed: 11, count: 30)

    assert_in_delta 0.4, scenarios.noise_sd, 1e-9
    displacements = scenarios.drop(1).flat_map do |scenario|
      scenario[:orders].each_value.flat_map do |order|
        order.each_with_index.map { |entry, position| (entry[:player_id] - 1 - position).abs * 0.1 }
      end
    end
    mean_shift = displacements.sum / displacements.size
    # A 0.4 sd moves a player about 0.38 Total Z (four rungs 0.1 apart) on
    # average, so a noise scale far from the measured sd falls outside this band.
    assert_operator mean_shift, :>, 0.3
    assert_operator mean_shift, :<, 0.5
  end

  private
    def build(board: shuffled_board, seed: 20_260_926, count: 4)
      DraftScenarios.new(board: board, espn_ranks: espn_ranks_for(board), seed: seed, count: count)
    end

    def shuffled_board
      160.times.map do |index|
        { player_id: index + 1, positions: ALL_POSITIONS, value: 20.0 - (index * 0.125) }
      end
    end

    def espn_ranks_for(board)
      ranks = (1..board.size).to_a.shuffle(random: Random.new(5))
      board.each_with_index.to_h { |entry, index| [ entry[:player_id], ranks[index] ] }
    end

    # 130 players; ESPN agrees on the top 128 and swaps 129 and 130.
    def tail_swapped_board
      board = 130.times.map { |index| { player_id: index + 1, positions: ALL_POSITIONS, value: 200.0 - index } }
      ranks = board.to_h { |entry| [ entry[:player_id], entry[:player_id] ] }
      ranks[129] = 130
      ranks[130] = 129
      [ board, ranks ]
    end

    def ids(order)
      order.map { |entry| entry[:player_id] }
    end

    def id_orders(scenario)
      scenario[:orders].transform_values { |order| ids(order) }
    end
end
