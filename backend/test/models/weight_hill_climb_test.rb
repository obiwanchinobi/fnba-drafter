require "test_helper"
require_relative "../support/search_board_helpers"

class WeightHillClimbTest < ActiveSupport::TestCase
  include SearchBoardHelpers

  BUDGET = 25
  SEED = 20_260_926
  # Few scenarios keep the suite fast; WeightSearch::SCENARIO_COUNT is the real set.
  SCENARIO_COUNT = 3
  PICK_KEYS = %w[overall_pick player_id roster_slot round slot team z_total z_weighted].freeze

  setup do
    create_search_board
  end

  test "the best result is scored across every scenario, base scenario first" do
    scenarios = search_scenarios(SEED, SCENARIO_COUNT)

    bests_by_slot.each do |user_slot, best|
      margins = replay_margins(user_slot, best[:weights], scenarios)

      assert_equal SCENARIO_COUNT, best[:margins].size
      margins.zip(best[:margins]).each { |expected, actual| assert_in_delta expected, actual, 1e-9 }
      assert_in_delta margins.count(&:positive?).fdiv(SCENARIO_COUNT), best[:win_rate], 1e-12
      assert_in_delta margins.sum.fdiv(SCENARIO_COUNT), best[:mean_margin], 1e-9
      assert_in_delta margins.min, best[:worst_margin], 1e-9
      assert_in_delta best[:margins].first, best[:margin], 1e-9
    end
  end

  test "the same seeds give the same best result across plateau restarts" do
    budget = WeightHillClimb::PLATEAU_RESTART + 15

    assert_equal climb.best_for(5, budget), climb.best_for(5, budget)
  end

  test "each slot's rank, points, margin and won replay the base scenario through SnakeDraft and RotoStandings" do
    bests_by_slot.each do |user_slot, best|
      replayed = replay(user_slot, best[:weights])
      chino = chino_row(replayed)

      assert_equal chino["rank"], best[:rank], "slot #{user_slot} rank"
      assert_in_delta chino["roto_points"], best[:roto_points], 1e-9
      assert_in_delta chino["roto_points"] - best_other_points(replayed), best[:margin], 1e-9
      assert_equal best[:margin].positive?, best[:won]
      if best[:won]
        assert_equal [ League::USER_TEAM ], replayed.select { |row| row["rank"] == 1 }.map { |row| row["team"] }
      end
    end
  end

  test "the best weights never do worse than equal weights on win rate, mean margin, worst margin" do
    equal = WeightSet::CATEGORIES.index_with { 1.0 }
    scenarios = search_scenarios(SEED, SCENARIO_COUNT)

    improved = 0
    bests_by_slot.each do |user_slot, best|
      comparison = best.values_at(:win_rate, :mean_margin, :worst_margin) <=>
        objective(replay_margins(user_slot, equal, scenarios))

      assert_operator comparison, :>=, 0, "slot #{user_slot}"
      improved += 1 if comparison.positive?
    end
    assert_operator improved, :>, 0, "search should improve on equal weights for at least one slot"
  end

  test "weights are in range, on 0.05 steps, and cover every scored category" do
    bests_by_slot.each_value do |best|
      assert_equal WeightSet::CATEGORIES.sort, best[:weights].keys.sort
      best[:weights].each do |cat, weight|
        assert WeightSet::WEIGHT_RANGE.cover?(weight), "#{cat}=#{weight} out of range"
        assert_in_delta (weight * 20).round, weight * 20, 1e-6, "#{cat}=#{weight} is not a 0.05 step"
      end
    end
  end

  test "the best result keeps its draft order for the slot" do
    best = climb.best_for(3, BUDGET)

    assert_equal MockDraft.draft_order_for(3), best[:draft_order]
    assert_equal League::USER_TEAM, best[:draft_order][2]
  end

  test "the best result keeps all 128 picks in mock draft pick column shape" do
    best = climb.best_for(3, BUDGET)
    replayed = replay_picks(3, best[:weights])

    assert_equal League::TEAM_COUNT * League::ROUNDS, best[:picks].size
    best[:picks].each { |pick| assert_equal PICK_KEYS, pick.keys.sort }
    assert_equal (1..128).to_a, best[:picks].map { |pick| pick["overall_pick"] }
    assert_equal replayed.map { |pick| pick[:player_id] }, best[:picks].map { |pick| pick["player_id"] }
    assert_equal replayed.map { |pick| pick[:roster_slot] }, best[:picks].map { |pick| pick["roster_slot"] }
    replayed.zip(best[:picks]).each do |expected, pick|
      assert_equal expected.values_at(:round, :slot, :team), pick.values_at("round", "slot", "team")
      assert_in_delta expected[:value], pick["z_total"], 1e-9
      assert_in_delta expected[:weighted_value], pick["z_weighted"], 1e-9
    end
  end

  test "the best result keeps the roto standings its picks produce" do
    best = climb.best_for(3, BUDGET)
    by_player_id = espn_projections.index_by(&:player_id)
    rosters = best[:picks].group_by { |pick| pick["team"] }.transform_values do |picks|
      picks.map { |pick| by_player_id.fetch(pick["player_id"]) }
    end

    assert_equal RotoStandings.new(rosters).table, best[:standings]
    assert_equal best[:rank], chino_row(best[:standings])["rank"]
    assert_equal best[:roto_points], chino_row(best[:standings])["roto_points"]
  end

  private
    def climb
      projections = espn_projections
      WeightHillClimb.new(search_scenarios(SEED, SCENARIO_COUNT), projections.index_by(&:player_id), Random.new(SEED))
    end

    def bests_by_slot
      search = climb
      1.upto(League::TEAM_COUNT).to_h { |user_slot| [ user_slot, search.best_for(user_slot, BUDGET) ] }
    end
end
