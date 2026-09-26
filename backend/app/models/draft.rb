# The real ESPN draft for one season, one row per season, replaced wholesale on
# every refresh. Picks are jsonb rows in the mock_draft_picks column shape plus
# the ESPN ids: overall_pick, round, slot, team (ESPN team name), espn_team_id,
# espn_player_id, player_id (nil when the ESPN player is not in players).
class Draft < ApplicationRecord
  attribute :picks, MockDraftRun::StandingsType.new

  validates :season, presence: true, uniqueness: true

  def self.current
    find_or_create_by!(season: Espn::SEASON)
  end

  def refresh_from_espn!(client: EspnDraftClient.new)
    json = client.fetch
    names = team_names_by_id(json)
    made = made_picks(json)
    players = Player.where(espn_player_id: made.map { |pick| pick["playerId"] }).index_by(&:espn_player_id)

    self.picks = made.map { |pick| pick_row(pick, names, players) }
    self.draft_order = draft_order_from(json, names)
    self.espn_in_progress = json.dig("draftDetail", "inProgress") == true
    self.espn_drafted = json.dig("draftDetail", "drafted") == true
    self.refreshed_at = Time.current
    save!
    self
  end

  def user_picks
    picks.select { |pick| pick["espn_team_id"] == League::USER_ESPN_TEAM_ID }
  end

  private
    def team_names_by_id(json)
      Array(json["teams"]).each_with_object({}) do |team, names|
        names[team["id"]] = team["name"].to_s.strip
      end
    end

    def espn_picks(json)
      Array(json.dig("draftDetail", "picks"))
    end

    def made_picks(json)
      espn_picks(json)
        .select { |pick| pick["playerId"].to_i.positive? }
        .sort_by { |pick| pick["overallPickNumber"].to_i }
    end

    def pick_row(pick, names, players)
      espn_player_id = pick["playerId"].to_i
      {
        "overall_pick" => pick["overallPickNumber"].to_i,
        "round" => pick["roundId"].to_i,
        "slot" => pick["roundPickNumber"].to_i,
        "team" => names[pick["teamId"]],
        "espn_team_id" => pick["teamId"],
        "espn_player_id" => espn_player_id,
        "player_id" => players[espn_player_id]&.id
      }
    end

    # Round-one pick slots carry the order once ESPN has laid the board out;
    # before that only settings.draftSettings.pickOrder knows it.
    def draft_order_from(json, names)
      round_one = espn_picks(json).select { |pick| pick["roundId"].to_i == 1 }
      team_ids =
        if round_one.any?
          round_one.sort_by { |pick| pick["roundPickNumber"].to_i }.map { |pick| pick["teamId"] }
        else
          Array(json.dig("settings", "draftSettings", "pickOrder"))
        end
      team_ids.map { |team_id| names[team_id] }
    end
end
