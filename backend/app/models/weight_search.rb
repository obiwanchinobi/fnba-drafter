# A saved search, per Team Chino draft slot, for the weight collection that
# wins the most of a seeded set of modelled draft rooms (DraftScenarios), then
# has the best mean and worst roto margin over the next-best team. Each slot's
# best result is saved as a WeightSearchRun and as a "Draft slot N" weight set;
# the stored margin, rank, points, picks and standings are the base scenario's.
#
# A found collection is fitted to those opponent models and to the projection
# snapshot recorded here. WeightHillClimb runs the search per slot.
class WeightSearch < ApplicationRecord
  # Scenarios per candidate, including the base scenario.
  SCENARIO_COUNT = 24
  DEFAULT_BUDGET = 300
  MAX_BUDGET = 2_000
  NAME_PREFIX = "Draft slot".freeze
  # Seeds are stored in a bigint column.
  SEED_RANGE = (0...(1 << 63))

  has_many :runs, class_name: "WeightSearchRun", dependent: :delete_all, inverse_of: :weight_search

  def self.run!(budget: DEFAULT_BUDGET, seed: nil, source: "espn", season: Espn::SEASON,
    scenario_count: SCENARIO_COUNT)
    seed ||= SecureRandom.random_number(SEED_RANGE.end)
    projections = PlayerProjection.includes(:player).where(source: source, season: season).to_a
    board = MockDraft.draftable_board(projections)
    if board.size < League::TEAM_COUNT * League::ROUNDS
      raise MockDraft::BoardTooSmall, "draftable board has #{board.size} players"
    end

    espn_ranks = projections.to_h { |projection| [ projection.player_id, projection.espn_roto_rank ] }
    scenarios = DraftScenarios.new(board: board, espn_ranks: espn_ranks, seed: seed, count: scenario_count)
    climb = WeightHillClimb.new(scenarios, projections.index_by(&:player_id), Random.new(seed))
    bests = 1.upto(League::TEAM_COUNT).map { |user_slot| [ user_slot, climb.best_for(user_slot, budget) ] }

    # Only one search is kept. Replacing it after the climb, in one transaction,
    # leaves the previous result intact when the climb or the save fails.
    transaction do
      destroy_all
      create!(
        budget: budget,
        seed: seed,
        source: source,
        season: season,
        projection_imported_at: projections.map(&:imported_at).max,
        user_team: League::USER_TEAM,
        runs: bests.map { |user_slot, best| build_run(user_slot, best) }
      )
    end
  end

  def self.build_run(user_slot, best)
    weight_set = upsert_weight_set!(user_slot, best[:weights])
    WeightSearchRun.new(
      user_slot: user_slot,
      weight_set_name: weight_set.name,
      weights: weight_set.weights,
      rank: best[:rank],
      roto_points: best[:roto_points],
      margin: best[:margin],
      won: best[:won],
      draft_order: best[:draft_order],
      standings: best[:standings],
      picks: best[:picks]
    )
  end
  private_class_method :build_run

  def self.upsert_weight_set!(user_slot, weights)
    name = "#{NAME_PREFIX} #{user_slot}"
    record = WeightSet.where("lower(name) = ?", name.downcase).first || WeightSet.new(name: name)
    record.weights = weights
    record.save!
    record
  end
  private_class_method :upsert_weight_set!
end
