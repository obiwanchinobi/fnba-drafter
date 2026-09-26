require "test_helper"
require_relative "../support/search_board_helpers"

class WeightSearchTest < ActiveSupport::TestCase
  include SearchBoardHelpers

  BUDGET = 25
  SEED = 20_260_926
  # Few scenarios keep the suite fast; the default is WeightSearch::SCENARIO_COUNT.
  SCENARIOS = 3
  SLOT = 3
  RUN_SNAPSHOT_KEYS = %w[
    user_slot weight_set_name weights rank roto_points margin won draft_order standings picks
    win_rate mean_margin worst_margin margins scenario_count noise_sd budget seed source season
    projection_imported_at
  ].freeze

  setup do
    create_search_board
  end

  test "run! saves one run for the slot with its search metadata and a Draft slot N weight set" do
    run = search(SLOT)

    assert_kind_of WeightSearchRun, run
    assert run.persisted?
    assert_equal 1, WeightSearchRun.count
    run = WeightSearchRun.find(run.id)
    assert_equal SLOT, run.user_slot
    assert_equal BUDGET, run.budget
    assert_equal SEED, run.seed
    assert_equal "espn", run.source
    assert_equal Espn::SEASON, run.season
    assert_equal IMPORTED_AT, run.projection_imported_at
    assert_equal SCENARIOS, run.scenario_count
    assert_in_delta search_scenarios(SEED, SCENARIOS).noise_sd, run.noise_sd.to_f, 1e-9
    assert_equal "Draft slot #{SLOT}", run.weight_set_name
    assert_equal WeightSet::CATEGORIES.sort, run.weights.keys.sort
    assert_equal run.weights, WeightSet.find_by!(name: "Draft slot #{SLOT}").weights
    assert_equal [ "Draft slot #{SLOT}" ], WeightSet.pluck(:name)
  end

  test "search sizes: 24 scenarios, a 300 default budget and a 2,000 cap" do
    assert_equal 24, WeightSearch::SCENARIO_COUNT
    assert_equal 300, WeightSearch::DEFAULT_BUDGET
    assert_equal 2_000, WeightSearch::MAX_BUDGET
  end

  test "run! stores the slot's climb result across seeded scenarios built from the board and ESPN ranks" do
    run = WeightSearchRun.find(search(SLOT).id)

    climb = WeightHillClimb.new(
      search_scenarios(SEED, SCENARIOS), espn_projections.index_by(&:player_id), Random.new(SEED)
    )
    best = climb.best_for(SLOT, BUDGET)
    assert_equal best[:weights], run.weights
    assert_equal SCENARIOS, run.margins.size
    best[:margins].zip(run.margins).each { |expected, saved| assert_in_delta expected, saved, 1e-9 }
    assert_in_delta best[:win_rate], run.win_rate.to_f, 1e-9
    assert_in_delta best[:mean_margin], run.mean_margin.to_f, 1e-9
    assert_in_delta best[:worst_margin], run.worst_margin.to_f, 1e-9
    assert_in_delta objective(run.margins)[1], run.win_rate.to_f, 1e-9
    assert_equal best[:won], run.won
    assert_equal objective(run.margins)[0] == 1, run.won
  end

  test "the saved margins are the run's replayed scenario margins, scenario 0 first" do
    run = WeightSearchRun.find(search(SLOT).id)
    replayed = replay_margins(SLOT, run.weights, search_scenarios(SEED, SCENARIOS))

    replayed.zip(run.margins).each { |expected, saved| assert_in_delta expected, saved, 1e-9 }
    assert_in_delta replayed.first, run.margin.to_f, 1e-9
  end

  test "the saved run keeps its weights when the Draft slot collection is edited later" do
    run = search(SLOT)
    saved = run.weights

    WeightSet.find_by!(name: "Draft slot #{SLOT}").update!(weights: WeightSet::CATEGORIES.index_with { 4.95 })

    assert_equal saved, run.reload.weights
    refute_equal WeightSet.find_by!(name: "Draft slot #{SLOT}").weights, run.weights
  end

  test "the saved run carries its draft order, 136 picks and the base-scenario standings behind its score" do
    run = WeightSearchRun.find(search(SLOT).id)

    assert_equal MockDraft.draft_order_for(SLOT), run.draft_order
    assert_equal 136, run.picks.size
    assert_equal replay_picks(SLOT, run.weights).map { |pick| pick[:player_id] },
      run.picks.map { |pick| pick["player_id"] }
    assert_equal replay(SLOT, run.weights), run.standings
    assert_equal run.rank, chino_row(run.standings)["rank"]
    assert_in_delta chino_row(run.standings)["roto_points"], run.roto_points.to_f, 1e-9
    assert_in_delta chino_row(run.standings)["roto_points"] - best_other_points(run.standings),
      run.margin.to_f, 1e-9
    assert_equal run.margin.positive?, run.won
  end

  test "the same seed gives the same weights, scores and drafts, across plateau restarts" do
    budget = WeightHillClimb::PLATEAU_RESTART + 15
    first = snapshot(search(SLOT, budget: budget))
    second = search(SLOT, budget: budget)

    assert_equal first, snapshot(second)
    assert_equal budget, second.budget
  end

  test "a different seed searches differently" do
    first = snapshot(search(SLOT))
    second = snapshot(search(SLOT, seed: SEED + 1))

    refute_equal first["weights"], second["weights"]
  end

  test "run! without a seed stores a generated seed that fits a bigint" do
    run = WeightSearch.run!(user_slot: SLOT, budget: 1, scenario_count: SCENARIOS)

    seed = WeightSearchRun.find(run.id).seed
    assert_kind_of Integer, seed
    assert_operator seed, :>=, 0
    assert_operator seed, :<, 1 << 63
  end

  test "run! uses the full scenario set by default" do
    run = WeightSearch.run!(user_slot: SLOT, budget: 1, seed: SEED)

    assert_equal WeightSearch::SCENARIO_COUNT, run.scenario_count
    assert_equal WeightSearch::SCENARIO_COUNT, run.margins.size
  end

  test "running the same slot again replaces that run and leaves other slots untouched" do
    other = snapshot(search(1))
    first = search(SLOT)
    second = search(SLOT, seed: SEED + 1)

    assert_equal [ 1, SLOT ], WeightSearchRun.order(:user_slot).pluck(:user_slot)
    assert_empty WeightSearchRun.where(id: first.id)
    assert_equal SEED + 1, WeightSearchRun.find_by!(user_slot: SLOT).seed
    assert_equal second.id, WeightSearchRun.find_by!(user_slot: SLOT).id
    assert_equal other, snapshot(WeightSearchRun.find_by!(user_slot: 1))
  end

  test "a second run updates the Draft slot weight set instead of duplicating it" do
    existing = WeightSet.create!(name: "draft SLOT 3", weights: WeightSet::CATEGORIES.index_with { 5.0 })
    other = WeightSet.create!(name: "Punt TO", weights: WeightSet::CATEGORIES.index_with { 2.0 })

    search(SLOT)
    second = search(SLOT, seed: SEED + 1)

    assert_equal 2, WeightSet.count
    assert_equal second.weights, existing.reload.weights
    assert_equal existing.name, second.weight_set_name
    assert_equal WeightSet::CATEGORIES.index_with { 2.0 }, other.reload.weights
  end

  test "a run that raises BoardTooSmall leaves the prior run untouched" do
    prior = snapshot(search(SLOT))
    PlayerProjection.where(source: "espn").order(:id).limit(PLAYER_COUNT - 135).destroy_all

    assert_raises(MockDraft::BoardTooSmall) { search(SLOT, seed: SEED + 1) }
    assert_equal prior, snapshot(WeightSearchRun.sole)
  end

  test "run! raises BoardTooSmall and saves nothing when fewer than 136 players are draftable" do
    PlayerProjection.where(source: "espn").order(:id).limit(PLAYER_COUNT - 135).destroy_all

    assert_raises(MockDraft::BoardTooSmall) { search(SLOT) }
    assert_equal 0, WeightSet.count
    assert_equal 0, WeightSearchRun.count
  end

  test "run! rejects a slot outside 1..8 before searching and saves nothing" do
    [ 0, 9, nil ].each do |user_slot|
      assert_raises(ArgumentError) { search(user_slot, budget: 1) }
    end
    assert_equal 0, WeightSearchRun.count
    assert_equal 0, WeightSet.count
  end

  private
    def search(user_slot, budget: BUDGET, seed: SEED)
      WeightSearch.run!(user_slot: user_slot, budget: budget, seed: seed, scenario_count: SCENARIOS)
    end

    def snapshot(run)
      WeightSearchRun.find(run.id).attributes.slice(*RUN_SNAPSHOT_KEYS)
    end
end
