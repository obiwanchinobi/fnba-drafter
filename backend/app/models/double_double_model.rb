# Per-game double-double / triple-double probabilities from PTS/REB/AST.
class DoubleDoubleModel
  K_DD_DEFAULT = 1.3
  K_TD_DEFAULT = 1.6
  K_MIN = 0.5
  K_MAX = 3.0
  K_STEP = 0.05
  MIN_FIT_PLAYERS = 30
  MIN_GAMES = 20
  THRESHOLD = 9.5

  attr_reader :k_dd, :k_td

  def initialize(k_dd:, k_td:)
    @k_dd = k_dd
    @k_td = k_td
  end

  def self.fit(actuals)
    qualifying = Array(actuals).select { |row| row[:gp].to_f >= MIN_GAMES }
    return new(k_dd: K_DD_DEFAULT, k_td: K_TD_DEFAULT) if qualifying.size < MIN_FIT_PLAYERS

    new(
      k_dd: best_k(qualifying, :dd),
      k_td: best_k(qualifying, :td)
    )
  end

  def per_game_probabilities(pts:, reb:, ast:)
    {
      dd: at_least_two(
        tail_probability(pts, k_dd),
        tail_probability(reb, k_dd),
        tail_probability(ast, k_dd)
      ),
      td: tail_probability(pts, k_td) * tail_probability(reb, k_td) * tail_probability(ast, k_td)
    }
  end

  def self.best_k(rows, stat)
    target = rows.sum { |row| row[:gp].to_f * row[stat].to_f }
    k_grid.min_by do |k|
      model = new(k_dd: k, k_td: k)
      predicted = rows.sum do |row|
        row[:gp].to_f * model.per_game_probabilities(pts: row[:pts], reb: row[:reb], ast: row[:ast])[stat]
      end
      (predicted - target).abs
    end
  end
  private_class_method :best_k

  def self.k_grid
    @k_grid ||= (K_MIN..K_MAX).step(K_STEP).map { |value| value.round(2) }.freeze
  end
  private_class_method :k_grid

  private
    def at_least_two(p1, p2, p3)
      (p1 * p2) + (p1 * p3) + (p2 * p3) - (2 * p1 * p2 * p3)
    end

    def tail_probability(mean, k)
      mean = mean.to_f
      return 0.0 if mean.negative?

      sd = k.to_f * Math.sqrt(mean)
      if sd.zero?
        return mean >= THRESHOLD ? 1.0 : 0.0
      end

      z = (THRESHOLD - mean) / sd
      0.5 * Math.erfc(z / Math.sqrt(2.0))
    end
end
