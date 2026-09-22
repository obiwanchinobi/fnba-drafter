# One fnba_total_z board and the eight user-slot snake permutations of it.
class MockDraft < ApplicationRecord
  POLICIES = %w[fnba_total_z].freeze

  has_many :runs, class_name: "MockDraftRun", dependent: :destroy, inverse_of: :mock_draft

  validates :policy, inclusion: { in: POLICIES }

  class UnknownPolicy < StandardError; end
  class BoardTooSmall < StandardError; end

  def self.simulate!(policy:, source: "espn", season: Espn::SEASON)
    raise UnknownPolicy, "unknown mock draft policy: #{policy}" unless POLICIES.include?(policy)

    projections = PlayerProjection.includes(:player).where(source: source, season: season).to_a
    board = draftable_board(projections)
    if board.size < League::TEAM_COUNT * League::ROUNDS
      raise BoardTooSmall, "draftable board has #{board.size} players"
    end

    transaction do
      draft = create!(
        policy: policy,
        source: source,
        season: season,
        projection_imported_at: projections.map(&:imported_at).max,
        pool_size: League::POOL_SIZE,
        user_team: League::USER_TEAM
      )
      persist_runs!(draft, board)
      draft
    end
  end

  def self.draftable_board(projections)
    scores = PlayerZScores.new(
      projections,
      pool_size: League::POOL_SIZE,
      pool_min_gp: League::POOL_MIN_GP
    )
    projections.filter_map { |projection| draftable_entry(projection, scores) }
      .sort_by { |entry| entry_sort_key(entry) }
      .map { |entry| entry.slice(:player_id, :positions, :value) }
  end
  private_class_method :draftable_board

  def self.draftable_entry(projection, scores)
    return nil if Array(projection.missing_stat_keys).any?
    return nil unless draftable_gp?(projection)

    scored = scores.for(projection.player_id)
    return nil if scored.nil? || scored[:total].nil?

    {
      player_id: projection.player_id,
      positions: Array(projection.player.positions).dup,
      value: scored[:total],
      espn_roto_rank: projection.espn_roto_rank
    }
  end
  private_class_method :draftable_entry

  def self.draftable_gp?(projection)
    value = projection.gp
    return false if value.nil?
    return false unless value.is_a?(Numeric)

    number = value.to_f
    number.finite? && number >= League::POOL_MIN_GP
  end
  private_class_method :draftable_gp?

  # Total Z descending, then ESPN roto rank ascending with nulls last, then player_id.
  def self.entry_sort_key(entry)
    rank = entry[:espn_roto_rank]
    [
      -entry[:value].to_f,
      rank.nil? ? 1 : 0,
      rank || 0,
      entry[:player_id]
    ]
  end
  private_class_method :entry_sort_key

  def self.persist_runs!(draft, board)
    1.upto(League::TEAM_COUNT) do |user_slot|
      order = draft_order_for(user_slot)
      picks = SnakeDraft.new(order: order, board: duplicate_board(board), rounds: League::ROUNDS).picks
      run = draft.runs.create!(user_slot: user_slot, draft_order: order, standings: [])
      insert_picks!(run, picks)
    end
  end
  private_class_method :persist_runs!

  # Team Chino sits at this 1-based slot. The other teams keep TEAMS' circular order.
  def self.draft_order_for(user_slot)
    chino = League::TEAMS.index(League::USER_TEAM)
    shift = chino - (user_slot - 1)
    Array.new(League::TEAM_COUNT) { |index| League::TEAMS[(index + shift) % League::TEAM_COUNT] }
  end
  private_class_method :draft_order_for

  def self.duplicate_board(board)
    board.map do |entry|
      copy = entry.dup
      copy[:positions] = Array(entry[:positions]).dup
      copy
    end
  end
  private_class_method :duplicate_board

  def self.insert_picks!(run, picks)
    now = Time.current
    MockDraftPick.insert_all(
      picks.map { |pick| pick_row(run, pick, now) }
    )
  end
  private_class_method :insert_picks!

  def self.pick_row(run, pick, now)
    {
      mock_draft_run_id: run.id,
      overall_pick: pick[:overall_pick],
      round: pick[:round],
      slot: pick[:slot],
      team: pick[:team],
      player_id: pick[:player_id],
      roster_slot: pick[:roster_slot],
      z_total: pick[:value],
      created_at: now,
      updated_at: now
    }
  end
  private_class_method :pick_row
end
