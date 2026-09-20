# Fills ESPN-omitted OREB/DREB/PF/DD/TD on stored projection rows from prior actuals.
class EspnStatEstimates
  K_REB = 25
  K_MIN = 150
  K_GP = 6
  BLEND_GAMES = 30
  MIN_POOL = 10
  MIN_GAMES = 20

  def initialize(season: Espn::SEASON, source: "espn")
    @season = season
    @source = source
    @prior_stats = PlayerSeasonStat.includes(:player).where(source: source, season: season - 1).index_by(&:player_id)
    @qualifying = @prior_stats.values.select { |row| row.gp.to_f >= MIN_GAMES }
    @model = DoubleDoubleModel.fit(fit_rows)
  end

  def apply!
    players_estimated = 0

    ActiveRecord::Base.transaction do
      PlayerProjection.includes(:player).where(source: @source, season: @season).find_each do |projection|
        reset_estimated!(projection)
        fill_estimates!(projection)
        projection.save!
        players_estimated += 1 if Array(projection.estimated_stat_keys).any?
      end
    end

    summary = {
      season: @season,
      players_estimated: players_estimated,
      k_dd: @model.k_dd,
      k_td: @model.k_td,
      priors: prior_summary
    }
    Rails.logger.info("EspnStatEstimates #{summary.inspect}")
    summary
  end

  private
    def reset_estimated!(projection)
      keys = Array(projection.estimated_stat_keys)
      keys.each do |key|
        next unless Espn::ESTIMATED_STAT_FIELDS.map(&:to_s).include?(key)

        projection[key] = nil
      end
      projection.missing_stat_keys = (Array(projection.missing_stat_keys) + keys).uniq
      projection.estimated_stat_keys = []
    end

    def fill_estimates!(projection)
      fill_rebounds!(projection)
      fill_pf!(projection)
      fill_double_doubles!(projection)
    end

    def fill_rebounds!(projection)
      reb = projection.reb
      return if reb.nil?

      share = oreb_share_for(projection)
      if projection.oreb.nil?
        projection.oreb = round_stat(reb.to_f * share)
        mark_estimated!(projection, "oreb")
      end
      return unless projection.dreb.nil?

      dreb = projection.oreb.nil? ? reb.to_f * (1.0 - share) : reb.to_f - projection.oreb.to_f
      projection.dreb = round_stat(dreb)
      mark_estimated!(projection, "dreb")
    end

    def fill_pf!(projection)
      return unless projection.pf.nil?

      actuals = @prior_stats[projection.player_id]
      position = primary_position(projection.player)

      if actuals && !actuals.pf.nil? && !actuals.min.nil?
        return if projection.min.nil?

        rate = (actuals.pf.to_f + K_MIN * pf_per_min_for(position)) / (actuals.min.to_f + K_MIN)
        projection.pf = round_stat(rate * projection.min.to_f)
        mark_estimated!(projection, "pf")
      elsif actuals && !actuals.pf.nil? && !actuals.gp.nil?
        return if projection.gp.nil?

        rate = (actuals.pf.to_f + K_GP * pf_per_game_for(position)) / (actuals.gp.to_f + K_GP)
        projection.pf = round_stat(rate * projection.gp.to_f)
        mark_estimated!(projection, "pf")
      elsif projection.min.present?
        projection.pf = round_stat(pf_per_min_for(position) * projection.min.to_f)
        mark_estimated!(projection, "pf")
      elsif projection.gp.present?
        projection.pf = round_stat(pf_per_game_for(position) * projection.gp.to_f)
        mark_estimated!(projection, "pf")
      end
    end

    def fill_double_doubles!(projection)
      gp = projection.gp
      pts = projection.pts
      ast = projection.ast
      reb = projection.reb
      return if gp.nil? || pts.nil? || ast.nil? || reb.nil? || gp.to_f.zero?

      probs = @model.per_game_probabilities(
        pts: pts.to_f / gp.to_f,
        reb: reb.to_f / gp.to_f,
        ast: ast.to_f / gp.to_f
      )
      weight, own_dd, own_td = blend_components(projection.player_id)

      if projection.dd.nil?
        p_dd = own_dd.nil? ? probs[:dd] : (weight * own_dd) + ((1.0 - weight) * probs[:dd])
        projection.dd = round_stat(gp.to_f * p_dd)
        mark_estimated!(projection, "dd")
      end
      return unless projection.td.nil?

      p_td = own_td.nil? ? probs[:td] : (weight * own_td) + ((1.0 - weight) * probs[:td])
      projection.td = round_stat(gp.to_f * p_td)
      mark_estimated!(projection, "td")
    end

    def blend_components(player_id)
      actuals = @prior_stats[player_id]
      if actuals.nil? || actuals.gp.to_f <= 0
        return [ 0.0, nil, nil ]
      end

      weight = actuals.gp.to_f / (actuals.gp.to_f + BLEND_GAMES)
      own_dd = actuals.dd.nil? ? nil : actuals.dd.to_f / actuals.gp.to_f
      own_td = actuals.td.nil? ? nil : actuals.td.to_f / actuals.gp.to_f
      [ weight, own_dd, own_td ]
    end

    def oreb_share_for(projection)
      pool = oreb_share_pool(primary_position(projection.player))
      actuals = @prior_stats[projection.player_id]
      return pool if actuals.nil? || actuals.oreb.nil? || actuals.reb.nil?

      (actuals.oreb.to_f + (K_REB * pool)) / (actuals.reb.to_f + K_REB)
    end

    def oreb_share_pool(position)
      oreb_share_cache[position] ||= begin
        members = pool_members(position).select { |row| row.reb.to_f.positive? }
        total_reb = members.sum { |row| row.reb.to_f }
        total_reb.zero? ? 0.0 : members.sum { |row| row.oreb.to_f } / total_reb
      end
    end

    def pf_per_min_for(position)
      pf_per_min_cache[position] ||= begin
        members = pool_members(position).select { |row| row.min.to_f.positive? }
        total_min = members.sum { |row| row.min.to_f }
        total_min.zero? ? 0.0 : members.sum { |row| row.pf.to_f } / total_min
      end
    end

    def pf_per_game_for(position)
      pf_per_game_cache[position] ||= begin
        members = pool_members(position).select { |row| row.gp.to_f.positive? }
        total_gp = members.sum { |row| row.gp.to_f }
        total_gp.zero? ? 0.0 : members.sum { |row| row.pf.to_f } / total_gp
      end
    end

    def pool_members(position)
      pool_members_cache[position] ||= begin
        group = @qualifying.select { |row| primary_position(row.player) == position }
        group.size >= MIN_POOL ? group : @qualifying
      end
    end

    def prior_summary
      positions = @qualifying.map { |row| primary_position(row.player) }.compact.uniq
      positions.index_with do |position|
        { oreb_share: oreb_share_pool(position), pf_per_min: pf_per_min_for(position) }
      end
    end

    def fit_rows
      @qualifying.filter_map do |row|
        next if row.gp.to_f.zero?
        next if [ row.pts, row.reb, row.ast, row.dd, row.td ].any?(&:nil?)

        {
          gp: row.gp.to_f,
          pts: row.pts.to_f / row.gp.to_f,
          reb: row.reb.to_f / row.gp.to_f,
          ast: row.ast.to_f / row.gp.to_f,
          dd: row.dd.to_f / row.gp.to_f,
          td: row.td.to_f / row.gp.to_f
        }
      end
    end

    def mark_estimated!(projection, key)
      projection.estimated_stat_keys = (Array(projection.estimated_stat_keys) + [ key ]).uniq
      projection.missing_stat_keys = Array(projection.missing_stat_keys) - [ key ]
    end

    def round_stat(value)
      value.to_f.round(1)
    end

    def primary_position(player)
      Array(player&.positions).first
    end

    def oreb_share_cache
      @oreb_share_cache ||= {}
    end

    def pf_per_min_cache
      @pf_per_min_cache ||= {}
    end

    def pf_per_game_cache
      @pf_per_game_cache ||= {}
    end

    def pool_members_cache
      @pool_members_cache ||= {}
    end
end
