require "test_helper"

module Api
  class SeasonStatsControllerTest < ActionDispatch::IntegrationTest
    test "GET /api/season_stats returns 200 and an empty list when none exist" do
      get "/api/season_stats"

      assert_response :success
      assert_equal [], JSON.parse(response.body)
    end

    test "GET /api/season_stats tags rows as actuals with no rank estimates or prior_season" do
      player = create_player(
        first_name: "Nikola",
        last_name: "Jokic",
        full_name: "Nikola Jokic",
        positions: [ "C" ],
        nba_team: "DEN",
        injury_status: "DTD",
        espn_player_id: 3_112_335
      )
      imported_at = Time.utc(2026, 9, 18, 12, 0, 0)
      create_season_stat(
        player: player,
        source: "espn",
        season: 2026,
        gp: 70,
        min: 2_555,
        fgm: 720,
        fga: 1_300,
        ftm: 350,
        fta: 430,
        tpm: 140,
        tpa: 380,
        oreb: 192,
        dreb: 644,
        ast: 700,
        stl: 110,
        blk: 50,
        to: 230,
        pf: 173,
        dd: 55,
        td: 34,
        pts: 1_800,
        imported_at: imported_at
      )

      get "/api/season_stats"

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal 1, json.size

      row = json.first
      assert_equal "Nikola Jokic", row["full_name"]
      assert_equal "espn", row["source"]
      assert_equal 2026, row["season"]
      assert_equal "actual", row["dataset"]
      assert_nil row["espn_roto_rank"]
      assert_equal [], row["estimated_stat_keys"]
      assert_equal [], row["missing_stat_keys"]
      assert_nil row["prior_season"]
      assert_equal imported_at.iso8601(3), Time.parse(row["imported_at"]).utc.iso8601(3)

      assert_in_delta 70, row["gp"].to_f
      assert_in_delta 192, row["oreb"].to_f
      assert_in_delta 644, row["dreb"].to_f
      assert_in_delta 173, row["pf"].to_f
      assert_in_delta 55, row["dd"].to_f
      assert_in_delta 34, row["td"].to_f
      assert_in_delta 1_800, row["pts"].to_f

      assert_in_delta 720.0 / 1_300.0, row["fg_pct"].to_f
      assert_in_delta 350.0 / 430.0, row["ft_pct"].to_f
      assert_in_delta 140.0 / 380.0, row["tp_pct"].to_f
      assert_in_delta 700.0 / 230.0, row["ato"].to_f
      assert_in_delta 110.0 / 230.0, row["str"].to_f
      assert_in_delta 1_800.0 / 2_555.0, row["ppm"].to_f
    end

    test "GET /api/season_stats computes derived cats as NULL on divide by zero" do
      player = create_player(espn_player_id: 2)
      create_season_stat(
        player: player,
        gp: 0,
        min: 0,
        fgm: 10,
        fga: 0,
        ftm: 4,
        fta: 0,
        tpm: 1,
        tpa: 0,
        ast: 8,
        stl: 3,
        to: 0,
        pts: 20
      )

      get "/api/season_stats"

      assert_response :success
      row = JSON.parse(response.body).first
      assert_equal "actual", row["dataset"]
      assert_nil row["fg_pct"]
      assert_nil row["ft_pct"]
      assert_nil row["tp_pct"]
      assert_nil row["ato"]
      assert_nil row["str"]
      assert_nil row["ppm"]
    end

    test "GET /api/season_stats filtered by source omits other sources and seasons" do
      player = create_player(espn_player_id: 3_112_335)
      create_season_stat(player: player, source: "espn", season: 2026, pts: 1_800)
      create_season_stat(player: player, source: "other", season: 2026, pts: 1)
      create_season_stat(player: player, source: "espn", season: 2025, pts: 9_999)

      get "/api/season_stats", params: { source: "espn", season: 2026 }

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal 1, json.size
      assert_equal "espn", json.first["source"]
      assert_equal 2026, json.first["season"]
      assert_equal "actual", json.first["dataset"]
      assert_in_delta 1_800, json.first["pts"].to_f
    end

    test "GET /api/season_stats defaults to espn and season 2026" do
      player = create_player(espn_player_id: 1)
      create_season_stat(player: player, source: "espn", season: 2026, pts: 100)
      create_season_stat(player: player, source: "other", season: 2026, pts: 200)
      create_season_stat(player: player, source: "espn", season: 2025, pts: 300)

      get "/api/season_stats"

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal 1, json.size
      assert_equal "espn", json.first["source"]
      assert_equal 2026, json.first["season"]
      assert_equal "actual", json.first["dataset"]
    end

    private
      def create_player(**attrs)
        Player.create!(
          {
            first_name: "Test",
            last_name: "Player",
            full_name: "Test Player",
            positions: [ "C" ],
            nba_team: "DEN"
          }.merge(attrs)
        )
      end

      def create_season_stat(**attrs)
        player = attrs.delete(:player) || create_player
        PlayerSeasonStat.create!(
          {
            player: player,
            source: "espn",
            season: 2026,
            imported_at: Time.current
          }.merge(attrs)
        )
      end
  end
end
