# One player hash from ESPN kona_player_info (stat block 102027).
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

  def projection_attributes(imported_at:)
    stats = projection_stats
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

  private
    def projection_stats
      block = Array(@info["stats"]).find { |row| row["id"] == Espn::STAT_BLOCK_ID }
      (block&.[]("stats") || {}).transform_keys(&:to_s)
    end

    def positions
      Array(@info["eligibleSlots"]).filter_map { |slot| Espn::SLOT_MAP[slot.to_i] }.uniq
    end

    def nba_team
      Espn::PRO_TEAM_ABBREVS.fetch(@info["proTeamId"].to_i, "FA")
    end
end
