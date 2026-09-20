require "test_helper"

class EspnStatEstimatesTest < ActiveSupport::TestCase
  FIVE = %w[dd dreb oreb pf td].freeze

  test "Jokic-like rebound share shrinks toward the position pool" do
    jokic = create_player(full_name: "Nikola Jokic", positions: [ "C" ], espn_player_id: 1)
    create_season_stat(player: jokic, oreb: 192, dreb: 644, reb: 836, gp: 70, min: 2_520, pf: 173, dd: 55, td: 34, pts: 1_960, ast: 720)
    create_projection(player: jokic, reb: 978, gp: 77, min: 2_702.7, pts: 2_053, ast: 708, oreb: nil, dreb: nil, pf: nil, dd: nil, td: nil, missing_stat_keys: FIVE)

    pool_share = seed_center_pool
    expected = 978 * (192 + 25 * pool_share) / (836 + 25)

    EspnStatEstimates.new(season: 2027).apply!
    projection = jokic.player_projections.find_by!(source: "espn", season: 2027)

    assert_in_delta expected, projection.oreb, 0.1
    assert_equal projection.oreb.to_f.round(1), projection.oreb.to_f
    assert_in_delta 978 - projection.oreb.to_f, projection.dreb.to_f, 0.1
    assert_equal FIVE, projection.estimated_stat_keys.sort
    assert_equal [], projection.missing_stat_keys
  end

  test "a player with no season stat uses the pool share and model-only DD/TD" do
    seed_center_pool
    rookie = create_player(full_name: "Riley Chen", positions: [ "C" ], espn_player_id: 99)
    create_projection(
      player: rookie,
      reb: 300,
      gp: 80,
      min: 2_400,
      pts: 1_400,
      ast: 400,
      oreb: nil,
      dreb: nil,
      pf: nil,
      dd: nil,
      td: nil,
      missing_stat_keys: FIVE
    )

    summary = EspnStatEstimates.new(season: 2027).apply!
    projection = rookie.player_projections.find_by!(source: "espn", season: 2027)
    pool_share = summary[:priors]["C"][:oreb_share]
    model = DoubleDoubleModel.new(k_dd: summary[:k_dd], k_td: summary[:k_td])
    probs = model.per_game_probabilities(pts: 1_400 / 80.0, reb: 300 / 80.0, ast: 400 / 80.0)

    assert_in_delta 300 * pool_share, projection.oreb, 0.1
    assert_in_delta 80 * probs[:dd], projection.dd, 0.1
    assert_in_delta 80 * probs[:td], projection.td, 0.1
    assert_equal FIVE, projection.estimated_stat_keys.sort
  end

  test "PF scales with projected minutes and uses per-game form when min is nil" do
    seed_center_pool
    minute_player = create_player(full_name: "Minute Man", positions: [ "C" ], espn_player_id: 20)
    create_season_stat(player: minute_player, gp: 70, min: 2_100, pf: 140, oreb: 70, reb: 350, pts: 700, ast: 140, dd: 7, td: 0)
    create_projection(player: minute_player, gp: 75, min: 2_250, reb: 400, pts: 800, ast: 150, oreb: nil, dreb: nil, pf: nil, dd: nil, td: nil, missing_stat_keys: FIVE)

    per_game_player = create_player(full_name: "Per Game", positions: [ "C" ], espn_player_id: 21)
    create_season_stat(player: per_game_player, gp: 50, min: nil, pf: 100, oreb: 40, reb: 200, pts: 500, ast: 80, dd: 4, td: 0)
    create_projection(player: per_game_player, gp: 60, min: 1_800, reb: 240, pts: 600, ast: 90, oreb: nil, dreb: nil, pf: nil, dd: nil, td: nil, missing_stat_keys: FIVE)

    summary = EspnStatEstimates.new(season: 2027).apply!
    pool_rate = summary[:priors]["C"][:pf_per_min]
    minute_row = minute_player.player_projections.find_by!(source: "espn", season: 2027)
    expected_minute = ((140 + 150 * pool_rate) / (2_100 + 150)) * 2_250
    assert_in_delta expected_minute, minute_row.pf, 0.1

    per_game_row = per_game_player.player_projections.find_by!(source: "espn", season: 2027)
    pool_pg = pf_per_game_rate("C")
    expected_pg = ((100 + 6 * pool_pg) / (50 + 6.0)) * 60
    assert_in_delta expected_pg, per_game_row.pf, 0.1
  end

  test "DD/TD blend weight is gp over gp plus 30" do
    seed_center_pool
    player = create_player(full_name: "Blend Guy", positions: [ "C" ], espn_player_id: 30)
    create_season_stat(player: player, gp: 60, min: 1_800, pf: 120, oreb: 60, reb: 300, pts: 1_200, ast: 240, dd: 30, td: 6)
    create_projection(player: player, gp: 70, min: 2_100, reb: 350, pts: 1_400, ast: 280, oreb: nil, dreb: nil, pf: nil, dd: nil, td: nil, missing_stat_keys: FIVE)

    summary = EspnStatEstimates.new(season: 2027).apply!
    projection = player.player_projections.find_by!(source: "espn", season: 2027)
    model = DoubleDoubleModel.new(k_dd: summary[:k_dd], k_td: summary[:k_td])
    probs = model.per_game_probabilities(pts: 1_400 / 70.0, reb: 350 / 70.0, ast: 280 / 70.0)
    weight = 60.0 / (60 + 30)
    expected_dd = 70 * (weight * 0.5 + (1 - weight) * probs[:dd])
    expected_td = 70 * (weight * 0.1 + (1 - weight) * probs[:td])

    assert_in_delta expected_dd, projection.dd, 0.1
    assert_in_delta expected_td, projection.td, 0.1
  end

  test "ESPN-supplied OREB is left untouched" do
    seed_center_pool
    player = create_player(full_name: "Supplied Oreb", positions: [ "C" ], espn_player_id: 40)
    create_projection(
      player: player,
      gp: 80,
      min: 2_400,
      reb: 300,
      pts: 1_400,
      ast: 400,
      oreb: 50,
      dreb: 250,
      pf: 140,
      dd: 8,
      td: 1,
      missing_stat_keys: []
    )

    EspnStatEstimates.new(season: 2027).apply!
    projection = player.player_projections.find_by!(source: "espn", season: 2027)

    assert_equal 50, projection.oreb
    assert_not_includes projection.estimated_stat_keys, "oreb"
    assert_equal [], projection.estimated_stat_keys
  end

  test "a projection with no inputs stays NULL with all five missing" do
    player = create_player(full_name: "Empty Block", positions: [ "C" ], espn_player_id: 50)
    create_projection(
      player: player,
      gp: nil,
      min: nil,
      reb: nil,
      pts: nil,
      ast: nil,
      oreb: nil,
      dreb: nil,
      pf: nil,
      dd: nil,
      td: nil,
      missing_stat_keys: FIVE
    )

    EspnStatEstimates.new(season: 2027).apply!
    projection = player.player_projections.find_by!(source: "espn", season: 2027)

    FIVE.each { |key| assert_nil projection.public_send(key), "#{key} must stay NULL" }
    assert_equal FIVE, projection.missing_stat_keys.sort
    assert_equal [], projection.estimated_stat_keys
  end

  test "a projection missing ast leaves DD/TD NULL but fills OREB DREB PF" do
    seed_center_pool
    player = create_player(full_name: "No Ast", positions: [ "C" ], espn_player_id: 60)
    create_season_stat(player: player, gp: 40, min: 1_200, pf: 80, oreb: 40, reb: 200, pts: 400, ast: 0, dd: 2, td: 0)
    create_projection(
      player: player,
      gp: 50,
      min: 1_500,
      reb: 250,
      pts: 500,
      ast: nil,
      oreb: nil,
      dreb: nil,
      pf: nil,
      dd: nil,
      td: nil,
      missing_stat_keys: FIVE + [ "ast" ]
    )

    EspnStatEstimates.new(season: 2027).apply!
    projection = player.player_projections.find_by!(source: "espn", season: 2027)

    assert_not_nil projection.oreb
    assert_not_nil projection.dreb
    assert_not_nil projection.pf
    assert_nil projection.dd
    assert_nil projection.td
    assert_includes projection.missing_stat_keys, "dd"
    assert_includes projection.missing_stat_keys, "td"
    assert_not_includes projection.estimated_stat_keys, "dd"
    assert_includes projection.estimated_stat_keys, "oreb"
  end

  test "apply! is idempotent" do
    seed_center_pool
    player = create_player(full_name: "Idempotent", positions: [ "C" ], espn_player_id: 70)
    create_season_stat(player: player, gp: 70, min: 2_100, pf: 140, oreb: 192, reb: 836, pts: 1_960, ast: 720, dd: 55, td: 34)
    create_projection(player: player, gp: 77, min: 2_700, reb: 978, pts: 2_053, ast: 708, oreb: nil, dreb: nil, pf: nil, dd: nil, td: nil, missing_stat_keys: FIVE)

    first = EspnStatEstimates.new(season: 2027).apply!
    row = player.player_projections.find_by!(source: "espn", season: 2027)
    snapshot = FIVE.index_with { |key| row.public_send(key).to_f }

    second = EspnStatEstimates.new(season: 2027).apply!
    row.reload
    FIVE.each { |key| assert_in_delta snapshot[key], row.public_send(key).to_f, 0.001, key }
    assert_equal first[:k_dd], second[:k_dd]
    assert_equal first[:players_estimated], second[:players_estimated]
  end

  test "apply! resets a previously estimated value that was edited" do
    seed_center_pool
    player = create_player(full_name: "Edited", positions: [ "C" ], espn_player_id: 80)
    create_season_stat(player: player, gp: 70, min: 2_100, pf: 140, oreb: 192, reb: 836, pts: 1_960, ast: 720, dd: 55, td: 34)
    create_projection(player: player, gp: 77, min: 2_700, reb: 978, pts: 2_053, ast: 708, oreb: nil, dreb: nil, pf: nil, dd: nil, td: nil, missing_stat_keys: FIVE)

    EspnStatEstimates.new(season: 2027).apply!
    row = player.player_projections.find_by!(source: "espn", season: 2027)
    original = row.oreb
    row.update!(oreb: original.to_f + 50)

    EspnStatEstimates.new(season: 2027).apply!
    assert_in_delta original, row.reload.oreb, 0.01
  end

  test "apply! returns a summary hash and does not count ESPN-only rows as estimated" do
    seed_center_pool
    player = create_player(full_name: "Summary", positions: [ "C" ], espn_player_id: 90)
    create_projection(player: player, gp: 80, min: 2_400, reb: 300, pts: 1_400, ast: 400, oreb: nil, dreb: nil, pf: nil, dd: nil, td: nil, missing_stat_keys: FIVE)

    summary = EspnStatEstimates.new(season: 2027).apply!

    assert_equal 2027, summary[:season]
    assert_operator summary[:players_estimated], :>=, 1
    assert summary[:k_dd]
    assert summary[:k_td]
    assert summary[:priors]["C"][:oreb_share]
    assert summary[:priors]["C"][:pf_per_min]
  end

  private
    def seed_center_pool
      10.times do |index|
        player = create_player(
          full_name: "Pool Center #{index}",
          positions: [ "C" ],
          espn_player_id: 1_000 + index
        )
        create_season_stat(
          player: player,
          gp: 50,
          min: 1_500,
          pf: 100,
          oreb: 100,
          dreb: 300,
          reb: 400,
          pts: 500,
          ast: 100,
          dd: 5,
          td: 0
        )
      end

      stats = PlayerSeasonStat.includes(:player).where(source: "espn", season: 2026)
      centers = stats.select { |row| row.player.positions.first == "C" && row.gp.to_f >= 20 }
      centers.sum { |row| row.oreb.to_f } / centers.sum { |row| row.reb.to_f }
    end

    def pf_per_game_rate(position)
      stats = PlayerSeasonStat.includes(:player).where(source: "espn", season: 2026).select { |row| row.gp.to_f >= 20 }
      group = stats.select { |row| row.player.positions.first == position }
      group = stats if group.size < 10
      group.sum { |row| row.pf.to_f } / group.sum { |row| row.gp.to_f }
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
