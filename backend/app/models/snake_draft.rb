# Fills a snake from a best-first board, using the earliest open League roster slot.
class SnakeDraft
  class BoardExhausted < StandardError; end

  def initialize(order:, board:, rounds:)
    @order = order
    @board = board
    @rounds = rounds
  end

  def picks
    open_slots = @order.to_h { |team| [ team, League::ROSTER_SLOTS.dup ] }
    drafted = []

    1.upto(@rounds) do |round|
      1.upto(@order.size) do |pick_in_round|
        slot = round.odd? ? pick_in_round : (@order.size - pick_in_round + 1)
        team = @order[slot - 1]
        player, roster_slot = take_player(open_slots.fetch(team))
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
          value: player[:value]
        }
      end
    end

    drafted
  end

  private
    def take_player(open_slots)
      index = @board.index { |player| !open_slot_index(open_slots, player[:positions]).nil? }
      return nil if index.nil?

      player = @board.delete_at(index)
      roster_slot = open_slots.delete_at(open_slot_index(open_slots, player[:positions]))
      [ player, roster_slot ]
    end

    def open_slot_index(open_slots, positions)
      open_slots.index { |slot| slot_accepts?(slot, positions) }
    end

    def slot_accepts?(slot, positions)
      allowed = League::SLOT_ELIGIBILITY.fetch(slot)
      Array(positions).any? { |position| allowed.include?(position) }
    end
end
