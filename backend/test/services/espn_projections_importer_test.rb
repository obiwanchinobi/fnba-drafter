require "test_helper"

class EspnProjectionsImporterTest < ActiveSupport::TestCase
  class FakePageClient
    def initialize(pages)
      @pages = pages
    end

    def each_page
      @pages.each { |players| yield players }
    end
  end

  test "Jokic-like row keeps omitted oreb dreb pf dd td as NULL and listed missing" do
    call_importer

    player = Player.find_by!(espn_player_id: 3_112_335)
    projection = espn_2027_projection(player)

    assert_equal "Nikola Jokic", player.full_name
    assert_equal [ "C" ], player.positions
    assert_equal "DEN", player.nba_team
    assert_equal 1, projection.espn_roto_rank

    assert_nil projection.oreb
    assert_nil projection.dreb
    assert_nil projection.pf
    assert_nil projection.dd
    assert_nil projection.td
    assert_equal %w[dd dreb oreb pf td], projection.missing_stat_keys.sort

    assert_equal 708, projection.ast
    assert_equal 2053, projection.pts
    assert_equal 77, projection.gp
    assert_equal 804, projection.fgm
    assert_equal 1363, projection.fga
    assert_in_delta 804.0 / 1363.0, projection.fgm / projection.fga, 0.0000001
    assert_not_includes PlayerProjection.column_names, "fg_pct"
    assert_not_includes PlayerProjection.column_names, "reb"
  end

  test "does not backfill missing 102027 keys from 2026 actuals" do
    call_importer

    projection = espn_2027_projection(Player.find_by!(espn_player_id: 3_112_335))

    assert_not_equal 192, projection.oreb
    assert_not_equal 644, projection.dreb
    assert_not_equal 55, projection.dd
    assert_not_equal 34, projection.td
    assert_nil projection.oreb
    assert_nil projection.dreb
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
    assert_equal "espn", chen.source
    assert_equal 2027, chen.season
    assert_not_nil chen.imported_at
  end

  private
    def call_importer
      payload = JSON.parse(file_fixture("espn_kona_player_info.json").read)
      client = FakePageClient.new([ payload.fetch("players") ])
      EspnProjectionsImporter.new(client: client).call
    end

    def espn_2027_projection(player)
      player.player_projections.find_by!(source: "espn", season: 2027)
    end
end
