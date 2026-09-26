# Searches, for one Team Chino draft slot, for the weight collection that wins
# the most of a seeded set of modelled draft rooms (DraftScenarios), then has
# the best mean and worst roto margin over the next-best team. The result is
# saved as that slot's WeightSearchRun (replacing any earlier one for the slot)
# and as a "Draft slot N" weight set; the stored margin, rank, points, picks and
# standings are the base scenario's.
#
# A found collection is fitted to those opponent models and to the projection
# snapshot recorded on the run; its win rate is against modelled rooms, not a
# forecast of the league. WeightHillClimb runs the search.
class WeightSearch
  # Scenarios per candidate, including the base scenario.
  SCENARIO_COUNT = 24
  DEFAULT_BUDGET = 300
  MAX_BUDGET = 2_000
  NAME_PREFIX = "Draft slot".freeze
  SLOTS = (1..League::TEAM_COUNT)
  # Seeds are stored in a bigint column.
  SEED_RANGE = (0...(1 << 63))

  def self.run!(user_slot:, budget: DEFAULT_BUDGET, seed: nil, source: "espn", season: Espn::SEASON,
    scenario_count: SCENARIO_COUNT)
    raise ArgumentError, "user_slot must be in #{SLOTS}" unless SLOTS.cover?(user_slot)

    seed ||= SecureRandom.random_number(SEED_RANGE.end)
    projections = PlayerProjection.includes(:player).where(source: source, season: season).to_a
    board = MockDraft.draftable_board(projections)
    if board.size < League::TEAM_COUNT * League::ROUNDS
      raise MockDraft::BoardTooSmall, "draftable board has #{board.size} players"
    end

    espn_ranks = projections.to_h { |projection| [ projection.player_id, projection.espn_roto_rank ] }
    scenarios = DraftScenarios.new(board: board, espn_ranks: espn_ranks, seed: seed, count: scenario_count)
    climb = WeightHillClimb.new(scenarios, projections.index_by(&:player_id), Random.new(seed))
    best = climb.best_for(user_slot, budget)

    # One run is kept per slot. Replacing it after the climb, in one
    # transaction, leaves the previous run intact when the climb or save fails.
    WeightSearchRun.transaction do
      weight_set = upsert_weight_set!(user_slot, best[:weights])
      WeightSearchRun.where(user_slot: user_slot).delete_all
      WeightSearchRun.create!(
        user_slot: user_slot,
        budget: budget,
        seed: seed,
        source: source,
        season: season,
        projection_imported_at: projections.map(&:imported_at).max,
        scenario_count: scenario_count,
        noise_sd: scenarios.noise_sd,
        weight_set_name: weight_set.name,
        weights: weight_set.weights,
        **best.slice(:win_rate, :mean_margin, :worst_margin, :margins, :rank, :roto_points, :margin, :won,
          :draft_order, :standings, :picks)
      )
    end
  end

  def self.upsert_weight_set!(user_slot, weights)
    name = "#{NAME_PREFIX} #{user_slot}"
    record = WeightSet.where("lower(name) = ?", name.downcase).first || WeightSet.new(name: name)
    record.weights = weights
    record.save!
    record
  end
  private_class_method :upsert_weight_set!
end
