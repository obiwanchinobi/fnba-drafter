# One player hash from ESPN kona_player_info (projection + prior-season actuals).
class EspnKonaPlayer
  GP_FALLBACK_KEY = "41"

  def initialize(entry)
    @info = entry.fetch("player")
  end

  def player_attributes
    {
      espn_player_id: @info.fetch("id"),
      first_name: @info.fetch("firstName"),
      last_name: @info.fetch("lastName"),
      full_name: @info["fullName"].presence || "#{@info["firstName"]} #{@info["lastName"]}",
      positions: positions,
      nba_team: nba_team,
      injury_status: @info["injuryStatus"]
    }
  end

  def primary_position
    positions.first
  end

  def projection_attributes(imported_at:)
    stats = stats_from_block(Espn.projection_block_id(Espn::SEASON))
    attrs = {}
    missing = []

    Espn::STAT_KEY_MAP.each do |espn_key, field|
      next if Espn::UNSCORED_STAT_FIELDS.include?(field)

      value = stats[espn_key]
      value = stats[GP_FALLBACK_KEY] if value.nil? && field == :gp

      if value.nil?
        attrs[field] = nil
        missing << field.to_s
      else
        attrs[field] = value
      end
    end

    attrs.merge(
      source: EspnProjections::SOURCE,
      season: Espn::SEASON,
      imported_at: imported_at,
      espn_roto_rank: @info.dig("draftRanksByRankType", "ROTO", "rank"),
      missing_stat_keys: missing
    )
  end

  def prior_season_attributes(imported_at:)
    block = actuals_block
    return nil if block.nil?

    stats = (block["stats"] || {}).transform_keys(&:to_s)
    attrs = {}

    Espn::STAT_KEY_MAP.each do |espn_key, field|
      next if Espn::UNSCORED_STAT_FIELDS.include?(field)

      value = stats[espn_key]
      value = stats[GP_FALLBACK_KEY] if value.nil? && field == :gp
      attrs[field] = value
    end

    attrs.merge(
      source: EspnProjections::SOURCE,
      season: Espn::SEASON - 1,
      imported_at: imported_at
    )
  end

  private
    def stats_from_block(block_id)
      block = Array(@info["stats"]).find { |row| row["id"] == block_id }
      (block&.[]("stats") || {}).transform_keys(&:to_s)
    end

    def actuals_block
      Array(@info["stats"]).find do |row|
        row["id"] == Espn.actuals_block_id(Espn::SEASON - 1) && row["statSourceId"] == 0
      end
    end

    def positions
      Array(@info["eligibleSlots"]).filter_map { |slot| Espn::SLOT_MAP[slot.to_i] }.uniq
    end

    def nba_team
      Espn::PRO_TEAM_ABBREVS.fetch(@info["proTeamId"].to_i, "FA")
    end
end
