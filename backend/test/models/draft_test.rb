require "test_helper"

class DraftTest < ActiveSupport::TestCase
  class FakeClient
    def initialize(json)
      @json = json
    end

    def fetch
      @json
    end
  end

  test "current finds or creates the row for the configured season with empty picks" do
    assert_difference("Draft.count", 1) { Draft.current }
    assert_no_difference("Draft.count") { Draft.current }

    draft = Draft.current
    assert_equal Espn::SEASON, draft.season
    assert_equal [], draft.picks
    assert_equal [], draft.draft_order
    assert_equal false, draft.espn_in_progress
    assert_equal false, draft.espn_drafted
    assert_nil draft.refreshed_at
    assert_equal [], draft.user_picks
  end

  test "refresh_from_espn! stores made picks in overall order with players mapped by espn id" do
    jokic = create_player(full_name: "Nikola Jokic", espn_player_id: 3_112_335)
    wemby = create_player(full_name: "Victor Wembanyama", espn_player_id: 4_395_628)
    tatum = create_player(full_name: "Jayson Tatum", espn_player_id: 3_059_318)
    payload = JSON.parse(file_fixture("espn_draft_detail.json").read)
    payload["draftDetail"]["picks"].reverse!

    draft = Draft.current
    travel_to Time.utc(2026, 9, 26, 12, 0, 0) do
      draft.refresh_from_espn!(client: FakeClient.new(payload))
    end

    draft.reload
    assert_equal true, draft.espn_in_progress
    assert_equal false, draft.espn_drafted
    assert_equal Time.utc(2026, 9, 26, 12, 0, 0), draft.refreshed_at
    assert_equal [ 1, 2, 3, 4 ], draft.picks.map { |pick| pick["overall_pick"] }
    assert_equal [ 1, 1, 1, 1 ], draft.picks.map { |pick| pick["round"] }
    assert_equal [ 1, 2, 3, 4 ], draft.picks.map { |pick| pick["slot"] }
    assert_equal [ "Pickle Balboa", "Trust in Pizza", "Dan", "Team Chino" ], draft.picks.map { |pick| pick["team"] }
    assert_equal [ 4, 9, 3, 5 ], draft.picks.map { |pick| pick["espn_team_id"] }
    assert_equal [ 3_112_335, 4_395_628, 999_999_999, 3_059_318 ], draft.picks.map { |pick| pick["espn_player_id"] }
    assert_equal [ jokic.id, wemby.id, nil, tatum.id ], draft.picks.map { |pick| pick["player_id"] }
    assert draft.picks.all? { |pick| pick.keys.all? { |key| key.is_a?(String) } }
    assert_equal %w[overall_pick round slot team espn_team_id espn_player_id player_id].sort, draft.picks.first.keys.sort
  end

  test "refresh_from_espn! takes the draft order from round one pick slots" do
    payload = JSON.parse(file_fixture("espn_draft_detail.json").read)
    payload["settings"]["draftSettings"]["pickOrder"] = [ 1, 2, 3, 4, 5, 7, 8, 9 ]

    draft = Draft.current
    draft.refresh_from_espn!(client: FakeClient.new(payload))

    assert_equal [
      "Pickle Balboa",
      "Trust in Pizza",
      "Dan",
      "Team Chino",
      "Team Not Rich Asian",
      "Adam's All Stars",
      "Succulent Chinese Meal",
      "Double Pump Fake"
    ], draft.reload.draft_order
  end

  test "refresh_from_espn! falls back to settings pickOrder when there are no round one picks" do
    payload = JSON.parse(file_fixture("espn_draft_detail.json").read)
    payload["draftDetail"]["picks"] = []
    payload["draftDetail"]["inProgress"] = false

    draft = Draft.current
    draft.refresh_from_espn!(client: FakeClient.new(payload))

    draft.reload
    assert_equal [], draft.picks
    assert_equal false, draft.espn_in_progress
    assert_equal [
      "Pickle Balboa",
      "Trust in Pizza",
      "Dan",
      "Team Chino",
      "Team Not Rich Asian",
      "Adam's All Stars",
      "Succulent Chinese Meal",
      "Double Pump Fake"
    ], draft.draft_order
  end

  test "a second refresh replaces the stored picks wholesale" do
    payload = JSON.parse(file_fixture("espn_draft_detail.json").read)
    draft = Draft.current
    draft.refresh_from_espn!(client: FakeClient.new(payload))
    assert_equal 4, draft.reload.picks.size

    later = JSON.parse(file_fixture("espn_draft_detail.json").read)
    later["draftDetail"]["picks"] = later["draftDetail"]["picks"].first(2)
    later["draftDetail"]["drafted"] = true
    draft.refresh_from_espn!(client: FakeClient.new(later))

    draft.reload
    assert_equal [ 1, 2 ], draft.picks.map { |pick| pick["overall_pick"] }
    assert_equal true, draft.espn_drafted
    assert_no_difference("Draft.count") { Draft.current }
  end

  test "user_picks returns only Team Chino's picks" do
    payload = JSON.parse(file_fixture("espn_draft_detail.json").read)
    draft = Draft.current
    draft.refresh_from_espn!(client: FakeClient.new(payload))

    user_picks = draft.reload.user_picks
    assert_equal [ 4 ], user_picks.map { |pick| pick["overall_pick"] }
    assert_equal [ League::USER_ESPN_TEAM_ID ], user_picks.map { |pick| pick["espn_team_id"] }
    assert_equal [ "Team Chino" ], user_picks.map { |pick| pick["team"] }
  end

  private
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
