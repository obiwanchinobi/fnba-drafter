require "test_helper"

class DoubleDoubleModelTest < ActiveSupport::TestCase
  test "a 28/13/10 per-game player has P(TD) between 0.25 and 0.5 at k 1.5" do
    model = DoubleDoubleModel.new(k_dd: 1.5, k_td: 1.5)
    probs = model.per_game_probabilities(pts: 28, reb: 13, ast: 10)

    assert_operator probs[:td], :>=, 0.25
    assert_operator probs[:td], :<=, 0.5
    assert_operator probs[:dd], :>=, probs[:td]
  end

  test "a 12/3/2 per-game player has P(DD) below 0.02" do
    model = DoubleDoubleModel.new(k_dd: 1.5, k_td: 1.5)
    probs = model.per_game_probabilities(pts: 12, reb: 3, ast: 2)

    assert_operator probs[:dd], :<, 0.02
  end

  test "fit on a synthetic set reproduces the summed DD within 2 percent" do
    seed = DoubleDoubleModel.new(k_dd: 1.3, k_td: 1.6)
    actuals = 30.times.map do |index|
      pts = 18 + (index % 5)
      reb = 8 + (index % 4)
      ast = 6 + (index % 3)
      gp = 40 + index
      probs = seed.per_game_probabilities(pts: pts, reb: reb, ast: ast)
      {
        gp: gp,
        pts: pts,
        reb: reb,
        ast: ast,
        dd: probs[:dd],
        td: probs[:td]
      }
    end

    fitted = DoubleDoubleModel.fit(actuals)
    predicted_dd = actuals.sum { |row| row[:gp] * fitted.per_game_probabilities(pts: row[:pts], reb: row[:reb], ast: row[:ast])[:dd] }
    actual_dd = actuals.sum { |row| row[:gp] * row[:dd] }

    assert_in_delta actual_dd, predicted_dd, 0.02 * actual_dd
    assert_in_delta 1.3, fitted.k_dd, 0.05
    assert_in_delta 1.6, fitted.k_td, 0.05
  end

  test "fit on 5 players returns the defaults" do
    actuals = 5.times.map do
      { gp: 70, pts: 20, reb: 10, ast: 8, dd: 0.2, td: 0.01 }
    end

    fitted = DoubleDoubleModel.fit(actuals)

    assert_equal DoubleDoubleModel::K_DD_DEFAULT, fitted.k_dd
    assert_equal DoubleDoubleModel::K_TD_DEFAULT, fitted.k_td
  end
end
