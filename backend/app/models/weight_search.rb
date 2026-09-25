# Searches, for each Team Chino draft slot, for the weight collection that gives
# Chino the best projected roto margin over the next-best team, and saves each
# as a "Draft slot N" weight set.
#
# A found collection is fitted to the MockDraft opponent model and to the
# current projection snapshot. WeightHillClimb runs the search per slot.
class WeightSearch
  DEFAULT_BUDGET = 500
  MAX_BUDGET = 2_000
  NAME_PREFIX = "Draft slot".freeze

  def self.run!(budget: DEFAULT_BUDGET, seed: nil, source: "espn", season: Espn::SEASON)
    seed ||= Random.new_seed
    projections = PlayerProjection.includes(:player).where(source: source, season: season).to_a
    board = MockDraft.draftable_board(projections)
    if board.size < League::TEAM_COUNT * League::ROUNDS
      raise MockDraft::BoardTooSmall, "draftable board has #{board.size} players"
    end

    climb = WeightHillClimb.new(board, projections.index_by(&:player_id), Random.new(seed))
    bests = 1.upto(League::TEAM_COUNT).map { |user_slot| [ user_slot, climb.best_for(user_slot, budget) ] }

    {
      budget: budget,
      seed: seed,
      projection_imported_at: projections.map(&:imported_at).max,
      runs: save_runs!(bests)
    }
  end

  def self.save_runs!(bests)
    WeightSet.transaction do
      bests.map do |user_slot, best|
        weight_set = upsert_weight_set!(user_slot, best[:weights])
        {
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
        }
      end
    end
  end
  private_class_method :save_runs!

  def self.upsert_weight_set!(user_slot, weights)
    name = "#{NAME_PREFIX} #{user_slot}"
    record = WeightSet.where("lower(name) = ?", name.downcase).first || WeightSet.new(name: name)
    record.weights = weights
    record.save!
    record
  end
  private_class_method :upsert_weight_set!
end
