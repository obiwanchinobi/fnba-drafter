require "test_helper"

class EspnKonaPlayerTest < ActiveSupport::TestCase
  setup do
    @imported_at = Time.utc(2026, 9, 20, 12, 0, 0)
  end

  test "Jokic projection stores total reb and primary position is first slot" do
    player = kona_player(3_112_335)
    attrs = player.projection_attributes(imported_at: @imported_at)

    assert_equal 978, attrs[:reb]
    assert_equal "C", player.primary_position
    assert_includes attrs[:missing_stat_keys], "oreb"
    assert_not_includes attrs[:missing_stat_keys], "reb"
  end

  test "Jokic prior season maps actuals block including oreb dreb reb pf dd td gp min" do
    player = kona_player(3_112_335)
    attrs = player.prior_season_attributes(imported_at: @imported_at)

    assert_equal "espn", attrs[:source]
    assert_equal 2026, attrs[:season]
    assert_equal @imported_at, attrs[:imported_at]
    assert_equal 192, attrs[:oreb]
    assert_equal 644, attrs[:dreb]
    assert_equal 836, attrs[:reb]
    assert_equal 173, attrs[:pf]
    assert_equal 55, attrs[:dd]
    assert_equal 34, attrs[:td]
    assert_equal 70, attrs[:gp]
    assert_equal 2520, attrs[:min]
    assert_not attrs.key?(:fg_pct)
  end

  test "Chen has no prior season actuals block" do
    player = kona_player(424_242)

    assert_nil player.prior_season_attributes(imported_at: @imported_at)
  end

  test "Ortega prior season omits min so PF can use the per-game form" do
    player = kona_player(434_343)
    attrs = player.prior_season_attributes(imported_at: @imported_at)

    assert_not_nil attrs
    assert_nil attrs[:min]
    assert_equal 50, attrs[:gp]
    assert_equal 90, attrs[:pf]
  end

  private
    def kona_player(espn_player_id)
      payload = JSON.parse(file_fixture("espn_kona_player_info.json").read)
      entry = payload.fetch("players").find { |row| row.dig("player", "id") == espn_player_id }
      raise "missing fixture player #{espn_player_id}" unless entry

      EspnKonaPlayer.new(entry)
    end
end
