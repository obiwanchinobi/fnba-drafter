require "test_helper"

module Api
  class DraftsControllerTest < ActionDispatch::IntegrationTest
    class FakeDraftClient
      def initialize(json)
        @json = json
      end

      def fetch
        @json
      end
    end

    test "GET /api/draft returns an empty draft when nothing has been pulled" do
      get "/api/draft"

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal Espn::SEASON, json["season"]
      assert_equal [], json["draft_order"]
      assert_equal League::USER_TEAM, json["user_team"]
      assert_equal 5, json["user_espn_team_id"]
      assert_equal false, json["in_progress"]
      assert_equal false, json["drafted"]
      assert_nil json["refreshed_at"]
      assert_equal [], json["picks"]
    end

    test "POST /api/draft/refresh stores the ESPN picks and returns them with player fields" do
      jokic = create_player(
        full_name: "Nikola Jokic",
        positions: [ "C" ],
        nba_team: "DEN",
        injury_status: "DTD",
        espn_player_id: 3_112_335
      )
      payload = JSON.parse(file_fixture("espn_draft_detail.json").read)

      with_espn_draft_client(FakeDraftClient.new(payload)) do
        post "/api/draft/refresh"
      end

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal Espn::SEASON, json["season"]
      assert_equal true, json["in_progress"]
      assert_equal false, json["drafted"]
      assert json["refreshed_at"].present?
      assert_equal Draft.current.refreshed_at.utc.iso8601(3), Time.parse(json["refreshed_at"]).utc.iso8601(3)
      assert_equal "Pickle Balboa", json["draft_order"].first
      assert_equal 8, json["draft_order"].size
      assert_equal 4, json["picks"].size

      first = json["picks"].first
      assert_equal 1, first["overall_pick"]
      assert_equal 1, first["round"]
      assert_equal 1, first["slot"]
      assert_equal "Pickle Balboa", first["team"]
      assert_equal 4, first["espn_team_id"]
      assert_equal 3_112_335, first["espn_player_id"]
      assert_equal jokic.id, first["player_id"]
      assert_equal "Nikola Jokic", first["full_name"]
      assert_equal [ "C" ], first["positions"]
      assert_equal "DEN", first["nba_team"]
      assert_equal "DTD", first["injury_status"]

      unknown = json["picks"].find { |pick| pick["espn_player_id"] == 999_999_999 }
      assert_nil unknown["player_id"]
      assert_equal "ESPN player 999999999", unknown["full_name"]
      assert_equal [], unknown["positions"]
      assert_nil unknown["nba_team"]
      assert_nil unknown["injury_status"]

      assert_equal 4, Draft.current.picks.size

      get "/api/draft"
      assert_response :success
      assert_equal json["picks"], JSON.parse(response.body)["picks"]
    end

    test "POST /api/draft/refresh maps missing credentials to 503 espn_credentials_missing" do
      no_cookies = EspnDraftClient.new(cookies: EspnCookies.new(swid: nil, espn_s2: nil))

      with_espn_draft_client(no_cookies) do
        post "/api/draft/refresh"
      end

      assert_response :service_unavailable
      assert_equal "espn_credentials_missing", JSON.parse(response.body)["error"]
      assert_equal [], Draft.current.picks
    end

    test "POST /api/draft/refresh maps an ESPN failure to 502 espn_fetch_failed" do
      failing_client = Class.new do
        def fetch
          raise EspnProjectionsClient::InvalidResponseError, "ESPN response was not JSON"
        end
      end.new

      with_espn_draft_client(failing_client) do
        post "/api/draft/refresh"
      end

      assert_response :bad_gateway
      assert_equal "espn_fetch_failed", JSON.parse(response.body)["error"]
    end

    private
      def with_espn_draft_client(client)
        EspnDraftClient.define_singleton_method(:new) { |*_args, **_kwargs, &_block| client }
        yield
      ensure
        if EspnDraftClient.singleton_class.instance_methods(false).include?(:new)
          EspnDraftClient.singleton_class.remove_method(:new)
        end
      end

      def create_player(**attrs)
        Player.create!(
          {
            first_name: "Mock",
            last_name: "Player",
            full_name: "Mock Player",
            positions: [ "PG" ],
            nba_team: "DEN"
          }.merge(attrs)
        )
      end
  end
end
