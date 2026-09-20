module Api
  module StatLineSerialization
    extend ActiveSupport::Concern

    private
      def serialize_stat_line(record, dataset:, prior_stat: nil)
        player = record.player
        turnovers = record[:to]
        projection = dataset == "projection"

        {
          id: record.id,
          player_id: player.id,
          espn_player_id: player.espn_player_id,
          first_name: player.first_name,
          last_name: player.last_name,
          full_name: player.full_name,
          positions: player.positions,
          nba_team: player.nba_team,
          injury_status: player.injury_status,
          source: record.source,
          season: record.season,
          dataset: dataset,
          gp: number_or_nil(record.gp),
          min: number_or_nil(record.min),
          fgm: number_or_nil(record.fgm),
          fga: number_or_nil(record.fga),
          fg_pct: ratio(record.fgm, record.fga),
          ftm: number_or_nil(record.ftm),
          fta: number_or_nil(record.fta),
          ft_pct: ratio(record.ftm, record.fta),
          tpm: number_or_nil(record.tpm),
          tpa: number_or_nil(record.tpa),
          tp_pct: ratio(record.tpm, record.tpa),
          oreb: number_or_nil(record.oreb),
          dreb: number_or_nil(record.dreb),
          ast: number_or_nil(record.ast),
          ato: ratio(record.ast, turnovers),
          stl: number_or_nil(record.stl),
          str: ratio(record.stl, turnovers),
          blk: number_or_nil(record.blk),
          to: number_or_nil(turnovers),
          pf: number_or_nil(record.pf),
          dd: number_or_nil(record.dd),
          td: number_or_nil(record.td),
          pts: number_or_nil(record.pts),
          ppm: ratio(record.pts, record.min),
          imported_at: record.imported_at,
          missing_stat_keys: projection ? record.missing_stat_keys : [],
          estimated_stat_keys: projection ? record.estimated_stat_keys : [],
          espn_roto_rank: projection ? record.espn_roto_rank : nil,
          prior_season: projection ? serialize_prior_season(prior_stat) : nil
        }
      end

      def serialize_prior_season(prior_stat)
        return nil unless prior_stat

        {
          season: prior_stat.season,
          gp: number_or_nil(prior_stat.gp),
          oreb: number_or_nil(prior_stat.oreb),
          dreb: number_or_nil(prior_stat.dreb),
          pf: number_or_nil(prior_stat.pf),
          dd: number_or_nil(prior_stat.dd),
          td: number_or_nil(prior_stat.td)
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
