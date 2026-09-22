require "test_helper"

class PlayerZScoresTest < ActiveSupport::TestCase
  DEFAULTS = {
    gp: 80,
    min: 2_400,
    fgm: 400,
    fga: 800,
    ftm: 200,
    fta: 250,
    tpm: 80,
    tpa: 240,
    oreb: 80,
    dreb: 320,
    ast: 240,
    stl: 80,
    blk: 40,
    to: 120,
    pf: 160,
    dd: 20,
    td: 4,
    pts: 1_080
  }.freeze

  test "counting cat z on season totals equals (x - mean) / population sd" do
    rows = [
      row(1, blk: BigDecimal("80")),
      row(2, blk: BigDecimal("160")),
      row(3, blk: BigDecimal("240"))
    ]
    scores = PlayerZScores.new(rows, pool_size: 128, pool_min_gp: 20)
    per_game_values = [ 1, 2, 3 ]

    assert_equal 3, scores.pool_size
    assert_in_delta population_z(per_game_values, 1), scores.for(1)[:cats][:blk], 1e-9
    assert_in_delta population_z(per_game_values, 2), scores.for(2)[:cats][:blk], 1e-9
    assert_in_delta population_z(per_game_values, 3), scores.for(3)[:cats][:blk], 1e-9
  end

  test "TO and PF z is reversed so fewest is highest z" do
    rows = [
      row(1, to: 80, pf: 80),
      row(2, to: 160, pf: 160),
      row(3, to: 240, pf: 240)
    ]
    scores = PlayerZScores.new(rows, pool_size: 128, pool_min_gp: 20)
    values = [ 1, 2, 3 ]

    assert_in_delta population_z(values, 1, true), scores.for(1)[:cats][:to], 1e-9
    assert_in_delta population_z(values, 3, true), scores.for(3)[:cats][:to], 1e-9
    assert_operator scores.for(1)[:cats][:to], :>, scores.for(3)[:cats][:to]
    assert_operator scores.for(1)[:cats][:pf], :>, scores.for(3)[:cats][:pf]
  end

  test "FG% impact uses numerator - reference ratio * denominator" do
    rows = [
      row(1, fgm: 400, fga: 800),
      row(2, fgm: 640, fga: 800),
      row(3, fgm: 0, fga: 0),
      row(4, fgm: nil, fga: nil)
    ]
    scores = PlayerZScores.new(rows, pool_size: 128, pool_min_gp: 20)
    # Same z as per-game impacts [-1.5, 1.5, 0]; a 0-attempt row stays in the pool.
    impacts = [ -1.5, 1.5, 0 ]

    assert_in_delta population_z(impacts, -1.5), scores.for(1)[:cats][:fg_pct], 1e-9
    assert_in_delta population_z(impacts, 1.5), scores.for(2)[:cats][:fg_pct], 1e-9
    assert_in_delta population_z(impacts, 0), scores.for(3)[:cats][:fg_pct], 1e-9
    assert_not_nil scores.for(3)[:cats][:fg_pct]
    assert_nil scores.for(4)[:cats][:fg_pct]
  end

  test "sd of 0 yields z of 0, not NaN" do
    rows = [ row(1, blk: 40), row(2, blk: 40) ]
    scores = PlayerZScores.new(rows, pool_size: 128, pool_min_gp: 20)
    blk_z = scores.for(1)[:cats][:blk]

    assert_in_delta 0, blk_z, 1e-9
    assert_in_delta 0, scores.for(2)[:cats][:blk], 1e-9
    assert_equal false, blk_z.to_f.nan?
  end

  test "total z is nil when any cat z is nil, and the sum otherwise" do
    complete = PlayerZScores.new(
      [ row(1, blk: 80), row(2, blk: 160) ],
      pool_size: 128,
      pool_min_gp: 20
    )
    first = complete.for(1)

    assert_not_nil first[:total]
    summed = first[:cats].values.sum { |value| value || 0 }
    assert_in_delta summed, first[:total], 1e-9

    missing = PlayerZScores.new(
      [ row(1, pts: nil), row(2) ],
      pool_size: 128,
      pool_min_gp: 20
    )
    assert_nil missing.for(1)[:cats][:pts]
    assert_nil missing.for(1)[:total]
    assert_not_nil missing.for(2)[:total]
  end

  test "pool iteration caps at pool_size and still scores a below-floor gp row" do
    rows = [
      row(1, blk: 320),
      row(2, blk: 240),
      row(3, blk: 160),
      row(4, blk: 80),
      row(5, gp: 10, blk: 200)
    ]
    scores = PlayerZScores.new(rows, pool_size: 2, pool_min_gp: 20)

    assert_equal 2, scores.pool_size
    assert_in_delta(-3, scores.for(3)[:cats][:blk], 1e-9)
    assert_in_delta(-2, scores.for(5)[:cats][:blk], 1e-9)
    assert_not_nil scores.for(5)[:total]
  end

  test "season totals give different pts z for equal rates and different gp" do
    high_gp = row(1, gp: 80)
    low_gp = row(
      2,
      gp: 40,
      min: 1_200,
      fgm: 200,
      fga: 400,
      ftm: 100,
      fta: 125,
      tpm: 40,
      tpa: 120,
      oreb: 40,
      dreb: 160,
      ast: 120,
      stl: 40,
      blk: 20,
      to: 60,
      pf: 80,
      dd: 10,
      td: 2,
      pts: 540
    )
    scores = PlayerZScores.new([ high_gp, low_gp ], pool_size: 128, pool_min_gp: 20)

    assert_in_delta 1, scores.for(1)[:cats][:pts], 1e-9
    assert_in_delta(-1, scores.for(2)[:cats][:pts], 1e-9)
  end

  test "non-finite stat inputs are treated as nil" do
    rows = [
      row(1, blk: Float::NAN),
      row(2, fga: BigDecimal("Infinity"))
    ]
    scores = PlayerZScores.new(rows, pool_size: 128, pool_min_gp: 20)

    assert_nil scores.for(1)[:cats][:blk]
    assert_nil scores.for(1)[:total]
    assert_nil scores.for(2)[:cats][:fg_pct]
    assert_nil scores.for(2)[:total]
  end

  private
    def population_z(values, x, inverse = false)
      mean = values.sum.to_f / values.length
      sd = Math.sqrt(values.sum { |value| (value - mean)**2 } / values.length)
      return 0.0 if sd.zero?

      inverse ? (mean - x) / sd : (x - mean) / sd
    end

    def row(player_id, **overrides)
      attrs = DEFAULTS.merge(player_id: player_id, espn_roto_rank: player_id).merge(overrides)
      ProjectionDouble.new(attrs)
    end

    class ProjectionDouble
      FIELDS = %i[
        player_id gp espn_roto_rank min fgm fga ftm fta tpm tpa
        oreb dreb ast stl blk to pf dd td pts
      ].freeze

      attr_reader(*FIELDS)

      def initialize(attrs)
        FIELDS.each do |field|
          instance_variable_set(:"@#{field}", attrs[field])
        end
      end
    end
end
