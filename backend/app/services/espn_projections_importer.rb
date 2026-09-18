class EspnProjectionsImporter
  SOURCE = "espn"
  GP_FALLBACK_KEY = "41"

  def initialize(client: EspnProjectionsClient.new)
    @client = client
  end

  def call
    entries = []
    @client.each_page { |players| entries.concat(Array(players)) }

    imported_at = Time.current
    mapped = entries.map { |entry| map_player(entry, imported_at) }
    persist(mapped)
  end

  private
    def map_player(entry, imported_at)
      info = entry.fetch("player")
      projection_attrs, missing = projection_attributes(projection_stats(info))

      {
        player_attrs: {
          espn_player_id: info.fetch("id"),
          first_name: info.fetch("firstName"),
          last_name: info.fetch("lastName"),
          full_name: info["fullName"].presence || "#{info["firstName"]} #{info["lastName"]}",
          positions: positions_for(info),
          nba_team: nba_team_for(info),
          injury_status: info["injuryStatus"]
        },
        projection_attrs: projection_attrs.merge(
          source: SOURCE,
          season: Espn::SEASON,
          imported_at: imported_at,
          espn_roto_rank: info.dig("draftRanksByRankType", "ROTO", "rank"),
          missing_stat_keys: missing
        )
      }
    end

    def projection_stats(info)
      block = Array(info["stats"]).find { |row| row["id"] == Espn::STAT_BLOCK_ID }
      (block&.[]("stats") || {}).transform_keys(&:to_s)
    end

    def projection_attributes(stats)
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

      [ attrs, missing ]
    end

    def positions_for(info)
      Array(info["eligibleSlots"]).filter_map { |slot| Espn::SLOT_MAP[slot.to_i] }.uniq
    end

    def nba_team_for(info)
      Espn::PRO_TEAM_ABBREVS.fetch(info["proTeamId"].to_i, "FA")
    end

    def persist(mapped)
      ActiveRecord::Base.transaction do
        mapped.each do |row|
          player = Player.find_or_initialize_by(espn_player_id: row[:player_attrs][:espn_player_id])
          player.assign_attributes(row[:player_attrs])
          player.save!

          projection = PlayerProjection.find_or_initialize_by(
            player_id: player.id,
            source: SOURCE,
            season: Espn::SEASON
          )
          projection.assign_attributes(row[:projection_attrs])
          projection.save!
        end
      end
    end
end
