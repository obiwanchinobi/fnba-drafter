require "test_helper"

module Api
  class ProjectionsControllerTest < ActionDispatch::IntegrationTest
    test "GET /api/projections returns 200 and an empty list when none exist" do
      get "/api/projections"

      assert_response :success
      assert_equal [], JSON.parse(response.body)
    end

    test "GET /api/projections includes player identity and does not coerce NULL cats to zero" do
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
      create_projection(
        player: player,
        source: "espn",
        season: 2027,
        gp: 82,
        min: 2_870,
        fgm: 820,
        fga: 1_400,
        ftm: 410,
        fta: 500,
        tpm: 164,
        tpa: 410,
        oreb: nil,
        dreb: nil,
        ast: 820,
        stl: 123,
        blk: 64,
        to: 246,
        pf: nil,
        dd: nil,
        td: nil,
        pts: 2_050,
        missing_stat_keys: %w[oreb dreb pf dd td],
        imported_at: imported_at,
        espn_roto_rank: 1
      )

      get "/api/projections"

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal 1, json.size

      row = json.first
      assert_equal "Nikola Jokic", row["full_name"]
      assert_equal "Nikola", row["first_name"]
      assert_equal "Jokic", row["last_name"]
      assert_equal [ "C" ], row["positions"]
      assert_equal "DEN", row["nba_team"]
      assert_equal "DTD", row["injury_status"]
      assert_equal 3_112_335, row["espn_player_id"]
      assert_equal "espn", row["source"]
      assert_equal 2027, row["season"]
      assert_equal 1, row["espn_roto_rank"]
      assert_equal %w[oreb dreb pf dd td], row["missing_stat_keys"]
      assert_equal imported_at.iso8601(3), Time.parse(row["imported_at"]).utc.iso8601(3)

      assert_in_delta 82, row["gp"].to_f
      assert_in_delta 2_050, row["pts"].to_f
      assert_in_delta 820, row["fgm"].to_f
      assert_in_delta 1_400, row["fga"].to_f
      assert_in_delta 410, row["ftm"].to_f
      assert_in_delta 500, row["fta"].to_f
      assert_in_delta 164, row["tpm"].to_f
      assert_in_delta 410, row["tpa"].to_f

      assert_nil row["oreb"]
      assert_nil row["dreb"]
      assert_nil row["pf"]
      assert_nil row["dd"]
      assert_nil row["td"]
      refute_equal 0, row["oreb"]
      refute_equal 0.0, row["oreb"]

      assert_in_delta 820.0 / 1_400.0, row["fg_pct"].to_f
      assert_in_delta 410.0 / 500.0, row["ft_pct"].to_f
      assert_in_delta 164.0 / 410.0, row["tp_pct"].to_f
      assert_in_delta 820.0 / 246.0, row["ato"].to_f
      assert_in_delta 123.0 / 246.0, row["str"].to_f
      assert_in_delta 2_050.0 / 2_870.0, row["ppm"].to_f
    end

    test "GET /api/projections filtered by source omits other sources and seasons" do
      player = create_player(espn_player_id: 3_112_335)
      create_projection(player: player, source: "espn", season: 2027, pts: 2_000, oreb: nil)
      create_projection(player: player, source: "other", season: 2027, pts: 1, oreb: 50)
      create_projection(player: player, source: "espn", season: 2026, pts: 9_999, oreb: 99)

      get "/api/projections", params: { source: "espn", season: 2027 }

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal 1, json.size
      assert_equal "espn", json.first["source"]
      assert_equal 2027, json.first["season"]
      assert_in_delta 2_000, json.first["pts"].to_f
      assert_nil json.first["oreb"]
    end

    test "GET /api/projections defaults to espn and season 2027" do
      player = create_player(espn_player_id: 1)
      create_projection(player: player, source: "espn", season: 2027, pts: 100)
      create_projection(player: player, source: "other", season: 2027, pts: 200)

      get "/api/projections"

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal 1, json.size
      assert_equal "espn", json.first["source"]
      assert_equal 2027, json.first["season"]
    end

    test "GET /api/projections computes derived cats as NULL on divide by zero" do
      player = create_player(espn_player_id: 2)
      create_projection(
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

      get "/api/projections"

      assert_response :success
      row = JSON.parse(response.body).first
      assert_nil row["fg_pct"]
      assert_nil row["ft_pct"]
      assert_nil row["tp_pct"]
      assert_nil row["ato"]
      assert_nil row["str"]
      assert_nil row["ppm"]
    end

    test "POST /api/projections/refresh missing Chrome ESPN cookies returns 503 and does not write" do
      player = create_player(espn_player_id: 1)
      create_projection(player: player, pts: 100)

      with_espn_client(EspnProjectionsClient.new(cookies: EspnCookies.new(swid: nil, espn_s2: nil))) do
        post "/api/projections/refresh", params: { source: "espn" }, as: :json
      end

      assert_response :service_unavailable
      json = JSON.parse(response.body)
      assert_equal "espn_credentials_missing", json["error"]
      assert_equal 1, PlayerProjection.where(source: "espn", season: 2027).count
      assert_equal 100, PlayerProjection.find_by!(source: "espn", season: 2027).pts
    end

    test "POST /api/projections/refresh unknown source returns 422" do
      post "/api/projections/refresh", params: { source: "htb" }, as: :json

      assert_response :unprocessable_entity
      json = JSON.parse(response.body)
      assert_equal "unknown_source", json["error"]
      assert_equal 0, PlayerProjection.count
    end

    test "POST /api/projections/refresh fetch failure returns 502 and does not delete existing rows" do
      player = create_player(espn_player_id: 1)
      create_projection(player: player, pts: 100)

      failing_client = Class.new do
        def each_page
          raise EspnProjectionsClient::InvalidResponseError, "ESPN request failed"
        end
      end.new

      with_espn_client(failing_client) do
        post "/api/projections/refresh", params: { source: "espn" }, as: :json
      end

      assert_response :bad_gateway
      json = JSON.parse(response.body)
      assert_equal "espn_fetch_failed", json["error"]
      assert_equal 1, PlayerProjection.where(source: "espn", season: 2027).count
      assert_equal 100, PlayerProjection.find_by!(source: "espn", season: 2027).pts
    end

    test "POST /api/projections/refresh with stubbed client returns player_count" do
      payload = JSON.parse(file_fixture("espn_kona_player_info.json").read)
      fake_client = FakePageClient.new([ payload.fetch("players") ])

      with_espn_client(fake_client) do
        post "/api/projections/refresh", params: { source: "espn" }, as: :json
      end

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal "espn", json["source"]
      assert_equal 2027, json["season"]
      assert_equal 3, json["player_count"]
      assert json["imported_at"].present?
      assert_equal 3, PlayerProjection.where(source: "espn", season: 2027).count
    end

    test "GET /api/projections sorts by espn roto rank then pts with NULLs last" do
      ranked_second = create_player(full_name: "Rank Two", espn_player_id: 10)
      ranked_first = create_player(full_name: "Rank One", espn_player_id: 11)
      unranked_high_pts = create_player(full_name: "Unranked High", espn_player_id: 12)
      unranked_low_pts = create_player(full_name: "Unranked Low", espn_player_id: 13)
      unranked_nil_pts = create_player(full_name: "Unranked Nil", espn_player_id: 14)

      create_projection(player: ranked_second, espn_roto_rank: 2, pts: 100)
      create_projection(player: ranked_first, espn_roto_rank: 1, pts: 50)
      create_projection(player: unranked_high_pts, espn_roto_rank: nil, pts: 9_000)
      create_projection(player: unranked_low_pts, espn_roto_rank: nil, pts: 10)
      create_projection(player: unranked_nil_pts, espn_roto_rank: nil, pts: nil)

      get "/api/projections"

      assert_response :success
      names = JSON.parse(response.body).map { |row| row["full_name"] }
      assert_equal [
        "Rank One",
        "Rank Two",
        "Unranked High",
        "Unranked Low",
        "Unranked Nil"
      ], names
    end

    class FakePageClient
      def initialize(pages)
        @pages = pages
      end

      def each_page
        @pages.each { |players| yield players }
      end
    end

    private
      def with_espn_client(client)
        EspnProjectionsClient.define_singleton_method(:new) { |*_args, **_kwargs, &_block| client }
        yield
      ensure
        if EspnProjectionsClient.singleton_class.instance_methods(false).include?(:new)
          EspnProjectionsClient.singleton_class.remove_method(:new)
        end
      end

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

      def create_projection(**attrs)
        player = attrs.delete(:player) || create_player
        PlayerProjection.create!(
          {
            player: player,
            source: "espn",
            season: 2027,
            imported_at: Time.current
          }.merge(attrs)
        )
      end
  end
end
