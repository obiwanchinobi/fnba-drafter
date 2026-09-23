module Api
  class ProjectionsController < ApplicationController
    include StatLineSerialization

    DEFAULT_SOURCE = "espn"
    DEFAULT_SEASON = 2027

    def index
      source = params.fetch(:source, DEFAULT_SOURCE)
      season = params.fetch(:season, DEFAULT_SEASON).to_i

      projections = PlayerProjection
        .includes(:player)
        .where(source: source, season: season)
        .order(Arel.sql("player_projections.espn_roto_rank ASC NULLS LAST, player_projections.pts DESC NULLS LAST"))

      prior_by_player_id = PlayerSeasonStat
        .where(source: source, season: season - 1)
        .index_by(&:player_id)

      render json: projections.map { |projection|
        serialize_stat_line(
          projection,
          dataset: "projection",
          prior_stat: prior_by_player_id[projection.player_id]
        )
      }
    end

    def refresh
      source = json_body["source"].presence || DEFAULT_SOURCE

      unless source == "espn"
        render json: { error: "unknown_source" }, status: :unprocessable_entity
        return
      end

      snapshot = EspnProjections.fetch
      result = snapshot.replace_stored!
      render json: {
        source: result[:source],
        season: result[:season],
        player_count: result[:player_count],
        imported_at: result[:imported_at]
      }
    rescue EspnProjectionsClient::MissingCredentialsError, EspnCookies::Missing
      render json: { error: "espn_credentials_missing" }, status: :service_unavailable
    rescue EspnCookies::Unreadable, ChromeCookieDecryptor::Error
      render json: { error: "espn_cookies_unreadable" }, status: :service_unavailable
    rescue EspnProjectionsClient::UnauthorizedError, EspnProjectionsClient::InvalidResponseError, EspnProjectionsClient::Error => error
      Rails.logger.warn("ESPN refresh failed: #{error.class}: #{error.message}")
      render json: { error: "espn_fetch_failed" }, status: :bad_gateway
    end
  end
end
