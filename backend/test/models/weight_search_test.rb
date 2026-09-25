require "test_helper"

class WeightSearchTest < ActiveSupport::TestCase
  BASE_LINE = {
    gp: 70,
    min: 2_100,
    fgm: 420,
    fga: 880,
    ftm: 190,
    fta: 240,
    tpm: 110,
    tpa: 300,
    oreb: 70,
    dreb: 290,
    ast: 260,
    stl: 70,
    blk: 45,
    to: 140,
    pf: 150,
    dd: 15,
    td: 2,
    pts: 1_140
  }.freeze
  PLAYER_COUNT = 160
  BUDGET = 25
  SEED = 20_260_926

  setup do
    @imported_at = Time.utc(2026, 9, 25, 8, 30, 0)
    stats = Random.new(42)
    PLAYER_COUNT.times do |index|
      create_draftable(index, varied_line(stats))
    end
  end

  test "run! returns one row per Team Chino slot and saves Draft slot N weight sets" do
    result = WeightSearch.run!(budget: BUDGET, seed: SEED)

    assert_equal BUDGET, result[:budget]
    assert_equal SEED, result[:seed]
    assert_equal @imported_at, result[:projection_imported_at]
    assert_equal (1..8).to_a, result[:slots].map { |slot| slot[:user_slot] }

    result[:slots].each do |slot|
      weight_set = slot[:weight_set]
      assert_kind_of WeightSet, weight_set
      assert weight_set.persisted?
      assert_equal "Draft slot #{slot[:user_slot]}", weight_set.name
      assert_equal WeightSet::CATEGORIES.sort, weight_set.weights.keys.sort
      weight_set.weights.each do |cat, weight|
        assert WeightSet::WEIGHT_RANGE.cover?(weight), "#{cat}=#{weight} out of range"
        assert_in_delta (weight * 20).round, weight * 20, 1e-6, "#{cat}=#{weight} is not a 0.05 step"
      end
      assert_equal BUDGET, slot[:evaluations]
    end

    names = WeightSet.order(:name).pluck(:name)
    assert_equal (1..8).map { |slot| "Draft slot #{slot}" }, names
  end

  test "each slot's rank, points, margin and won replay through SnakeDraft and RotoStandings" do
    result = WeightSearch.run!(budget: BUDGET, seed: SEED)

    result[:slots].each do |slot|
      replayed = replay(slot[:user_slot], slot[:weight_set].weights)
      chino = chino_row(replayed)

      assert_equal chino["rank"], slot[:rank], "slot #{slot[:user_slot]} rank"
      assert_in_delta chino["roto_points"], slot[:roto_points], 1e-9
      assert_in_delta chino["roto_points"] - best_other_points(replayed), slot[:margin], 1e-9
      assert_equal slot[:margin].positive?, slot[:won]
      if slot[:won]
        assert_equal [ League::USER_TEAM ], replayed.select { |row| row["rank"] == 1 }.map { |row| row["team"] }
      end
    end
  end

  test "the saved weights never do worse than equal weights for that slot" do
    result = WeightSearch.run!(budget: BUDGET, seed: SEED)
    equal = WeightSet::CATEGORIES.index_with { 1.0 }

    improved = 0
    result[:slots].each do |slot|
      baseline = replay(slot[:user_slot], equal)
      chino_points = chino_row(baseline)["roto_points"]
      comparison = slot.values_at(:margin, :roto_points) <=> [ chino_points - best_other_points(baseline), chino_points ]

      assert_operator comparison, :>=, 0, "slot #{slot[:user_slot]}"
      improved += 1 if comparison.positive?
    end
    assert_operator improved, :>, 0, "search should improve on equal weights for at least one slot"
  end

  test "the same seed gives the same weights and scores, across plateau restarts" do
    budget = WeightSearch::PLATEAU_RESTART + 15
    first = summarize(WeightSearch.run!(budget: budget, seed: SEED))
    second = summarize(WeightSearch.run!(budget: budget, seed: SEED))

    assert_equal first, second
    assert first.all? { |slot| slot[:evaluations] == budget }
  end

  test "a second run updates the Draft slot weight sets instead of duplicating them" do
    existing = WeightSet.create!(name: "draft SLOT 3", weights: WeightSet::CATEGORIES.index_with { 5.0 })
    other = WeightSet.create!(name: "Punt TO", weights: WeightSet::CATEGORIES.index_with { 2.0 })

    first = WeightSearch.run!(budget: BUDGET, seed: SEED)
    ids = first[:slots].map { |slot| slot[:weight_set].id }
    second = WeightSearch.run!(budget: BUDGET, seed: SEED + 1)

    assert_equal 9, WeightSet.count
    assert_equal ids, second[:slots].map { |slot| slot[:weight_set].id }
    assert_includes ids, existing.id
    assert_equal WeightSet::CATEGORIES.index_with { 2.0 }, other.reload.weights
    second[:slots].each do |slot|
      assert_equal slot[:weight_set].weights, WeightSet.find(slot[:weight_set].id).weights
    end
  end

  test "run! raises BoardTooSmall and saves nothing when fewer than 128 players are draftable" do
    PlayerProjection.where(source: "espn").order(:id).limit(PLAYER_COUNT - 127).destroy_all

    assert_raises(MockDraft::BoardTooSmall) { WeightSearch.run!(budget: BUDGET, seed: SEED) }
    assert_equal 0, WeightSet.count
  end

  private
    def summarize(result)
      result[:slots].map do |slot|
        slot.except(:weight_set).merge(weights: slot[:weight_set].weights)
      end
    end

    def chino_row(table)
      table.find { |row| row["team"] == League::USER_TEAM }
    end

    def best_other_points(table)
      table.reject { |row| row["team"] == League::USER_TEAM }.map { |row| row["roto_points"] }.max
    end

    def replay(user_slot, weights)
      projections = PlayerProjection.includes(:player).where(source: "espn", season: Espn::SEASON).to_a
      board = MockDraft.draftable_board(projections, weights)
      picks = SnakeDraft.new(
        order: MockDraft.draft_order_for(user_slot),
        board: board,
        rounds: League::ROUNDS,
        ranking: { League::USER_TEAM => :weighted_value }
      ).picks
      RotoStandings.new(MockDraft.rosters_for(picks, projections.index_by(&:player_id))).table
    end

    def varied_line(stats)
      line = BASE_LINE.to_h do |key, value|
        next [ key, value ] if key == :gp

        [ key, (value * (0.35 + (stats.rand * 1.3))).round ]
      end
      line[:fga] = [ line[:fga], line[:fgm] + 1 ].max
      line[:fta] = [ line[:fta], line[:ftm] + 1 ].max
      line[:tpa] = [ line[:tpa], line[:tpm] + 1 ].max
      line
    end

    def create_draftable(index, line)
      player = Player.create!(
        first_name: "Search",
        last_name: "Player#{index}",
        full_name: "Search Player #{index}",
        positions: [ "PG", "SG", "SF", "PF", "C" ],
        nba_team: "DEN",
        espn_player_id: (Process.pid * 1_000_000) + index + 1
      )
      PlayerProjection.create!(
        {
          player: player,
          source: "espn",
          season: Espn::SEASON,
          imported_at: index.zero? ? @imported_at : Time.utc(2026, 9, 1),
          missing_stat_keys: [],
          estimated_stat_keys: [],
          espn_roto_rank: index + 1
        }.merge(line)
      )
    end
end
