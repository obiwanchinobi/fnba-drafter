# Current ESPN projection snapshot for this league's scored cats.
class EspnProjections
  SOURCE = "espn"

  attr_reader :imported_at

  def initialize(players, imported_at: Time.current)
    @players = players
    @imported_at = imported_at
  end

  def self.fetch(client: EspnProjectionsClient.new)
    entries = []
    client.each_page { |page| entries.concat(Array(page)) }
    new(entries.map { |entry| EspnKonaPlayer.new(entry) })
  end

  def source
    SOURCE
  end

  def season
    Espn::SEASON
  end

  def player_count
    @players.size
  end

  def replace_stored!
    ActiveRecord::Base.transaction do
      PlayerProjection.where(source: SOURCE, season: Espn::SEASON).delete_all

      @players.each do |kona_player|
        player = Player.find_or_initialize_by(espn_player_id: kona_player.player_attributes[:espn_player_id])
        player.assign_attributes(kona_player.player_attributes)
        player.save!

        PlayerProjection.create!(
          kona_player.projection_attributes(imported_at: imported_at).merge(player_id: player.id)
        )
      end
    end

    {
      source: source,
      season: season,
      player_count: player_count,
      imported_at: imported_at
    }
  end
end
