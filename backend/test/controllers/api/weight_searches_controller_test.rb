require "test_helper"

module Api
  class WeightSearchesControllerTest < ActionDispatch::IntegrationTest
    RUN_KEYS = %w[draft_order margin picks rank roto_points standings user_slot weight_set_name weights won].freeze
    PICK_KEYS = %w[
      full_name injury_status nba_team overall_pick player_id positions roster_slot round slot team z_total z_weighted
    ].freeze

    test "POST /api/weight_searches runs the search and returns one drillable run per slot" do
      130.times { |index| create_draftable(index) }

      post "/api/weight_searches", params: { budget: 5, seed: 11 }, as: :json

      assert_response :success
      body = JSON.parse(response.body)
      assert_equal 5, body["budget"]
      assert_equal 11, body["seed"]
      assert body["projection_imported_at"].present?
      refute body.key?("slots")
      assert_equal (1..8).to_a, body["runs"].map { |run| run["user_slot"] }
      body["runs"].each do |run|
        assert_equal RUN_KEYS, run.keys.sort
        assert_equal "Draft slot #{run['user_slot']}", run["weight_set_name"]
        assert_equal WeightSet.find_by!(name: run["weight_set_name"]).weights, run["weights"]
        assert_includes [ true, false ], run["won"]
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
      assert_equal "DEN", pick["nba_team"]
      assert_kind_of Float, pick["z_total"]
      assert_kind_of Float, pick["z_weighted"]
      assert_equal 8, WeightSet.count
    end

    test "POST /api/weight_searches hydrates every pick's player with one query" do
      players = Array.new(3) { |index| create_draftable(index).player }
      runs = (1..2).map do |user_slot|
        stub_run(user_slot, players.each_with_index.map { |player, index| stub_pick(player, index + 1) })
      end

      ActiveRecord::Base.uncached do
        with_run_result({ budget: 5, seed: 1, projection_imported_at: Time.utc(2026, 9, 1), runs: runs }) do
          assert_queries_match(/FROM ["']players["']/, count: 1) do
            post "/api/weight_searches", params: { budget: 5 }, as: :json
          end
        end
      end

      assert_response :success
      body = JSON.parse(response.body)
      assert_equal [ 1, 2 ], body["runs"].map { |run| run["user_slot"] }
      assert_equal players.map(&:full_name), body["runs"].last["picks"].map { |pick| pick["full_name"] }
      assert_equal 2.5, body["runs"].first["picks"].first["z_total"]
      assert_nil body["runs"].first["picks"].first["z_weighted"]
    end

    test "POST /api/weight_searches with too small a board returns 422 board_too_small" do
      post "/api/weight_searches", params: { budget: 5 }, as: :json

      assert_response :unprocessable_entity
      assert_equal({ "error" => "board_too_small" }, JSON.parse(response.body))
      assert_equal 0, WeightSet.count
    end

    test "budget is clamped to 1..MAX_BUDGET and defaults when absent or not an integer" do
      assert_equal WeightSearch::MAX_BUDGET, run_args_for({ budget: WeightSearch::MAX_BUDGET + 1 })[:budget]
      assert_equal 1, run_args_for({ budget: 0 })[:budget]
      assert_equal WeightSearch::DEFAULT_BUDGET, run_args_for({})[:budget]
      assert_equal WeightSearch::DEFAULT_BUDGET, run_args_for({ budget: "lots" })[:budget]
      assert_nil run_args_for({})[:seed]
      assert_equal 7, run_args_for({ seed: 7 })[:seed]
      assert_nil run_args_for({ seed: "seven" })[:seed]
    end

    private
      # Captures the keyword arguments the controller passes, without running a search.
      def run_args_for(payload)
        captured = nil
        original = WeightSearch.method(:run!)
        WeightSearch.define_singleton_method(:run!) do |**kwargs|
          captured = kwargs
          { budget: kwargs[:budget], seed: kwargs[:seed], projection_imported_at: nil, runs: [] }
        end
        post "/api/weight_searches", params: payload, as: :json
        assert_response :success
        captured
      ensure
        WeightSearch.define_singleton_method(:run!, original)
      end

      def with_run_result(result)
        original = WeightSearch.method(:run!)
        WeightSearch.define_singleton_method(:run!) { |**| result }
        yield
      ensure
        WeightSearch.define_singleton_method(:run!, original)
      end

      def stub_run(user_slot, picks)
        {
          user_slot: user_slot,
          weight_set_name: "Draft slot #{user_slot}",
          weights: WeightSet::CATEGORIES.index_with { 1.0 },
          rank: 1,
          roto_points: 100.0,
          margin: 2.0,
          won: true,
          draft_order: MockDraft.draft_order_for(user_slot),
          standings: [],
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
