# The DraftPick JSON shared by mock draft runs and weight search runs.
# `pick` is a string-keyed hash in the mock_draft_picks column shape.
module DraftPickJson
  extend ActiveSupport::Concern

  private
    def draft_pick_json(pick, player)
      z_weighted = pick["z_weighted"]
      {
        "player_id" => pick["player_id"],
        "full_name" => player.full_name,
        "positions" => player.positions,
        "nba_team" => player.nba_team,
        "injury_status" => player.injury_status,
        "round" => pick["round"],
        "slot" => pick["slot"],
        "overall_pick" => pick["overall_pick"],
        "team" => pick["team"],
        "roster_slot" => pick["roster_slot"],
        "z_total" => pick["z_total"].to_f,
        "z_weighted" => z_weighted.nil? ? nil : z_weighted.to_f
      }
    end
end
