require "test_helper"
require_relative "../support/search_board_helpers"

class WeightSearchTest < ActiveSupport::TestCase
  include SearchBoardHelpers

  BUDGET = 25
  SEED = 20_260_926
  # Few scenarios keep the suite fast; the default is WeightSearch::SCENARIO_COUNT.
  SCENARIOS = 3
  RUN_SNAPSHOT_KEYS = %w[
    user_slot weight_set_name weights rank roto_points margin won draft_order standings picks
  ].freeze

  setup do
    create_search_board
  end

  test "run! saves the search with one run per Team Chino slot and Draft slot N weight sets" do
    search = WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)

    assert search.persisted?
    assert_equal 1, WeightSearch.count
    assert_equal 8, WeightSearchRun.count
    search = WeightSearch.find(search.id)
    assert_equal BUDGET, search.budget
    assert_equal SEED, search.seed
    assert_equal "espn", search.source
    assert_equal Espn::SEASON, search.season
    assert_equal IMPORTED_AT, search.projection_imported_at
    assert_equal League::USER_TEAM, search.user_team
    runs = search.runs.order(:user_slot).to_a
    assert_equal (1..8).to_a, runs.map(&:user_slot)

    runs.each do |run|
      name = "Draft slot #{run.user_slot}"
      assert_equal name, run.weight_set_name
      assert_equal WeightSet::CATEGORIES.sort, run.weights.keys.sort
      assert_equal run.weights, WeightSet.find_by!(name: name).weights
    end

    names = WeightSet.order(:name).pluck(:name)
    assert_equal (1..8).map { |slot| "Draft slot #{slot}" }, names
  end

  test "search sizes: 24 scenarios, a 300 default budget and a 2,000 cap" do
    assert_equal 24, WeightSearch::SCENARIO_COUNT
    assert_equal 300, WeightSearch::DEFAULT_BUDGET
    assert_equal 2_000, WeightSearch::MAX_BUDGET
  end

  test "run! climbs each slot across seeded scenarios built from the board and ESPN ranks" do
    search = WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)

    climb = WeightHillClimb.new(
      search_scenarios(SEED, SCENARIOS), espn_projections.index_by(&:player_id), Random.new(SEED)
    )
    expected = 1.upto(League::TEAM_COUNT).map { |user_slot| climb.best_for(user_slot, BUDGET)[:weights] }
    assert_equal expected, search.runs.sort_by(&:user_slot).map(&:weights)
  end

  test "each saved run's margin is its base-scenario margin" do
    search = WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)
    scenarios = search_scenarios(SEED, SCENARIOS)

    search.runs.each do |run|
      assert_in_delta replay_margins(run.user_slot, run.weights, scenarios).first, run.margin.to_f, 1e-9
    end
  end

  test "each saved run keeps its weights when the Draft slot collection is edited later" do
    search = WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)
    run = search.runs.find_by!(user_slot: 3)
    saved = run.weights

    WeightSet.find_by!(name: "Draft slot 3").update!(weights: WeightSet::CATEGORIES.index_with { 4.95 })

    assert_equal saved, run.reload.weights
    refute_equal WeightSet.find_by!(name: "Draft slot 3").weights, run.weights
  end

  test "each saved run carries its draft order, 128 picks and the standings behind its score" do
    search = WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)

    WeightSearch.find(search.id).runs.order(:user_slot).each do |run|
      assert_equal MockDraft.draft_order_for(run.user_slot), run.draft_order
      assert_equal 128, run.picks.size
      assert_equal replay_picks(run.user_slot, run.weights).map { |pick| pick[:player_id] },
        run.picks.map { |pick| pick["player_id"] }
      assert_equal replay(run.user_slot, run.weights), run.standings
      assert_equal run.rank, chino_row(run.standings)["rank"]
      assert_in_delta chino_row(run.standings)["roto_points"], run.roto_points.to_f, 1e-9
      assert_in_delta chino_row(run.standings)["roto_points"] - best_other_points(run.standings),
        run.margin.to_f, 1e-9
      assert_equal run.margin.positive?, run.won
    end
  end

  test "the same seed gives the same weights, scores and drafts, across plateau restarts" do
    budget = WeightHillClimb::PLATEAU_RESTART + 15
    first = run_snapshots(WeightSearch.run!(budget: budget, seed: SEED, scenario_count: SCENARIOS))
    second = WeightSearch.run!(budget: budget, seed: SEED, scenario_count: SCENARIOS)

    assert_equal first, run_snapshots(second)
    assert_equal budget, second.budget
  end

  test "a different seed searches differently" do
    first = run_snapshots(WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS))
    second = run_snapshots(WeightSearch.run!(budget: BUDGET, seed: SEED + 1, scenario_count: SCENARIOS))

    refute_equal first.map { |run| run["weights"] }, second.map { |run| run["weights"] }
  end

  test "run! without a seed stores a generated seed that fits a bigint" do
    search = WeightSearch.run!(budget: 1)

    seed = WeightSearch.find(search.id).seed
    assert_kind_of Integer, seed
    assert_operator seed, :>=, 0
    assert_operator seed, :<, 1 << 63
  end

  test "a second run updates the Draft slot weight sets instead of duplicating them" do
    existing = WeightSet.create!(name: "draft SLOT 3", weights: WeightSet::CATEGORIES.index_with { 5.0 })
    other = WeightSet.create!(name: "Punt TO", weights: WeightSet::CATEGORIES.index_with { 2.0 })

    WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)
    ids = slot_weight_set_ids
    second = WeightSearch.run!(budget: BUDGET, seed: SEED + 1, scenario_count: SCENARIOS)

    assert_equal 9, WeightSet.count
    assert_equal ids, slot_weight_set_ids
    assert_includes ids, existing.id
    assert_equal WeightSet::CATEGORIES.index_with { 2.0 }, other.reload.weights
    second.runs.each do |run|
      assert_equal run.weights, WeightSet.find(ids[run.user_slot - 1]).weights
    end
  end

  test "a second run replaces the saved search and its runs" do
    first = WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)
    first_run_ids = first.runs.pluck(:id)
    second = WeightSearch.run!(budget: BUDGET, seed: SEED + 1, scenario_count: SCENARIOS)

    assert_equal [ second.id ], WeightSearch.pluck(:id)
    assert_equal SEED + 1, WeightSearch.sole.seed
    assert_equal 8, WeightSearchRun.count
    assert_equal [ second.id ], WeightSearchRun.distinct.pluck(:weight_search_id)
    assert_empty WeightSearchRun.where(id: first_run_ids)
  end

  test "a run that raises BoardTooSmall leaves the prior search untouched" do
    prior = WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS)
    prior_runs = run_snapshots(prior)
    PlayerProjection.where(source: "espn").order(:id).limit(PLAYER_COUNT - 127).destroy_all

    assert_raises(MockDraft::BoardTooSmall) { WeightSearch.run!(budget: BUDGET, seed: SEED + 1, scenario_count: SCENARIOS) }
    assert_equal [ prior.id ], WeightSearch.pluck(:id)
    assert_equal SEED, WeightSearch.sole.seed
    assert_equal prior_runs, run_snapshots(prior)
  end

  test "run! raises BoardTooSmall and saves nothing when fewer than 128 players are draftable" do
    PlayerProjection.where(source: "espn").order(:id).limit(PLAYER_COUNT - 127).destroy_all

    assert_raises(MockDraft::BoardTooSmall) { WeightSearch.run!(budget: BUDGET, seed: SEED, scenario_count: SCENARIOS) }
    assert_equal 0, WeightSet.count
    assert_equal 0, WeightSearch.count
    assert_equal 0, WeightSearchRun.count
  end

  private
    def slot_weight_set_ids
      (1..8).map { |slot| WeightSet.where("lower(name) = ?", "draft slot #{slot}").pick(:id) }
    end

    def run_snapshots(search)
      WeightSearch.find(search.id).runs.order(:user_slot).map { |run| run.attributes.slice(*RUN_SNAPSHOT_KEYS) }
    end
end
