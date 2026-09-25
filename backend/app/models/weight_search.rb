# Searches, for each Team Chino draft slot, for the weight collection that gives
# Chino the best projected roto margin over the next-best team.
#
# The other seven teams draft by unweighted Total Z (the MockDraft opponent
# model), so a found collection is fitted to that model and to the current
# projection snapshot. The search is a seeded random hill-climb with plateau
# moves and random restarts, bounded by `budget` evaluations per slot.
class WeightSearch
  DEFAULT_BUDGET = 500
  MAX_BUDGET = 2_000
  STEPS = [ 0.05, 0.25, 0.5, 1.0 ].freeze
  NAME_PREFIX = "Draft slot".freeze
  PLATEAU_RESTART = 50

  def self.run!(budget: DEFAULT_BUDGET, seed: nil, source: "espn", season: Espn::SEASON)
    seed ||= Random.new_seed
    projections = PlayerProjection.includes(:player).where(source: source, season: season).to_a
    board = MockDraft.draftable_board(projections)
    if board.size < League::TEAM_COUNT * League::ROUNDS
      raise MockDraft::BoardTooSmall, "draftable board has #{board.size} players"
    end

    search = new(board, projections.index_by(&:player_id), Random.new(seed))
    bests = 1.upto(League::TEAM_COUNT).map { |user_slot| [ user_slot, search.best_for(user_slot, budget) ] }

    {
      budget: budget,
      seed: seed,
      projection_imported_at: projections.map(&:imported_at).max,
      slots: save_slots!(bests, budget)
    }
  end

  def self.save_slots!(bests, budget)
    WeightSet.transaction do
      bests.map do |user_slot, best|
        {
          user_slot: user_slot,
          weight_set: upsert_weight_set!(user_slot, best[:weights]),
          rank: best[:rank],
          roto_points: best[:roto_points],
          margin: best[:margin],
          won: best[:won],
          evaluations: budget
        }
      end
    end
  end
  private_class_method :save_slots!

  def self.upsert_weight_set!(user_slot, weights)
    name = "#{NAME_PREFIX} #{user_slot}"
    record = WeightSet.where("lower(name) = ?", name.downcase).first || WeightSet.new(name: name)
    record.weights = weights
    record.save!
    record
  end
  private_class_method :upsert_weight_set!

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
    best
  end

  private
    def better?(left, right)
      (left.values_at(:margin, :roto_points) <=> right.values_at(:margin, :roto_points)).positive?
    end

    def evaluate(order, weights)
      picks = SnakeDraft.new(
        order: order,
        board: weighted_board(weights),
        rounds: League::ROUNDS,
        ranking: { League::USER_TEAM => :weighted_value }
      ).picks
      table = RotoStandings.new(MockDraft.rosters_for(picks, @by_player_id)).table
      score(table).merge(weights: weights)
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
