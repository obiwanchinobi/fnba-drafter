require "test_helper"

module Api
  class WeightSearchesControllerTest < ActionDispatch::IntegrationTest
    RUN_KEYS = %w[
      budget created_at draft_order margin margins mean_margin noise_sd picks projection_imported_at rank
      roto_points scenario_count season seed source standings user_slot weight_set_name weights win_rate
      won worst_margin
    ].freeze
    PICK_KEYS = %w[
      full_name injury_status nba_team overall_pick player_id positions roster_slot round slot team z_total z_weighted
    ].freeze

    test "GET /api/weight_search returns the scenario count and no runs when nothing has been saved" do
      get "/api/weight_search"

      assert_response :success
      assert_equal({ "scenario_count" => WeightSearch::SCENARIO_COUNT, "runs" => [] }, JSON.parse(response.body))
    end

    test "GET /api/weight_search returns every saved slot's run by slot with hydrated picks" do
      players = Array.new(3) { |index| create_draftable(index).player }
      picks = players.each_with_index.map { |player, index| stub_pick(player, index + 1) }.reverse
      [ 6, 2 ].each { |user_slot| save_run(user_slot, picks) }

      ActiveRecord::Base.uncached do
        assert_queries_match(/FROM ["']players["']/, count: 1) do
          get "/api/weight_search"
        end
      end

      assert_response :success
      body = JSON.parse(response.body)
      assert_equal 24, body["scenario_count"]
      assert_equal [ 2, 6 ], body["runs"].map { |run| run["user_slot"] }
      run = body["runs"].first
      saved = WeightSearchRun.find_by!(user_slot: 2)
      assert_equal RUN_KEYS, run.keys.sort
      assert_equal "Draft slot 2", run["weight_set_name"]
      assert_equal WeightSet::CATEGORIES.index_with { 1.0 }, run["weights"]
      assert_equal 1, run["rank"]
      assert_equal 100.5, run["roto_points"]
      assert_equal 2.5, run["margin"]
      assert_equal true, run["won"]
      assert_equal 0.5, run["win_rate"]
      assert_equal 0.75, run["mean_margin"]
      assert_equal(-1.0, run["worst_margin"])
      assert_equal [ 2.5, -1.0 ], run["margins"]
      assert_equal 2, run["scenario_count"]
      assert_equal 1.25, run["noise_sd"]
      assert_equal 5, run["budget"]
      assert_equal 12, run["seed"]
      assert_equal "espn", run["source"]
      assert_equal Espn::SEASON, run["season"]
      assert_equal "2026-09-01T00:00:00.000Z", run["projection_imported_at"]
      assert_equal saved.created_at.utc.iso8601(3), run["created_at"]
      assert_equal MockDraft.draft_order_for(2), run["draft_order"]
      assert_equal [ { "team" => League::USER_TEAM, "rank" => 1, "roto_points" => 100.5 } ], run["standings"]
      assert_equal [ 1, 2, 3 ], run["picks"].map { |pick| pick["overall_pick"] }
      assert_equal players.map(&:full_name), run["picks"].map { |pick| pick["full_name"] }
      run["picks"].each { |pick| assert_equal PICK_KEYS, pick.keys.sort }
      assert_equal "DEN", run["picks"].first["nba_team"]
      assert_equal 2.5, run["picks"].first["z_total"]
      assert_nil run["picks"].first["z_weighted"]
    end

    test "POST /api/weight_search runs one slot, saves it and returns that run with 201" do
      130.times { |index| create_draftable(index) }

      post "/api/weight_search", params: { user_slot: 6, budget: 2, seed: 11 }, as: :json

      assert_response :created
      run = JSON.parse(response.body)
      saved = WeightSearchRun.sole
      assert_equal 6, saved.user_slot
      assert_equal RUN_KEYS, run.keys.sort
      assert_equal 6, run["user_slot"]
      assert_equal 2, run["budget"]
      assert_equal 11, run["seed"]
      assert_equal "espn", run["source"]
      assert_equal Espn::SEASON, run["season"]
      assert_equal WeightSearch::SCENARIO_COUNT, run["scenario_count"]
      assert_equal WeightSearch::SCENARIO_COUNT, run["margins"].size
      assert_equal run["margins"].first, run["margin"]
      assert_equal run["margin"].positive?, run["won"]
      assert_kind_of Float, run["win_rate"]
      assert_kind_of Float, run["mean_margin"]
      assert_kind_of Float, run["worst_margin"]
      assert_kind_of Float, run["noise_sd"]
      assert_equal "2026-09-01T00:00:00.000Z", run["projection_imported_at"]
      assert_equal saved.created_at.utc.iso8601(3), run["created_at"]
      assert_equal "Draft slot 6", run["weight_set_name"]
      assert_equal WeightSet.find_by!(name: "Draft slot 6").weights, run["weights"]
      assert_kind_of Numeric, run["roto_points"]
      assert_equal MockDraft.draft_order_for(6), run["draft_order"]
      assert_equal 8, run["standings"].size
      assert_equal run["rank"], run["standings"].find { |row| row["team"] == League::USER_TEAM }["rank"]
      assert_equal (1..128).to_a, run["picks"].map { |pick| pick["overall_pick"] }
      run["picks"].each { |pick| assert_equal PICK_KEYS, pick.keys.sort }
      pick = run["picks"].first
      player = Player.find(pick["player_id"])
      assert_equal player.full_name, pick["full_name"]
      assert_kind_of Float, pick["z_weighted"]
      assert_equal 1, WeightSet.count

      get "/api/weight_search"
      assert_response :success
      assert_equal({ "scenario_count" => 24, "runs" => [ run ] }, JSON.parse(response.body))
    end

    test "POST /api/weight_search without a slot in 1..8 returns 422 invalid_slot and runs nothing" do
      130.times { |index| create_draftable(index) }
      [ {}, { user_slot: 0 }, { user_slot: 9 }, { user_slot: "3" }, { user_slot: 2.5 } ].each do |payload|
        post "/api/weight_search", params: payload.merge(budget: 1), as: :json

        assert_response :unprocessable_entity
        assert_equal({ "error" => "invalid_slot" }, JSON.parse(response.body))
      end
      post "/api/weight_search", params: "not json", headers: { "CONTENT_TYPE" => "application/json" }
      assert_response :unprocessable_entity
      assert_equal 0, WeightSearchRun.count
      assert_equal 0, WeightSet.count
    end

    test "POST /api/weight_search with too small a board returns 422 board_too_small and saves nothing" do
      post "/api/weight_search", params: { user_slot: 1, budget: 5 }, as: :json

      assert_response :unprocessable_entity
      assert_equal({ "error" => "board_too_small" }, JSON.parse(response.body))
      assert_equal 0, WeightSet.count
      assert_equal 0, WeightSearchRun.count
    end

    test "the slot is passed through to the search" do
      assert_equal 4, run_args_for({ user_slot: 4 })[:user_slot]
    end

    test "budget is clamped to 1..MAX_BUDGET and defaults when absent or not an integer" do
      assert_equal WeightSearch::MAX_BUDGET, run_args_for({ budget: WeightSearch::MAX_BUDGET + 1 })[:budget]
      assert_equal 1, run_args_for({ budget: 0 })[:budget]
      assert_equal WeightSearch::DEFAULT_BUDGET, run_args_for({})[:budget]
      assert_equal WeightSearch::DEFAULT_BUDGET, run_args_for({ budget: "lots" })[:budget]
    end

    test "seed is passed through only when it is an integer that fits a bigint" do
      assert_nil run_args_for({})[:seed]
      assert_equal 7, run_args_for({ seed: 7 })[:seed]
      assert_equal (1 << 63) - 1, run_args_for({ seed: (1 << 63) - 1 })[:seed]
      assert_nil run_args_for({ seed: "seven" })[:seed]
      assert_nil run_args_for({ seed: 1 << 63 })[:seed]
      assert_nil run_args_for({ seed: -1 })[:seed]
      assert_nil run_args_for({ seed: 1 << 100 })[:seed]
    end

    private
      # Captures the keyword arguments the controller passes, without running a search.
      def run_args_for(payload)
        captured = nil
        original = WeightSearch.method(:run!)
        stub_save = method(:save_run)
        WeightSearch.define_singleton_method(:run!) do |**kwargs|
          captured = kwargs
          stub_save.call(kwargs[:user_slot], [])
        end
        post "/api/weight_search", params: { user_slot: 1 }.merge(payload), as: :json
        assert_response :created
        captured
      ensure
        WeightSearch.define_singleton_method(:run!, original)
      end

      def save_run(user_slot, picks)
        WeightSearchRun.where(user_slot: user_slot).delete_all
        WeightSearchRun.create!(
          user_slot: user_slot,
          weight_set_name: "Draft slot #{user_slot}",
          weights: WeightSet::CATEGORIES.index_with { 1.0 },
          rank: 1,
          roto_points: 100.5,
          margin: 2.5,
          won: true,
          win_rate: 0.5,
          mean_margin: 0.75,
          worst_margin: -1.0,
          margins: [ 2.5, -1.0 ],
          scenario_count: 2,
          noise_sd: 1.25,
          budget: 5,
          seed: 12,
          source: "espn",
          season: Espn::SEASON,
          projection_imported_at: Time.utc(2026, 9, 1),
          draft_order: MockDraft.draft_order_for(user_slot),
          standings: [ { "team" => League::USER_TEAM, "rank" => 1, "roto_points" => 100.5 } ],
          picks: picks
        )
      end

      def stub_pick(player, overall_pick)
        {
          "round" => 1,
          "slot" => overall_pick,
          "overall_pick" => overall_pick,
          "team" => League::TEAMS[overall_pick - 1],
          "player_id" => player.id,
          "roster_slot" => "UTIL",
          "z_total" => 2.5,
          "z_weighted" => nil
        }
      end

      def create_draftable(index)
        player = Player.create!(
          first_name: "Search",
          last_name: "Api#{index}",
          full_name: "Search Api #{index}",
          positions: [ "PG", "SG", "SF", "PF", "C" ],
          nba_team: "DEN",
          espn_player_id: (Process.pid * 1_000_000) + index + 1
        )
        PlayerProjection.create!(
          player: player,
          source: "espn",
          season: Espn::SEASON,
          imported_at: Time.utc(2026, 9, 1),
          missing_stat_keys: [],
          estimated_stat_keys: [],
          espn_roto_rank: index + 1,
          gp: 60,
          min: 1_800 + index,
          fgm: 300 + (index % 17) * 10,
          fga: 700,
          ftm: 150 + (index % 11) * 5,
          fta: 250,
          tpm: 60 + (index % 7) * 8,
          tpa: 240,
          oreb: 50 + (index % 13) * 6,
          dreb: 200 + (index % 5) * 20,
          ast: 150 + (index % 19) * 10,
          stl: 50 + (index % 3) * 10,
          blk: 30 + (index % 23) * 3,
          to: 100 + (index % 9) * 8,
          pf: 120 + (index % 4) * 10,
          dd: 10 + (index % 6),
          td: index % 3,
          pts: 900 + (index % 29) * 20
        )
      end
  end
end
