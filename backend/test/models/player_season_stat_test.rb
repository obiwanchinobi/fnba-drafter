require "test_helper"

class PlayerSeasonStatTest < ActiveSupport::TestCase
  STAT_COLUMNS = %w[
    gp min fgm fga ftm fta tpm tpa reb oreb dreb ast stl blk to pf dd td pts
  ].freeze

  test "source season and player_id are unique together" do
    player = create_player
    create_season_stat(player: player, source: "espn", season: 2026)

    duplicate = new_season_stat(player: player, source: "espn", season: 2026)

    assert_not duplicate.valid?
    assert duplicate.errors[:player_id].any?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate.save(validate: false) }
  end

  test "the same player can have a season stat for another source or season" do
    player = create_player
    create_season_stat(player: player, source: "espn", season: 2026)

    other_source = create_season_stat(player: player, source: "other", season: 2026)
    other_season = create_season_stat(player: player, source: "espn", season: 2025)

    assert other_source.persisted?
    assert other_season.persisted?
  end

  test "belongs to player and appears on player.season_stats" do
    player = create_player
    season_stat = create_season_stat(player: player)

    assert_equal player, season_stat.player
    assert_equal [ season_stat ], player.season_stats
  end

  test "stat columns accept null and do not coerce missing cats to zero" do
    season_stat = create_season_stat(
      gp: nil,
      min: nil,
      fgm: nil,
      fga: nil,
      ftm: nil,
      fta: nil,
      tpm: nil,
      tpa: nil,
      reb: nil,
      oreb: nil,
      dreb: nil,
      ast: nil,
      stl: nil,
      blk: nil,
      to: nil,
      pf: nil,
      dd: nil,
      td: nil,
      pts: nil
    )

    season_stat.reload

    STAT_COLUMNS.each do |column|
      assert_nil season_stat.public_send(column), "#{column} must stay NULL"
      assert_nil PlayerSeasonStat.columns_hash[column].default, "#{column} default must be NULL"
    end
  end

  test "requires source season and imported_at" do
    season_stat = PlayerSeasonStat.new(player: create_player)

    assert_not season_stat.valid?
    assert season_stat.errors[:source].any?
    assert season_stat.errors[:season].any?
    assert season_stat.errors[:imported_at].any?
  end

  private
    def create_player(**attrs)
      Player.create!(
        {
          first_name: "Nikola",
          last_name: "Jokic",
          full_name: "Nikola Jokic",
          positions: [ "C" ],
          nba_team: "DEN",
          espn_player_id: 3_112_335
        }.merge(attrs)
      )
    end

    def new_season_stat(**attrs)
      player = attrs.delete(:player) || create_player
      PlayerSeasonStat.new(
        {
          player: player,
          source: "espn",
          season: 2026,
          imported_at: Time.current
        }.merge(attrs)
      )
    end

    def create_season_stat(**attrs)
      new_season_stat(**attrs).tap(&:save!)
    end
end
