# Seeded random hill-climb over weight collections for one Team Chino slot.
#
# Every candidate is drafted once per DraftScenarios scenario (the same fixed
# set of opponent rooms for every candidate) and scored on its roto margin over
# the next-best team in each. Candidates compare on
# [win_rate, mean_margin, worst_margin]. Scenario 0 is the base room (seven
# unweighted Total-Z opponents, the MockDraft model); the stored margin, rank,
# points, picks and standings come from it so a result replays on the Mock
# drafts page. Win rate is against modelled rooms, not a forecast of the league.
#
# Plateau moves and random restarts keep the climb moving; `budget` bounds the
# evaluations per slot.
class WeightHillClimb
  STEPS = [ 0.05, 0.25, 0.5, 1.0 ].freeze
  PLATEAU_RESTART = 50
  OBJECTIVE = %i[win_rate mean_margin worst_margin].freeze

  # scenarios: a DraftScenarios over the unweighted board.
  def initialize(scenarios, by_player_id, rng)
    @board = scenarios.board
    @by_player_id = by_player_id
    @rng = rng
    # Opponent orders as board positions, so each evaluation can point them at
    # that candidate's weighted entries (picks then carry its weighted value).
    position = @board.each_with_index.to_h { |entry, index| [ entry[:player_id], index ] }
    @scenario_positions = scenarios.map do |scenario|
      scenario[:orders].transform_values { |order| order.map { |entry| position.fetch(entry[:player_id]) } }
    end
  end

  # Starts from equal weights and returns the best evaluation seen.
  # Ties on the objective move `current` but never replace `best`. A restart or
  # any improvement on `current` resets the plateau count.
  def best_for(user_slot, budget)
    order = MockDraft.draft_order_for(user_slot)
    current = evaluate(order, WeightSet::CATEGORIES.index_with { 1.0 })
    best = current
    stale = 0
    (budget - 1).times do
      restart = stale >= PLATEAU_RESTART
      candidate = evaluate(order, restart ? random_weights : perturb(current[:weights]))
      # `current` never beats `best`, so beating `best` also resets `stale`.
      stale = restart || better?(candidate, current) ? 0 : stale + 1
      current = candidate if restart || !better?(current, candidate)
      best = candidate if better?(candidate, best)
    end
    best.merge(draft_order: order)
  end

  private
    def better?(left, right)
      (left.values_at(*OBJECTIVE) <=> right.values_at(*OBJECTIVE)).positive?
    end

    # Chino's weighted order is sorted once and shared by every scenario.
    def evaluate(order, weights)
      board = weighted_board(weights)
      chino_order = MockDraft.weighted_order(board)
      drafts = @scenario_positions.map do |positions|
        orders = positions.transform_values { |indexes| board.values_at(*indexes) }
        orders[League::USER_TEAM] = chino_order
        picks = SnakeDraft.new(order: order, orders: orders, rounds: League::ROUNDS).picks
        [ picks, RotoStandings.new(MockDraft.rosters_for(picks, @by_player_id)).table ]
      end
      base_picks, base_table = drafts.first
      score(drafts.map { |_, table| margin_of(table) }, base_table)
        .merge(weights: weights, picks: base_picks.map { |pick| pick_row(pick) }, standings: base_table)
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

    def margin_of(table)
      chino_points = chino_row(table)["roto_points"]
      chino_points - table.reject { |row| row["team"] == League::USER_TEAM }.map { |row| row["roto_points"] }.max
    end

    def chino_row(table)
      table.find { |row| row["team"] == League::USER_TEAM }
    end

    # The objective over all scenarios, plus the base scenario's rank and points.
    def score(margins, base_table)
      chino = chino_row(base_table)
      {
        win_rate: margins.count(&:positive?).fdiv(margins.size),
        mean_margin: margins.sum.fdiv(margins.size),
        worst_margin: margins.min,
        margins: margins,
        rank: chino["rank"],
        roto_points: chino["roto_points"],
        margin: margins.first,
        won: margins.first.positive?
      }
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
