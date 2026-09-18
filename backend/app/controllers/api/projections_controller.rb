module Api
  class ProjectionsController < ApplicationController
    DEFAULT_SOURCE = "espn"
    DEFAULT_SEASON = 2027

    def index
      source = params.fetch(:source, DEFAULT_SOURCE)
      season = params.fetch(:season, DEFAULT_SEASON)

      projections = PlayerProjection
        .includes(:player)
        .where(source: source, season: season)
        .order(Arel.sql("player_projections.espn_roto_rank ASC NULLS LAST, player_projections.pts DESC NULLS LAST"))

      render json: projections.map { |projection| serialize_projection(projection) }
    end

    def refresh
      source = refresh_payload["source"].presence || DEFAULT_SOURCE

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

    private
      # json 3 JSON.parse no longer accepts the options ActiveSupport::JSON.decode
      # still passes, so JSON POST bodies cannot be read via params.
      def refresh_payload
        raw = request.raw_post
        return {} if raw.blank?

        parsed = JSON.parse(raw)
        parsed.is_a?(Hash) ? parsed : {}
      rescue JSON::ParserError
        {}
      end

      def serialize_projection(projection)
        player = projection.player
        turnovers = projection[:to]

        {
          id: projection.id,
          player_id: player.id,
          espn_player_id: player.espn_player_id,
          first_name: player.first_name,
          last_name: player.last_name,
          full_name: player.full_name,
          positions: player.positions,
          nba_team: player.nba_team,
          injury_status: player.injury_status,
          source: projection.source,
          season: projection.season,
          gp: number_or_nil(projection.gp),
          min: number_or_nil(projection.min),
          fgm: number_or_nil(projection.fgm),
          fga: number_or_nil(projection.fga),
          fg_pct: ratio(projection.fgm, projection.fga),
          ftm: number_or_nil(projection.ftm),
          fta: number_or_nil(projection.fta),
          ft_pct: ratio(projection.ftm, projection.fta),
          tpm: number_or_nil(projection.tpm),
          tpa: number_or_nil(projection.tpa),
          tp_pct: ratio(projection.tpm, projection.tpa),
          oreb: number_or_nil(projection.oreb),
          dreb: number_or_nil(projection.dreb),
          ast: number_or_nil(projection.ast),
          ato: ratio(projection.ast, turnovers),
          stl: number_or_nil(projection.stl),
          str: ratio(projection.stl, turnovers),
          blk: number_or_nil(projection.blk),
          to: number_or_nil(turnovers),
          pf: number_or_nil(projection.pf),
          dd: number_or_nil(projection.dd),
          td: number_or_nil(projection.td),
          pts: number_or_nil(projection.pts),
          ppm: ratio(projection.pts, projection.min),
          imported_at: projection.imported_at,
          missing_stat_keys: projection.missing_stat_keys,
          espn_roto_rank: projection.espn_roto_rank
        }
      end

      def number_or_nil(value)
        value&.to_f
      end

      # Division by zero or a missing input is JSON null, never 0.0 / Infinity.
      def ratio(numerator, denominator)
        return nil if numerator.nil? || denominator.nil?

        denom = denominator.to_d
        return nil if denom.zero?

        (numerator.to_d / denom).to_f
      end
  end
end
