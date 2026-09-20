require "test_helper"

class EspnBacktestTest < ActiveSupport::TestCase
  STATS = %i[oreb dreb pf dd td pts ast stl blk to fgm fga ftm fta tpm tpa min gp].freeze

  test "MAE and bias on a three-player set exclude players under min_games" do
    backtest = EspnBacktest.new(projections: three_player_projections, actuals: three_player_actuals)

    oreb = backtest.metrics.fetch(:oreb)
    assert_equal 2, oreb[:n]
    assert_in_delta 15.0, oreb[:total_mae], 0.0001
    assert_in_delta 15.0, oreb[:total_bias], 0.0001
    assert_in_delta((20.0 / 70 + 10.0 / 50) / 2, oreb[:rate_mae], 0.0001)
    assert_in_delta((20.0 / 70 + 10.0 / 50) / 2, oreb[:rate_bias], 0.0001)

    pts = backtest.metrics.fetch(:pts)
    assert_equal 2, pts[:n]
    assert_in_delta 75.0, pts[:total_mae], 0.0001
    assert_in_delta 75.0, pts[:total_bias], 0.0001
  end

  test "share metric ignores players with zero actual REB" do
    backtest = EspnBacktest.new(projections: three_player_projections, actuals: three_player_actuals)

    assert_in_delta 0.0, backtest.metrics.fetch(:oreb)[:share_mae], 0.0001
  end

  test "estimated cats split error by had_prior_season" do
    backtest = EspnBacktest.new(projections: three_player_projections, actuals: three_player_actuals)
    oreb = backtest.metrics.fetch(:oreb)

    with_prior = oreb.fetch(:had_prior_season)
    without_prior = oreb.fetch(:no_prior_season)
    assert_equal 1, with_prior[:n]
    assert_in_delta 20.0, with_prior[:total_mae], 0.0001
    assert_equal 1, without_prior[:n]
    assert_in_delta 10.0, without_prior[:total_mae], 0.0001
  end

  test "to_markdown includes one row per stat" do
    backtest = EspnBacktest.new(projections: three_player_projections, actuals: three_player_actuals)
    markdown = backtest.to_markdown

    STATS.each do |stat|
      matching = markdown.lines.select { |line| line.start_with?("| #{stat.to_s.upcase} |") }
      assert_equal 1, matching.size, "expected one markdown row for #{stat}"
    end
  end

  test "from_stored warns when a row is imported after 15 October of the season start year" do
    player = create_player(espn_player_id: 9001)
    create_projection(player: player, imported_at: Time.utc(2026, 10, 16, 12), gp: 70, pts: 1_000, oreb: 200)
    create_season_stat(player: player, season: 2027, gp: 70, pts: 900, oreb: 180)

    backtest = EspnBacktest.from_stored(season: 2027)

    assert_kind_of EspnBacktest, backtest
    assert_not_empty backtest.warnings
    assert_match(/15 October 2026/, backtest.warnings.join("\n"))
    assert_match(/1 /, backtest.warnings.join("\n"))
    assert_in_delta 20.0, backtest.metrics.fetch(:oreb)[:total_mae], 0.0001
  end

  test "from_stored uses stored season stats and does not fetch" do
    player = create_player(espn_player_id: 9004)
    create_projection(player: player, gp: 70, oreb: 200, pts: 1_000)
    create_season_stat(player: player, season: 2027, gp: 70, oreb: 180, pts: 900)
    client = Object.new
    def client.each_page
      raise "should not fetch"
    end

    backtest = EspnBacktest.from_stored(season: 2027, client: client)

    assert_in_delta 20.0, backtest.metrics.fetch(:oreb)[:total_mae], 0.0001
  end

  test "from_stored fetches actuals from the season client when no season stat rows exist" do
    player = create_player(espn_player_id: 9005)
    create_projection(player: player, gp: 70, oreb: 200, pts: 1_000)
    client = StubClient.new([ [ {
      "player" => {
        "id" => 9005,
        "firstName" => "Fetch",
        "lastName" => "Actuals",
        "fullName" => "Fetch Actuals",
        "eligibleSlots" => [ 4 ],
        "proTeamId" => 7,
        "stats" => [ {
          "id" => "002027",
          "statSourceId" => 0,
          "stats" => { "0" => 800.0, "4" => 170.0, "6" => 600.0, "42" => 70.0 }
        } ]
      }
    } ] ])

    backtest = EspnBacktest.from_stored(season: 2027, client: client)

    assert_in_delta 30.0, backtest.metrics.fetch(:oreb)[:total_mae], 0.0001
  end

  test "from_stored does not warn when imported_at is on 15 October" do
    player = create_player(espn_player_id: 9002)
    create_projection(player: player, imported_at: Time.utc(2026, 10, 15, 23, 59), gp: 70, pts: 1_000)
    create_season_stat(player: player, season: 2027, gp: 70, pts: 900)

    backtest = EspnBacktest.from_stored(season: 2027)

    assert_empty backtest.warnings
  end

  test "from_espn reconstructs estimates without writing rows and matches the share formula" do
    projection_count = PlayerProjection.count
    actuals_count = PlayerSeasonStat.count

    backtest = EspnBacktest.from_espn(
      season: 2026,
      client_for: ->(season) { stub_client_for(season) }
    )

    assert_kind_of EspnBacktest, backtest
    assert_equal projection_count, PlayerProjection.count
    assert_equal actuals_count, PlayerSeasonStat.count

    oreb = backtest.metrics.fetch(:oreb)
    pool_share = 70.0 / 300
    expected_oreb = 400.0 * (70 + 25 * pool_share) / (300 + 25)
    assert_in_delta (expected_oreb - 80).abs, oreb[:total_mae], 0.15
    assert_equal 1, oreb[:n]
    assert_equal 1, oreb.fetch(:had_prior_season)[:n]
    assert_equal 0, oreb.fetch(:no_prior_season)[:n]
  end

  private
    def three_player_projections
      [
        stat_hash(
          espn_player_id: 1,
          gp: 70,
          oreb: 200,
          dreb: 600,
          reb: 800,
          pf: 140,
          dd: 10,
          td: 1,
          pts: 1_400,
          ast: 400,
          stl: 70,
          blk: 35,
          to: 140,
          fgm: 500,
          fga: 1_000,
          ftm: 200,
          fta: 250,
          tpm: 80,
          tpa: 240,
          min: 2_100,
          estimated_stat_keys: %w[oreb dreb pf dd td],
          had_prior_season: true
        ),
        stat_hash(
          espn_player_id: 2,
          gp: 50,
          oreb: 100,
          dreb: 300,
          reb: 400,
          pf: 100,
          dd: 5,
          td: 0,
          pts: 800,
          ast: 200,
          stl: 50,
          blk: 20,
          to: 80,
          fgm: 300,
          fga: 700,
          ftm: 100,
          fta: 120,
          tpm: 50,
          tpa: 150,
          min: 1_500,
          estimated_stat_keys: %w[oreb dreb pf dd td],
          had_prior_season: false
        ),
        stat_hash(
          espn_player_id: 3,
          gp: 80,
          oreb: 40,
          dreb: 120,
          reb: 160,
          pf: 80,
          dd: 2,
          td: 0,
          pts: 400,
          ast: 80,
          stl: 20,
          blk: 10,
          to: 40,
          fgm: 150,
          fga: 350,
          ftm: 50,
          fta: 60,
          tpm: 20,
          tpa: 70,
          min: 800,
          estimated_stat_keys: %w[oreb dreb pf dd td],
          had_prior_season: true
        )
      ]
    end

    def three_player_actuals
      [
        stat_hash(
          espn_player_id: 1,
          gp: 70,
          oreb: 180,
          dreb: 540,
          reb: 720,
          pf: 150,
          dd: 12,
          td: 2,
          pts: 1_300,
          ast: 420,
          stl: 60,
          blk: 40,
          to: 150,
          fgm: 480,
          fga: 980,
          ftm: 190,
          fta: 240,
          tpm: 70,
          tpa: 230,
          min: 2_000
        ),
        stat_hash(
          espn_player_id: 2,
          gp: 50,
          oreb: 90,
          dreb: 270,
          reb: 0,
          pf: 90,
          dd: 4,
          td: 0,
          pts: 750,
          ast: 180,
          stl: 40,
          blk: 15,
          to: 70,
          fgm: 280,
          fga: 650,
          ftm: 90,
          fta: 110,
          tpm: 40,
          tpa: 140,
          min: 1_400
        ),
        stat_hash(
          espn_player_id: 3,
          gp: 10,
          oreb: 30,
          dreb: 90,
          reb: 120,
          pf: 40,
          dd: 1,
          td: 0,
          pts: 200,
          ast: 40,
          stl: 10,
          blk: 5,
          to: 20,
          fgm: 70,
          fga: 160,
          ftm: 20,
          fta: 25,
          tpm: 10,
          tpa: 30,
          min: 300
        )
      ]
    end

    def stat_hash(**attrs)
      {
        oreb: nil,
        dreb: nil,
        pf: nil,
        dd: nil,
        td: nil,
        pts: nil,
        ast: nil,
        stl: nil,
        blk: nil,
        to: nil,
        fgm: nil,
        fga: nil,
        ftm: nil,
        fta: nil,
        tpm: nil,
        tpa: nil,
        min: nil,
        gp: nil,
        reb: nil
      }.merge(attrs)
    end

    def create_player(**attrs)
      Player.create!(
        {
          first_name: "Test",
          last_name: "Backtest",
          full_name: "Test Backtest",
          positions: [ "C" ],
          nba_team: "DEN",
          espn_player_id: 8_000 + Player.count
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
          imported_at: Time.utc(2026, 9, 1)
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
          imported_at: Time.utc(2026, 9, 1)
        }.merge(attrs)
      )
    end

    def stub_client_for(season)
      pages =
        case season
        when 2026
          [ [ reconstructed_season_entry ] ]
        when 2025
          [ [ reconstructed_prior_entry ] ]
        else
          [ [] ]
        end
      StubClient.new(pages)
    end

    class StubClient
      def initialize(pages)
        @pages = pages
      end

      def each_page
        @pages.each { |page| yield page }
      end
    end

    def reconstructed_season_entry
      {
        "player" => {
          "id" => 42,
          "firstName" => "Recon",
          "lastName" => "Center",
          "fullName" => "Recon Center",
          "eligibleSlots" => [ 4 ],
          "proTeamId" => 7,
          "stats" => [
            {
              "id" => "102026",
              "seasonId" => 2026,
              "statSourceId" => 1,
              "stats" => {
                "0" => 1_400.0,
                "3" => 280.0,
                "6" => 400.0,
                "40" => 2_100.0,
                "42" => 70.0
              }
            },
            {
              "id" => "002026",
              "seasonId" => 2026,
              "statSourceId" => 0,
              "stats" => {
                "0" => 1_200.0,
                "3" => 240.0,
                "4" => 80.0,
                "5" => 240.0,
                "6" => 320.0,
                "9" => 110.0,
                "37" => 8.0,
                "38" => 1.0,
                "40" => 1_900.0,
                "42" => 65.0
              }
            }
          ]
        }
      }
    end

    def reconstructed_prior_entry
      {
        "player" => {
          "id" => 42,
          "firstName" => "Recon",
          "lastName" => "Center",
          "fullName" => "Recon Center",
          "eligibleSlots" => [ 4 ],
          "proTeamId" => 7,
          "stats" => [
            {
              "id" => "002025",
              "seasonId" => 2025,
              "statSourceId" => 0,
              "stats" => {
                "0" => 1_200.0,
                "3" => 240.0,
                "4" => 70.0,
                "5" => 230.0,
                "6" => 300.0,
                "9" => 120.0,
                "37" => 20.0,
                "38" => 2.0,
                "40" => 1_800.0,
                "42" => 60.0
              }
            }
          ]
        }
      }
    end
end
