require "test_helper"

class EspnProjectionsTest < ActiveSupport::TestCase
  class FakePageClient
    def initialize(pages)
      @pages = pages
    end

    def each_page
      @pages.each { |players| yield players }
    end
  end

  test "projection and actuals block ids follow ESPN season prefixes" do
    assert_equal "102027", Espn.projection_block_id(2027)
    assert_equal "002026", Espn.actuals_block_id(2026)
    assert_equal %i[oreb dreb pf dd td], Espn::ESTIMATED_STAT_FIELDS
    assert_not_includes Espn::UNSCORED_STAT_FIELDS, :reb
  end

  test "Jokic-like row stores ESPN projection cats including total reb" do
    call_importer

    player = Player.find_by!(espn_player_id: 3_112_335)
    projection = espn_2027_projection(player)

    assert_equal "Nikola Jokic", player.full_name
    assert_equal [ "C" ], player.positions
    assert_equal "DEN", player.nba_team
    assert_equal 1, projection.espn_roto_rank

    assert_equal 708, projection.ast
    assert_equal 2053, projection.pts
    assert_equal 77, projection.gp
    assert_equal 804, projection.fgm
    assert_equal 1363, projection.fga
    assert_equal 978, projection.reb
    assert_in_delta 804.0 / 1363.0, projection.fgm / projection.fga, 0.0000001
    assert_not_includes PlayerProjection.column_names, "fg_pct"
  end

  test "derives missing cats instead of copying 2026 actuals" do
    call_importer

    projection = espn_2027_projection(Player.find_by!(espn_player_id: 3_112_335))

    assert_not_equal 192, projection.oreb
    assert_not_equal 644, projection.dreb
    assert_not_equal 55, projection.dd
    assert_not_equal 34, projection.td
    assert_not_nil projection.oreb
    assert_not_nil projection.dreb
    assert_not_nil projection.pf
    assert_not_nil projection.dd
    assert_not_nil projection.td
    assert_equal %w[dd dreb oreb pf td], projection.estimated_stat_keys.sort
    assert_equal [], projection.missing_stat_keys
  end

  test "multi-position player persists only PG SG SF PF C" do
    call_importer

    player = Player.find_by!(espn_player_id: 424_242)

    assert_equal %w[PG SG], player.positions
    assert_empty player.positions - Player::ALLOWED_POSITIONS
    assert_not_includes player.positions, "G"
    assert_not_includes player.positions, "F"
  end

  test "proTeamId 0 maps to FA" do
    call_importer

    player = Player.find_by!(espn_player_id: 434_343)

    assert_equal "FA", player.nba_team
    assert_equal %w[SF PF], player.positions
  end

  test "uses ESPN key 41 for gp when 42 is absent" do
    call_importer

    projection = espn_2027_projection(Player.find_by!(espn_player_id: 434_343))

    assert_equal 62, projection.gp
    assert_not_includes projection.missing_stat_keys, "gp"
  end

  test "upserts players on espn_player_id and writes espn 2027 rows" do
    call_importer
    call_importer

    assert_equal 3, Player.count
    assert_equal 3, PlayerProjection.where(source: "espn", season: 2027).count

    chen = espn_2027_projection(Player.find_by!(espn_player_id: 424_242))
    assert_equal 50, chen.oreb
    assert_equal 8, chen.dd
    assert_equal [], chen.missing_stat_keys
    assert_equal [], chen.estimated_stat_keys
    assert_equal "espn", chen.source
    assert_equal 2027, chen.season
    assert_not_nil chen.imported_at
  end

  test "import writes prior-season actuals and leaves other season-stat rows alone" do
    jokic = create_player(
      espn_player_id: 3_112_335,
      first_name: "Nikola",
      last_name: "Jokic",
      full_name: "Nikola Jokic",
      positions: [ "C" ],
      nba_team: "DEN"
    )
    create_season_stat(player: jokic, source: "other", season: 2026, oreb: 1)
    create_season_stat(player: jokic, source: "espn", season: 2025, oreb: 2)

    call_importer
    call_importer

    jokic_row = Player.find_by!(espn_player_id: 3_112_335)
    chen_row = Player.find_by!(espn_player_id: 424_242)
    ortega_row = Player.find_by!(espn_player_id: 434_343)
    jokic_stat = PlayerSeasonStat.find_by!(source: "espn", season: 2026, player: jokic_row)
    ortega_stat = PlayerSeasonStat.find_by!(source: "espn", season: 2026, player: ortega_row)
    assert_equal 2, PlayerSeasonStat.where(source: "espn", season: 2026).count
    assert_equal 0, PlayerSeasonStat.where(source: "espn", season: 2026, player: chen_row).count
    assert_equal 192, jokic_stat.oreb
    assert_equal 2520, jokic_stat.min
    assert_nil ortega_stat.min
    assert_equal 50, ortega_stat.gp
    assert_equal 1, PlayerSeasonStat.find_by!(player: jokic_row, source: "other", season: 2026).oreb
    assert_equal 2, PlayerSeasonStat.find_by!(player: jokic_row, source: "espn", season: 2025).oreb
  end

  test "successful import replaces ESPN rows for the season and leaves other sources alone" do
    jokic = create_player(
      espn_player_id: 3_112_335,
      first_name: "Nikola",
      last_name: "Jokic",
      full_name: "Nikola Jokic",
      positions: [ "C" ],
      nba_team: "DEN"
    )
    stale = create_player(
      espn_player_id: 999_999,
      first_name: "Stale",
      last_name: "Row",
      full_name: "Stale Row",
      positions: [ "PG" ],
      nba_team: "FA"
    )
    create_projection(player: jokic, source: "espn", season: 2027, pts: 1)
    create_projection(player: jokic, source: "other", season: 2027, pts: 999)
    create_projection(player: stale, source: "espn", season: 2027, pts: 50)

    result = call_importer

    espn_rows = PlayerProjection.where(source: "espn", season: 2027)
    assert_equal 3, espn_rows.count
    assert_nil PlayerProjection.find_by(player: stale, source: "espn", season: 2027)

    other = PlayerProjection.find_by!(player: jokic, source: "other", season: 2027)
    assert_equal 999, other.pts

    replaced = espn_2027_projection(Player.find_by!(espn_player_id: 3_112_335))
    assert_equal 2053, replaced.pts

    assert_equal "espn", result[:source]
    assert_equal 2027, result[:season]
    assert_equal 3, result[:player_count]
    assert_not_nil result[:imported_at]
    assert_equal result[:imported_at].to_i, replaced.imported_at.to_i
  end

  test "page failure before persist leaves existing ESPN rows" do
    player = create_player(espn_player_id: 1, full_name: "Keep Me")
    existing = create_projection(player: player, source: "espn", season: 2027, pts: 100)
    other_player = create_player(espn_player_id: 2, full_name: "Other Source")
    create_projection(player: other_player, source: "other", season: 2027, pts: 77)

    payload = JSON.parse(file_fixture("espn_kona_player_info.json").read)
    client = Class.new do
      def initialize(page)
        @page = page
      end

      def each_page
        yield @page
        raise EspnProjectionsClient::InvalidResponseError, "later page failed"
      end
    end.new(payload.fetch("players"))

    assert_raises(EspnProjectionsClient::InvalidResponseError) do
      EspnProjections.fetch(client: client).replace_stored!
    end

    assert_equal 1, PlayerProjection.where(source: "espn", season: 2027).count
    assert_equal 100, existing.reload.pts
    assert_equal 77, PlayerProjection.find_by!(source: "other", season: 2027).pts
    assert_nil Player.find_by(espn_player_id: 3_112_335)
  end

  private
    def call_importer
      payload = JSON.parse(file_fixture("espn_kona_player_info.json").read)
      client = FakePageClient.new([ payload.fetch("players") ])
      EspnProjections.fetch(client: client).replace_stored!
    end

    def espn_2027_projection(player)
      player.player_projections.find_by!(source: "espn", season: 2027)
    end

    def create_player(**attrs)
      Player.create!(
        {
          first_name: "Test",
          last_name: "Player",
          full_name: "Test Player",
          positions: [ "C" ],
          nba_team: "DEN"
        }.merge(attrs)
      )
    end

    def create_projection(**attrs)
      player = attrs.delete(:player) || create_player
      PlayerProjection.create!(
        {
          player: player,
          source: "espn",
          season: 2027,
          imported_at: Time.current
        }.merge(attrs)
      )
    end

    def create_season_stat(**attrs)
      player = attrs.delete(:player) || create_player
      PlayerSeasonStat.create!(
        {
          player: player,
          source: "espn",
          season: 2026,
          imported_at: Time.current
        }.merge(attrs)
      )
    end
end
