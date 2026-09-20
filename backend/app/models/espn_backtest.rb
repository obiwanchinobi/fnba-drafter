# Yearly comparison of stored or reconstructed ESPN projections against season actuals.
class EspnBacktest
  STATS = %i[oreb dreb pf dd td pts ast stl blk to fgm fga ftm fta tpm tpa min gp].freeze
  ESTIMATED_STATS = %i[oreb dreb pf dd td].freeze
  SOURCE = "espn"
  CUTOFF_MONTH = 10
  CUTOFF_DAY = 15

  attr_reader :warnings, :season, :mode, :min_games

  def initialize(projections:, actuals:, min_games: 20, season: nil, mode: nil, warnings: [])
    @projections = projections.map { |row| normalize_row(row) }
    @actuals = actuals.map { |row| normalize_row(row) }
    @min_games = min_games
    @season = season
    @mode = mode
    @warnings = Array(warnings)
  end

  def self.from_stored(season:, client: nil)
    rows = PlayerProjection.includes(:player).where(source: SOURCE, season: season)
    prior_ids = PlayerSeasonStat.where(source: SOURCE, season: season - 1).pluck(:player_id).to_set
    cutoff = Date.new(season - 1, CUTOFF_MONTH, CUTOFF_DAY)
    late = rows.count { |row| row.imported_at.utc.to_date > cutoff }
    warnings = []
    if late.positive?
      warnings << "#{late} stored projection row#{'s' if late != 1} imported after 15 October #{season - 1}; those rows may not be draft-night snapshots"
    end

    projections = rows.filter_map { |row| hash_from_record(row, had_prior_season: prior_ids.include?(row.player_id)) }
    actuals = stored_or_fetched_actuals(season: season, client: client)

    new(projections: projections, actuals: actuals, season: season, mode: :stored, warnings: warnings)
  end

  def self.from_espn(season:, client_for: nil)
    season_entries = fetch_entries(client_for_season(client_for, season))
    prior_entries = fetch_entries(client_for_season(client_for, season - 1))
    prior_stats = prior_season_records(prior_entries, season: season)
    projections = reconstructed_projections(season_entries, season: season, prior_stats: prior_stats)
    actuals = actual_hashes_from_entries(season_entries, season: season)

    new(projections: projections, actuals: actuals, season: season, mode: :espn)
  end

  def metrics
    @metrics ||= STATS.index_with { |stat| metrics_for(stat) }.tap do |all|
      all[:oreb] = all[:oreb].merge(share_mae: share_mae)
      ESTIMATED_STATS.each do |stat|
        all[stat] = all[stat].merge(
          had_prior_season: metrics_for(stat, prior: true),
          no_prior_season: metrics_for(stat, prior: false)
        )
      end
    end
  end

  def to_markdown
    lines = [ "# ESPN projection backtest#{season_heading}#{mode_heading}", "" ]
    lines << "Players with ≥ #{min_games} actual games: #{evaluable.size}"
    warnings.each { |warning| lines << warning }
    lines << ""
    lines << "## Season totals and per-game rates"
    lines << ""
    lines << "| Stat | N | Total MAE | Total bias | Rate MAE | Rate bias |"
    lines << "|------|---|-----------|------------|----------|-----------|"
    STATS.each do |stat|
      row = metrics[stat]
      lines << "| #{stat.to_s.upcase} | #{row[:n]} | #{fmt(row[:total_mae])} | #{fmt(row[:total_bias])} | #{fmt(row[:rate_mae])} | #{fmt(row[:rate_bias])} |"
    end
    lines << ""
    lines << "## OREB share"
    lines << ""
    lines << "| Stat | Share MAE |"
    lines << "|------|-----------|"
    lines << "| OREB share | #{fmt(metrics[:oreb][:share_mae])} |"
    lines << ""
    lines << "## Estimated cats by prior-season actuals"
    lines << ""
    lines << "| Stat | Prior season | N | Total MAE | Total bias | Rate MAE | Rate bias |"
    lines << "|------|--------------|---|-----------|------------|----------|-----------|"
    ESTIMATED_STATS.each do |stat|
      [ [ :had_prior_season, "yes" ], [ :no_prior_season, "no" ] ].each do |key, label|
        row = metrics[stat][key]
        lines << "| #{stat.to_s.upcase} (#{label}) | #{label} | #{row[:n]} | #{fmt(row[:total_mae])} | #{fmt(row[:total_bias])} | #{fmt(row[:rate_mae])} | #{fmt(row[:rate_bias])} |"
      end
    end
    "#{lines.join("\n")}\n"
  end

  private
    def normalize_row(row)
      hash = row.to_h.symbolize_keys
      hash[:had_prior_season] = hash[:had_prior_season] == true
      hash
    end

    def evaluable
      @evaluable ||= begin
        actuals_by_id = @actuals.index_by { |row| row[:espn_player_id] }
        @projections.filter_map do |projection|
          actual = actuals_by_id[projection[:espn_player_id]]
          next if actual.nil? || projection[:espn_player_id].nil?
          next if actual[:gp].to_f < min_games

          { proj: projection, actual: actual }
        end
      end
    end

    def metrics_for(stat, prior: nil)
      rows = evaluable
      unless prior.nil?
        rows = rows.select { |row| row[:proj][:had_prior_season] == prior }
      end
      rows = rows.select { |row| !row[:proj][stat].nil? && !row[:actual][stat].nil? }
      return empty_metrics if rows.empty?

      total_errors = rows.map { |row| row[:proj][stat].to_f - row[:actual][stat].to_f }
      n = rows.size
      rate_rows = rows.select { |row| row[:proj][:gp].to_f.positive? && row[:actual][:gp].to_f.positive? }
      if rate_rows.empty?
        rate_mae = nil
        rate_bias = nil
      else
        rate_errors = rate_rows.map do |row|
          (row[:proj][stat].to_f / row[:proj][:gp].to_f) - (row[:actual][stat].to_f / row[:actual][:gp].to_f)
        end
        rate_mae = rate_errors.map(&:abs).sum / rate_rows.size
        rate_bias = rate_errors.sum / rate_rows.size
      end

      {
        n: n,
        total_mae: total_errors.map(&:abs).sum / n,
        total_bias: total_errors.sum / n,
        rate_mae: rate_mae,
        rate_bias: rate_bias
      }
    end

    def share_mae
      rows = evaluable.select do |row|
        row[:actual][:reb].to_f.positive? &&
          row[:proj][:reb].to_f.positive? &&
          !row[:proj][:oreb].nil? &&
          !row[:actual][:oreb].nil?
      end
      return nil if rows.empty?

      errors = rows.map do |row|
        (row[:proj][:oreb].to_f / row[:proj][:reb].to_f) - (row[:actual][:oreb].to_f / row[:actual][:reb].to_f)
      end
      errors.map(&:abs).sum / rows.size
    end

    def empty_metrics
      { n: 0, total_mae: nil, total_bias: nil, rate_mae: nil, rate_bias: nil }
    end

    def fmt(value)
      return "—" if value.nil?

      format("%.3f", value)
    end

    def season_heading
      season ? " — season #{season}" : ""
    end

    def mode_heading
      case mode
      when :stored then " (stored)"
      when :espn then " (reconstructed)"
      else ""
      end
    end

    def self.stored_or_fetched_actuals(season:, client:)
      stored = PlayerSeasonStat.includes(:player).where(source: SOURCE, season: season)
      if stored.exists?
        return stored.filter_map { |row| hash_from_record(row) }
      end

      client ||= EspnProjectionsClient.new(season: season)
      actual_hashes_from_entries(fetch_entries(client), season: season)
    end
    private_class_method :stored_or_fetched_actuals

    def self.hash_from_record(record, had_prior_season: nil)
      player = record.player
      return nil if player&.espn_player_id.nil?

      hash = {
        espn_player_id: player.espn_player_id,
        estimated_stat_keys: record.respond_to?(:estimated_stat_keys) ? Array(record.estimated_stat_keys) : [],
        reb: number_or_nil(record.reb)
      }
      hash[:had_prior_season] = had_prior_season unless had_prior_season.nil?
      STATS.each { |field| hash[field] = number_or_nil(record.public_send(field)) }
      hash
    end
    private_class_method :hash_from_record

    def self.number_or_nil(value)
      value&.to_f
    end
    private_class_method :number_or_nil

    def self.fetch_entries(client)
      entries = []
      client.each_page { |page| entries.concat(Array(page)) }
      entries
    end
    private_class_method :fetch_entries

    def self.client_for_season(client_for, season)
      if client_for.nil?
        EspnProjectionsClient.new(season: season)
      elsif client_for.respond_to?(:call)
        client_for.call(season)
      else
        client_for
      end
    end
    private_class_method :client_for_season

    def self.actual_hashes_from_entries(entries, season:)
      entries.filter_map do |entry|
        info = player_info(entry)
        next if info.nil?

        attrs = stats_from_block(info, Espn.actuals_block_id(season), source_id: 0)
        next if attrs.nil?

        { espn_player_id: info["id"], **attrs }
      end
    end
    private_class_method :actual_hashes_from_entries

    def self.prior_season_records(entries, season:)
      entries.filter_map do |entry|
        info = player_info(entry)
        next if info.nil?

        attrs = stats_from_block(info, Espn.actuals_block_id(season - 1), source_id: 0)
        next if attrs.nil?

        espn_id = info["id"]
        player = unsaved_player(entry, espn_id)
        PlayerSeasonStat.new(
          attrs.merge(
            player: player,
            player_id: espn_id,
            source: SOURCE,
            season: season - 1,
            imported_at: Time.current
          )
        )
      end
    end
    private_class_method :prior_season_records

    def self.reconstructed_projections(entries, season:, prior_stats:)
      records = entries.filter_map do |entry|
        info = player_info(entry)
        next if info.nil?

        attrs = stats_from_block(info, Espn.projection_block_id(season))
        next if attrs.nil?

        espn_id = info["id"]
        player = unsaved_player(entry, espn_id)
        missing = attrs.each_key.filter_map { |field| field.to_s if attrs[field].nil? }
        PlayerProjection.new(
          attrs.merge(
            player: player,
            player_id: espn_id,
            source: SOURCE,
            season: season,
            imported_at: Time.current,
            missing_stat_keys: missing,
            estimated_stat_keys: []
          )
        )
      end

      ReconstructedEstimates.new(season: season, prior_stats: prior_stats).fill!(records)
      prior_ids = prior_stats.map(&:player_id).to_set
      records.map { |record| hash_from_record(record, had_prior_season: prior_ids.include?(record.player_id)) }
    end
    private_class_method :reconstructed_projections

    def self.player_info(entry)
      entry["player"] || entry[:player]
    end
    private_class_method :player_info

    def self.unsaved_player(entry, espn_id)
      kona = EspnKonaPlayer.new(entry)
      identity = kona.player_attributes
      Player.new(identity.merge(id: espn_id, espn_player_id: espn_id))
    end
    private_class_method :unsaved_player

    def self.stats_from_block(info, block_id, source_id: nil)
      block = Array(info["stats"] || info[:stats]).find do |row|
        row = row.stringify_keys if row.respond_to?(:stringify_keys)
        next false unless row["id"] == block_id

        source_id.nil? || row["statSourceId"] == source_id
      end
      return nil if block.nil?

      stats = (block["stats"] || block[:stats] || {}).transform_keys(&:to_s)
      attrs = {}
      Espn::STAT_KEY_MAP.each do |espn_key, field|
        next if Espn::UNSCORED_STAT_FIELDS.include?(field)

        value = stats[espn_key]
        value = stats[EspnKonaPlayer::GP_FALLBACK_KEY] if value.nil? && field == :gp
        attrs[field] = value
      end
      attrs
    end
    private_class_method :stats_from_block

    # Runs EspnStatEstimates fill formulas on in-memory rows (no database writes).
    class ReconstructedEstimates < EspnStatEstimates
      def initialize(season:, prior_stats:)
        @season = season
        @source = SOURCE
        @prior_stats = prior_stats.index_by(&:player_id)
        @qualifying = @prior_stats.values.select { |row| row.gp.to_f >= MIN_GAMES }
        @model = DoubleDoubleModel.fit(fit_rows)
      end

      def fill!(projections)
        projections.each { |projection| fill_estimates!(projection) }
        projections
      end
    end
end
