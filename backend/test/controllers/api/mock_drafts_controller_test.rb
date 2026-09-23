require "test_helper"

module Api
  class MockDraftsControllerTest < ActionDispatch::IntegrationTest
    STAT_LINE = {
      gp: 20, min: 2_000, fgm: 400, fga: 800, ftm: 200, fta: 250,
      tpm: 80, tpa: 240, oreb: 80, dreb: 320, ast: 240, stl: 80,
      blk: 40, to: 120, pf: 160, dd: 20, td: 4, pts: 1_080
    }.freeze

    test "POST /api/mock_drafts returns the show payload" do
      128.times { |index| create_draftable(espn_roto_rank: index + 1, pts: 1_080 + index) }

      post "/api/mock_drafts", params: { policy: "fnba_total_z" }, as: :json

      assert_response :created
      body = JSON.parse(response.body)
      assert_show_payload(body)

      get "/api/mock_drafts/#{body.fetch("id")}"
      assert_response :success
      assert_equal body.fetch("id"), JSON.parse(response.body).fetch("id")
    end

    test "POST /api/mock_drafts returns board_too_small when the board cannot fill" do
      post "/api/mock_drafts", params: { policy: "fnba_total_z" }, as: :json

      assert_response :unprocessable_entity
      assert_equal({ "error" => "board_too_small" }, JSON.parse(response.body))
    end

    test "POST /api/mock_drafts returns unknown_policy for a bad policy" do
      post "/api/mock_drafts", params: { policy: "adp" }, as: :json

      assert_response :unprocessable_entity
      assert_equal({ "error" => "unknown_policy" }, JSON.parse(response.body))
      assert_equal 0, MockDraft.count
    end

    test "GET /api/mock_drafts lists newest first with winners and Team Chino rank" do
      older = create_saved_draft(created_at: Time.utc(2026, 9, 1), user_rank: 4, user_points: 70)
      newer = create_saved_draft(created_at: Time.utc(2026, 9, 20), user_rank: 1, user_points: 110.5)

      get "/api/mock_drafts"

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal [ newer.id, older.id ], json.map { |row| row["id"] }
      run = json.first.fetch("runs").first
      assert_equal 1, run["user_slot"]
      assert_equal [ "Team Chino" ], run["winners"]
      assert_equal 1, run["user_rank"]
      assert_in_delta 110.5, run["user_roto_points"]
      assert_equal "fnba_total_z", json.first["policy"]
    end

    test "GET /api/mock_drafts/:id includes eight runs and 128 picks without a per-pick query" do
      128.times { |index| create_draftable(espn_roto_rank: index + 1) }
      draft = MockDraft.simulate!(policy: "fnba_total_z")

      ActiveRecord::Base.uncached do
        assert_queries_match(/FROM ["']players["']/, count: 1) do
          get "/api/mock_drafts/#{draft.id}"
        end
        assert_response :success
        assert_queries_match(/FROM ["']mock_draft_picks["']/, count: 1) do
          get "/api/mock_drafts/#{draft.id}"
        end
      end

      assert_show_payload(JSON.parse(response.body))
    end

    test "GET /api/mock_drafts/:id is 404 when the draft is missing" do
      get "/api/mock_drafts/0"

      assert_response :not_found
    end

    private
      def assert_show_payload(body)
        assert_equal "fnba_total_z", body["policy"]
        assert_equal "espn", body["source"]
        assert_equal Espn::SEASON, body["season"]
        assert_equal League::POOL_SIZE, body["pool_size"]
        assert_equal League::USER_TEAM, body["user_team"]
        assert_equal 8, body.fetch("runs").size

        body.fetch("runs").each_with_index do |run, index|
          assert_equal index + 1, run["user_slot"]
          assert_equal 8, run.fetch("draft_order").size
          assert_equal League::USER_TEAM, run.fetch("draft_order")[index]
          assert_equal 8, run.fetch("standings").size
          assert_equal 128, run.fetch("picks").size
          pick = run.fetch("picks").first
          assert_equal %w[
            player_id full_name positions nba_team injury_status round slot
            overall_pick team roster_slot z_total
          ].sort, pick.keys.sort
          assert_equal 1, pick["overall_pick"]
          assert_kind_of Numeric, pick["z_total"]
        end
      end

      def create_saved_draft(created_at:, user_rank:, user_points:)
        draft = MockDraft.create!(
          policy: "fnba_total_z",
          source: "espn",
          season: Espn::SEASON,
          projection_imported_at: Time.utc(2026, 9, 22),
          pool_size: League::POOL_SIZE,
          user_team: League::USER_TEAM,
          created_at: created_at,
          updated_at: created_at
        )
        draft.runs.create!(
          user_slot: 1,
          draft_order: [ "Team Chino" ],
          standings: [
            { "team" => "Team Chino", "roto_points" => user_points, "rank" => user_rank, "cats" => {} },
            { "team" => "Adam's All Stars", "roto_points" => 80, "rank" => user_rank == 1 ? 2 : 1, "cats" => {} }
          ]
        )
        draft
      end

      def next_espn_player_id
        @next_espn_player_id = @next_espn_player_id.to_i + 1
        (Process.pid * 1_000_000_000) + ((object_id % 1_000_000) * 1_000) + @next_espn_player_id
      end

      def create_player(**attrs)
        sequence = next_espn_player_id
        Player.create!(
          {
            first_name: "Mock",
            last_name: "Player#{sequence}",
            full_name: "Mock Player #{sequence}",
            positions: [ "PG", "SG", "SF", "PF", "C" ],
            nba_team: "DEN",
            espn_player_id: sequence
          }.merge(attrs)
        )
      end

      def create_draftable(**attrs)
        player = create_player
        PlayerProjection.create!(
          {
            player: player,
            source: "espn",
            season: Espn::SEASON,
            imported_at: Time.utc(2026, 9, 22),
            missing_stat_keys: [],
            estimated_stat_keys: []
          }.merge(STAT_LINE).merge(attrs)
        )
        player
      end
  end
end
