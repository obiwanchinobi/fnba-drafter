require "test_helper"

module Api
  class WeightSearchesControllerTest < ActionDispatch::IntegrationTest
    RUN_KEYS = %w[draft_order margin picks rank roto_points standings user_slot weight_set_name weights won].freeze
    PICK_KEYS = %w[
      full_name injury_status nba_team overall_pick player_id positions roster_slot round slot team z_total z_weighted
    ].freeze

    test "GET /api/weight_search returns 404 when no search has been saved" do
      get "/api/weight_search"

      assert_response :not_found
    end

    test "GET /api/weight_search returns the latest saved search with runs by slot and hydrated picks" do
      players = Array.new(3) { |index| create_draftable(index).player }
      picks = players.each_with_index.map { |player, index| stub_pick(player, index + 1) }.reverse
      save_search(seed: 1, created_at: 2.days.ago, runs: [ stub_run(1, picks) ])
      latest = save_search(seed: 2, runs: [ 2, 1 ].map { |user_slot| stub_run(user_slot, picks) })

      ActiveRecord::Base.uncached do
        assert_queries_match(/FROM ["']players["']/, count: 1) do
          get "/api/weight_search"
        end
      end

      assert_response :success
      body = JSON.parse(response.body)
      assert_equal 2, body["seed"]
      assert_equal 5, body["budget"]
      assert_equal "2026-09-01T00:00:00.000Z", body["projection_imported_at"]
      assert_equal latest.created_at.utc.iso8601(3), body["created_at"]
      assert_equal [ 1, 2 ], body["runs"].map { |run| run["user_slot"] }
      run = body["runs"].first
      assert_equal RUN_KEYS, run.keys.sort
      assert_equal "Draft slot 1", run["weight_set_name"]
      assert_equal WeightSet::CATEGORIES.index_with { 1.0 }, run["weights"]
      assert_equal 1, run["rank"]
      assert_equal 100.5, run["roto_points"]
      assert_equal 2.5, run["margin"]
      assert_equal true, run["won"]
      assert_equal MockDraft.draft_order_for(1), run["draft_order"]
      assert_equal [ { "team" => League::USER_TEAM, "rank" => 1, "roto_points" => 100.5 } ], run["standings"]
      assert_equal [ 1, 2, 3 ], run["picks"].map { |pick| pick["overall_pick"] }
      assert_equal players.map(&:full_name), run["picks"].map { |pick| pick["full_name"] }
      run["picks"].each { |pick| assert_equal PICK_KEYS, pick.keys.sort }
      assert_equal "DEN", run["picks"].first["nba_team"]
      assert_equal 2.5, run["picks"].first["z_total"]
      assert_nil run["picks"].first["z_weighted"]
    end

    test "POST /api/weight_search runs and saves the search and returns it with 201" do
      130.times { |index| create_draftable(index) }

      post "/api/weight_search", params: { budget: 5, seed: 11 }, as: :json

      assert_response :created
      body = JSON.parse(response.body)
      search = WeightSearch.sole
      assert_equal 8, search.runs.count
      assert_equal 5, body["budget"]
      assert_equal 11, body["seed"]
      assert_equal "2026-09-01T00:00:00.000Z", body["projection_imported_at"]
      assert_equal search.created_at.utc.iso8601(3), body["created_at"]
      refute body.key?("slots")
      assert_equal (1..8).to_a, body["runs"].map { |run| run["user_slot"] }
      body["runs"].each do |run|
        assert_equal RUN_KEYS, run.keys.sort
        assert_equal "Draft slot #{run['user_slot']}", run["weight_set_name"]
        assert_equal WeightSet.find_by!(name: run["weight_set_name"]).weights, run["weights"]
        assert_includes [ true, false ], run["won"]
        assert_kind_of Numeric, run["roto_points"]
        assert_kind_of Numeric, run["margin"]
        assert_equal MockDraft.draft_order_for(run["user_slot"]), run["draft_order"]
        assert_equal 8, run["standings"].size
        assert_equal run["rank"], run["standings"].find { |row| row["team"] == League::USER_TEAM }["rank"]
        assert_equal 128, run["picks"].size
        assert_equal (1..128).to_a, run["picks"].map { |pick| pick["overall_pick"] }
        run["picks"].each { |pick| assert_equal PICK_KEYS, pick.keys.sort }
      end
      pick = body["runs"].first["picks"].first
      player = Player.find(pick["player_id"])
      assert_equal player.full_name, pick["full_name"]
      assert_equal player.positions, pick["positions"]
      assert_kind_of Float, pick["z_total"]
      assert_kind_of Float, pick["z_weighted"]
      assert_equal 8, WeightSet.count

      get "/api/weight_search"
      assert_response :success
      assert_equal body, JSON.parse(response.body)
    end

    test "POST /api/weight_search with too small a board returns 422 board_too_small and saves nothing" do
      post "/api/weight_search", params: { budget: 5 }, as: :json

      assert_response :unprocessable_entity
      assert_equal({ "error" => "board_too_small" }, JSON.parse(response.body))
      assert_equal 0, WeightSet.count
      assert_equal 0, WeightSearch.count
      assert_equal 0, WeightSearchRun.count
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
        stub_search = method(:save_search)
        WeightSearch.define_singleton_method(:run!) do |**kwargs|
          captured = kwargs
          stub_search.call(seed: 1, runs: [])
        end
        post "/api/weight_search", params: payload, as: :json
        assert_response :created
        captured
      ensure
        WeightSearch.define_singleton_method(:run!, original)
      end

      def save_search(seed:, runs:, created_at: Time.current)
        WeightSearch.create!(
          budget: 5,
          seed: seed,
          source: "espn",
          season: Espn::SEASON,
          projection_imported_at: Time.utc(2026, 9, 1),
          user_team: League::USER_TEAM,
          created_at: created_at,
          runs: runs.map { |attributes| WeightSearchRun.new(attributes) }
        )
      end

      def stub_run(user_slot, picks)
        {
          user_slot: user_slot,
          weight_set_name: "Draft slot #{user_slot}",
          weights: WeightSet::CATEGORIES.index_with { 1.0 },
          rank: 1,
          roto_points: 100.5,
          margin: 2.5,
          won: true,
          draft_order: MockDraft.draft_order_for(user_slot),
          standings: [ { "team" => League::USER_TEAM, "rank" => 1, "roto_points" => 100.5 } ],
          picks: picks
        }
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
