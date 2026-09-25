require "test_helper"
require_relative "../support/search_board_helpers"

class WeightSearchTest < ActiveSupport::TestCase
  include SearchBoardHelpers

  BUDGET = 25
  SEED = 20_260_926

  setup do
    create_search_board
  end

  test "run! returns one run per Team Chino slot and saves Draft slot N weight sets" do
    result = WeightSearch.run!(budget: BUDGET, seed: SEED)

    assert_equal BUDGET, result[:budget]
    assert_equal SEED, result[:seed]
    assert_equal IMPORTED_AT, result[:projection_imported_at]
    assert_equal (1..8).to_a, result[:runs].map { |run| run[:user_slot] }

    result[:runs].each do |run|
      name = "Draft slot #{run[:user_slot]}"
      assert_equal name, run[:weight_set_name]
      assert_equal WeightSet::CATEGORIES.sort, run[:weights].keys.sort
      assert_equal run[:weights], WeightSet.find_by!(name: name).weights
      refute run.key?(:evaluations)
    end

    names = WeightSet.order(:name).pluck(:name)
    assert_equal (1..8).map { |slot| "Draft slot #{slot}" }, names
  end

  test "each run carries its draft order, 128 picks and the standings behind its score" do
    result = WeightSearch.run!(budget: BUDGET, seed: SEED)

    result[:runs].each do |run|
      assert_equal MockDraft.draft_order_for(run[:user_slot]), run[:draft_order]
      assert_equal 128, run[:picks].size
      assert_equal replay_picks(run[:user_slot], run[:weights]).map { |pick| pick[:player_id] },
        run[:picks].map { |pick| pick["player_id"] }
      assert_equal replay(run[:user_slot], run[:weights]), run[:standings]
      assert_equal run[:rank], chino_row(run[:standings])["rank"]
      assert_in_delta chino_row(run[:standings])["roto_points"] - best_other_points(run[:standings]), run[:margin], 1e-9
      assert_equal run[:margin].positive?, run[:won]
    end
  end

  test "the same seed gives the same weights, scores and drafts, across plateau restarts" do
    budget = WeightHillClimb::PLATEAU_RESTART + 15
    first = WeightSearch.run!(budget: budget, seed: SEED)
    second = WeightSearch.run!(budget: budget, seed: SEED)

    assert_equal first[:runs], second[:runs]
    assert_equal budget, second[:budget]
  end

  test "a second run updates the Draft slot weight sets instead of duplicating them" do
    existing = WeightSet.create!(name: "draft SLOT 3", weights: WeightSet::CATEGORIES.index_with { 5.0 })
    other = WeightSet.create!(name: "Punt TO", weights: WeightSet::CATEGORIES.index_with { 2.0 })

    WeightSearch.run!(budget: BUDGET, seed: SEED)
    ids = slot_weight_set_ids
    second = WeightSearch.run!(budget: BUDGET, seed: SEED + 1)

    assert_equal 9, WeightSet.count
    assert_equal ids, slot_weight_set_ids
    assert_includes ids, existing.id
    assert_equal WeightSet::CATEGORIES.index_with { 2.0 }, other.reload.weights
    second[:runs].each do |run|
      assert_equal run[:weights], WeightSet.find(ids[run[:user_slot] - 1]).weights
    end
  end

  test "run! raises BoardTooSmall and saves nothing when fewer than 128 players are draftable" do
    PlayerProjection.where(source: "espn").order(:id).limit(PLAYER_COUNT - 127).destroy_all

    assert_raises(MockDraft::BoardTooSmall) { WeightSearch.run!(budget: BUDGET, seed: SEED) }
    assert_equal 0, WeightSet.count
  end

  private
    def slot_weight_set_ids
      (1..8).map { |slot| WeightSet.where("lower(name) = ?", "draft slot #{slot}").pick(:id) }
    end
end
