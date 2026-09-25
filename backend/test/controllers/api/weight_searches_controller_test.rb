require "test_helper"

module Api
  class WeightSearchesControllerTest < ActionDispatch::IntegrationTest
    test "POST /api/weight_searches runs the search and returns one row per slot" do
      130.times { |index| create_draftable(index) }

      post "/api/weight_searches", params: { budget: 5, seed: 11 }, as: :json

      assert_response :success
      body = JSON.parse(response.body)
      assert_equal 5, body["budget"]
      assert_equal 11, body["seed"]
      assert body["projection_imported_at"].present?
      assert_equal (1..8).to_a, body["slots"].map { |slot| slot["user_slot"] }
      body["slots"].each do |slot|
        assert_equal %w[evaluations margin rank roto_points user_slot weight_set won], slot.keys.sort
        assert_equal 5, slot["evaluations"]
        assert_equal %w[id name updated_at weights], slot["weight_set"].keys.sort
        assert_equal "Draft slot #{slot['user_slot']}", slot["weight_set"]["name"]
        assert_includes [ true, false ], slot["won"]
      end
      assert_equal 8, WeightSet.count
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
          { budget: kwargs[:budget], seed: kwargs[:seed], projection_imported_at: nil, slots: [] }
        end
        post "/api/weight_searches", params: payload, as: :json
        assert_response :success
        captured
      ensure
        WeightSearch.define_singleton_method(:run!, original)
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
