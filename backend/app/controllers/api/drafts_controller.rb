module Api
  class DraftsController < ApplicationController
    def show
      render json: draft_json(Draft.current)
    end

    def refresh
      render json: draft_json(Draft.current.refresh_from_espn!)
    rescue EspnProjectionsClient::MissingCredentialsError, EspnCookies::Missing
      render json: { error: "espn_credentials_missing" }, status: :service_unavailable
    rescue EspnCookies::Unreadable, ChromeCookieDecryptor::Error
      render json: { error: "espn_cookies_unreadable" }, status: :service_unavailable
    rescue EspnProjectionsClient::UnauthorizedError, EspnProjectionsClient::InvalidResponseError, EspnProjectionsClient::Error => error
      Rails.logger.warn("ESPN draft refresh failed: #{error.class}: #{error.message}")
      render json: { error: "espn_fetch_failed" }, status: :bad_gateway
    end

    private
      def draft_json(draft)
        player_ids = draft.picks.map { |pick| pick["player_id"] }.compact
        players = player_ids.empty? ? {} : Player.where(id: player_ids).index_by(&:id)

        {
          "season" => draft.season,
          "draft_order" => draft.draft_order,
          "user_team" => League::USER_TEAM,
          "user_espn_team_id" => League::USER_ESPN_TEAM_ID,
          "in_progress" => draft.espn_in_progress,
          "drafted" => draft.espn_drafted,
          "refreshed_at" => draft.refreshed_at&.utc&.iso8601(3),
          "picks" => draft.picks.map { |pick| pick_json(pick, players[pick["player_id"]]) }
        }
      end

      def pick_json(pick, player)
        pick.slice("overall_pick", "round", "slot", "team", "espn_team_id", "espn_player_id", "player_id").merge(
          "full_name" => player ? player.full_name : "ESPN player #{pick["espn_player_id"]}",
          "positions" => player ? player.positions : [],
          "nba_team" => player&.nba_team,
          "injury_status" => player&.injury_status
        )
      end
  end
end
