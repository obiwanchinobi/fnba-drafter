# Fills a snake from per-team preference orders, using the earliest open League
# roster slot. Each team takes the first player in its own order who is not yet
# taken and fits an open slot. Orders are read, never mutated.
class SnakeDraft
  class BoardExhausted < StandardError; end

  # order: teams in first-round pick order.
  # orders: every team => its best-first array of board entries.
  def initialize(order:, orders:, rounds:)
    @order = order
    @orders = orders
    @rounds = rounds
  end

  def picks
    open_slots = @order.to_h { |team| [ team, League::ROSTER_SLOTS.dup ] }
    taken = Set.new
    drafted = []

    1.upto(@rounds) do |round|
      1.upto(@order.size) do |pick_in_round|
        slot = round.odd? ? pick_in_round : (@order.size - pick_in_round + 1)
        team = @order[slot - 1]
        player, roster_slot = take_player(@orders.fetch(team), open_slots.fetch(team), taken)
        if player.nil?
          raise BoardExhausted, "no eligible player for #{team} at overall pick #{drafted.size + 1}"
        end

        drafted << {
          overall_pick: drafted.size + 1,
          round: round,
          slot: slot,
          team: team,
          player_id: player[:player_id],
          roster_slot: roster_slot,
          value: player[:value],
          weighted_value: player[:weighted_value]
        }
      end
    end

    drafted
  end

  private
    def take_player(preferences, open_slots, taken)
      preferences.each do |player|
        next if taken.include?(player[:player_id])

        slot_index = open_slot_index(open_slots, player[:positions])
        next if slot_index.nil?

        taken << player[:player_id]
        return [ player, open_slots.delete_at(slot_index) ]
      end
      nil
    end

    def open_slot_index(open_slots, positions)
      open_slots.index { |slot| slot_accepts?(slot, positions) }
    end

    def slot_accepts?(slot, positions)
      allowed = League::SLOT_ELIGIBILITY.fetch(slot)
      Array(positions).any? { |position| allowed.include?(position) }
    end
end
