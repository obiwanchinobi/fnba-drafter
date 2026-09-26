# A fixed, seeded set of opponent drafts for scoring a Team Chino weight
# collection. Each scenario gives the seven opponents their own preference
# order over the shared board entries.
#
# Scenario 0 is the base: every opponent drafts the board in board order (the
# MockDraft opponent model). In every other scenario each opponent starts from
# Total Z or from ESPN roto rank mapped onto the Total-Z ladder (the player at
# ESPN rank r gets the r-th highest Total Z on the board, so both share units),
# adds normal noise in Total-Z units, and sorts descending.
#
# The noise sd is measured, not chosen: the population sd of Total Z minus the
# ladder value over the top of the board, i.e. how much ESPN disagrees with
# Total Z. An opponent with that noise disagrees with Total Z about as much as
# ESPN does.
class DraftScenarios
  include Enumerable

  # Share of noisy opponents who start from Total Z rather than the ESPN ladder.
  # An assumption with no data behind it; a third real ranking (e.g. ADP)
  # would let this be measured.
  TOTAL_Z_SHARE = 0.5
  # Board entries whose ESPN disagreement sets the noise scale: the rostered pool.
  RESIDUAL_POOL = League::TEAM_COUNT * League::ROUNDS
  OPPONENTS = (League::TEAMS - [ League::USER_TEAM ]).freeze

  attr_reader :board, :noise_sd

  # board: best-first entries with :player_id and :value (Total Z).
  # espn_ranks: player_id => ESPN roto rank.
  # count: number of scenarios, including the base scenario.
  def initialize(board:, espn_ranks:, seed:, count:)
    @board = board
    ladder = board.map { |entry| entry[:value].to_f }.sort.reverse
    @total_z = board.map { |entry| entry[:value].to_f }
    @espn_ladder = board.map { |entry| ladder_value(ladder, espn_ranks[entry[:player_id]]) }
    @noise_sd = residual_sd
    rng = Random.new(seed)
    @scenarios = Array.new(count) { |index| index.zero? ? base_scenario : noisy_scenario(rng) }
  end

  def each(&)
    @scenarios.each(&)
  end

  private
    def ladder_value(ladder, rank)
      return nil if rank.nil? || rank < 1

      ladder[rank - 1]
    end

    def espn_base(index)
      @espn_ladder[index] || @total_z[index]
    end

    # Players with no ESPN ladder value carry no disagreement and are left out.
    def residual_sd
      residuals = @board.first(RESIDUAL_POOL).each_index.filter_map do |index|
        @total_z[index] - @espn_ladder[index] unless @espn_ladder[index].nil?
      end
      return 0.0 if residuals.empty?

      mean = residuals.sum / residuals.size
      Math.sqrt(residuals.sum { |residual| (residual - mean)**2 } / residuals.size)
    end

    def base_scenario
      { orders: OPPONENTS.index_with { @board } }
    end

    def noisy_scenario(rng)
      { orders: OPPONENTS.index_with { noisy_order(rng) } }
    end

    def noisy_order(rng)
      total_z_base = rng.rand < TOTAL_Z_SHARE
      scores = @board.each_index.map do |index|
        base = total_z_base ? @total_z[index] : espn_base(index)
        base + (@noise_sd * standard_normal(rng))
      end
      @board.each_index.sort_by { |index| [ -scores[index], index ] }.map { |index| @board[index] }
    end

    # Box-Muller; 1 - rand keeps the log argument in (0, 1].
    def standard_normal(rng)
      Math.sqrt(-2.0 * Math.log(1.0 - rng.rand)) * Math.cos(2.0 * Math::PI * rng.rand)
    end
end
