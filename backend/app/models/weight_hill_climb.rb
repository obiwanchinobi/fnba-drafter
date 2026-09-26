# Seeded random hill-climb over weight collections for one Team Chino slot.
#
# The other seven teams draft by unweighted Total Z (the MockDraft opponent
# model). Plateau moves and random restarts keep the climb moving; `budget`
# bounds the evaluations per slot.
class WeightHillClimb
  STEPS = [ 0.05, 0.25, 0.5, 1.0 ].freeze
  PLATEAU_RESTART = 50

  def initialize(board, by_player_id, rng)
    @board = board
    @by_player_id = by_player_id
    @rng = rng
  end

  # Starts from equal weights and returns the best evaluation seen.
  # Ties on (margin, roto_points) move `current` but never replace `best`.
  def best_for(user_slot, budget)
    order = MockDraft.draft_order_for(user_slot)
    current = evaluate(order, WeightSet::CATEGORIES.index_with { 1.0 })
    best = current
    stale = 0
    (budget - 1).times do
      restart = stale >= PLATEAU_RESTART
      candidate = evaluate(order, restart ? random_weights : perturb(current[:weights]))
      current = candidate if restart || !better?(current, candidate)
      if better?(candidate, best)
        best = candidate
        stale = 0
      else
        stale = restart ? 0 : stale + 1
      end
    end
    best.merge(draft_order: order)
  end

  private
    def better?(left, right)
      (left.values_at(:margin, :roto_points) <=> right.values_at(:margin, :roto_points)).positive?
    end

    def evaluate(order, weights)
      board = weighted_board(weights)
      orders = MockDraft.team_orders(board, MockDraft.weighted_order(board))
      picks = SnakeDraft.new(order: order, orders: orders, rounds: League::ROUNDS).picks
      table = RotoStandings.new(MockDraft.rosters_for(picks, @by_player_id)).table
      score(table).merge(weights: weights, picks: picks.map { |pick| pick_row(pick) }, standings: table)
    end

    # The mock_draft_picks column shape, string-keyed so it can be stored as jsonb.
    def pick_row(pick)
      {
        "round" => pick[:round],
        "slot" => pick[:slot],
        "overall_pick" => pick[:overall_pick],
        "team" => pick[:team],
        "player_id" => pick[:player_id],
        "roster_slot" => pick[:roster_slot],
        "z_total" => pick[:value],
        "z_weighted" => pick[:weighted_value]
      }
    end

    # Same sum, in the same cat order, as MockDraft.draftable_board with weights.
    def weighted_board(weights)
      MockDraft.duplicate_board(@board).each do |entry|
        entry[:weighted_value] = PlayerZScores::CAT_IDS.sum { |cat| weights.fetch(cat.to_s) * entry[:cats][cat] }
      end
    end

    def score(table)
      chino = table.find { |row| row["team"] == League::USER_TEAM }
      best_other = table.reject { |row| row["team"] == League::USER_TEAM }.map { |row| row["roto_points"] }.max
      margin = chino["roto_points"] - best_other
      { rank: chino["rank"], roto_points: chino["roto_points"], margin: margin, won: margin.positive? }
    end

    def perturb(weights)
      cat = WeightSet::CATEGORIES.sample(random: @rng)
      step = STEPS.sample(random: @rng)
      step = -step if @rng.rand(2).zero?
      weights.merge(cat => clamp_weight(weights.fetch(cat) + step))
    end

    def random_weights
      WeightSet::CATEGORIES.index_with { clamp_weight(@rng.rand(0..100) * 0.05) }
    end

    def clamp_weight(value)
      value.clamp(WeightSet::WEIGHT_RANGE.min, WeightSet::WEIGHT_RANGE.max).round(2)
    end
end
