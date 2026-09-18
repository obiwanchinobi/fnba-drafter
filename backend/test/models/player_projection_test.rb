require "test_helper"

class PlayerProjectionTest < ActiveSupport::TestCase
  STAT_COLUMNS = %w[
    gp min fgm fga ftm fta tpm tpa oreb dreb ast stl blk to pf dd td pts
  ].freeze

  DERIVED_OR_UNSCORED_COLUMNS = %w[reb fg_pct ft_pct tp_pct ato str ppm].freeze

  test "source season and player_id are unique together" do
    player = create_player
    create_projection(player: player, source: "espn", season: 2027)

    duplicate = new_projection(player: player, source: "espn", season: 2027)

    assert_not duplicate.valid?
    assert duplicate.errors[:player_id].any?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate.save(validate: false) }
  end

  test "the same player can have a projection for another source or season" do
    player = create_player
    create_projection(player: player, source: "espn", season: 2027)

    other_source = create_projection(player: player, source: "other", season: 2027)
    other_season = create_projection(player: player, source: "espn", season: 2026)

    assert other_source.persisted?
    assert other_season.persisted?
  end

  test "belongs to player" do
    player = create_player
    projection = create_projection(player: player)

    assert_equal player, projection.player
  end

  test "stat columns accept null and do not coerce missing cats to zero" do
    projection = create_projection(
      gp: nil,
      min: nil,
      fgm: nil,
      fga: nil,
      ftm: nil,
      fta: nil,
      tpm: nil,
      tpa: nil,
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

    projection.reload

    STAT_COLUMNS.each do |column|
      assert_nil projection.public_send(column), "#{column} must stay NULL"
      assert_nil PlayerProjection.columns_hash[column].default, "#{column} default must be NULL"
    end
  end

  test "does not persist total reb or pre-rounded percentage and ratio copies" do
    DERIVED_OR_UNSCORED_COLUMNS.each do |column|
      assert_not_includes PlayerProjection.column_names, column
    end
  end

  test "missing_stat_keys stores the absent cat keys" do
    projection = create_projection(missing_stat_keys: %w[oreb dreb pf dd td])

    assert_equal %w[oreb dreb pf dd td], projection.reload.missing_stat_keys
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

    def new_projection(**attrs)
      player = attrs.delete(:player) || create_player
      PlayerProjection.new(
        {
          player: player,
          source: "espn",
          season: 2027,
          imported_at: Time.current
        }.merge(attrs)
      )
    end

    def create_projection(**attrs)
      new_projection(**attrs).tap(&:save!)
    end
end
