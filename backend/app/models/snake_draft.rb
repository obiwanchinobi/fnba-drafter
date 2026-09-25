# Fills a snake from a best-first board, using the earliest open League roster slot.
class SnakeDraft
  class BoardExhausted < StandardError; end

  def initialize(order:, board:, rounds:, ranking: {})
    @order = order
    @board = board
    @rounds = rounds
    @ranking = ranking
  end

  def picks
    open_slots = @order.to_h { |team| [ team, League::ROSTER_SLOTS.dup ] }
    drafted = []

    1.upto(@rounds) do |round|
      1.upto(@order.size) do |pick_in_round|
        slot = round.odd? ? pick_in_round : (@order.size - pick_in_round + 1)
        team = @order[slot - 1]
        player, roster_slot = take_player(open_slots.fetch(team), ranking_key(team))
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
    def ranking_key(team)
      @ranking.fetch(team, :value)
    end

    def take_player(open_slots, key)
      index = selection_index(open_slots, key)
      return nil if index.nil?

      player = @board.delete_at(index)
      roster_slot = open_slots.delete_at(open_slot_index(open_slots, player[:positions]))
      [ player, roster_slot ]
    end

    # :value keeps the board's existing order. Any other key takes the max,
    # and an equal key keeps the earlier board position.
    def selection_index(open_slots, key)
      if key == :value
        return @board.index { |player| !open_slot_index(open_slots, player[:positions]).nil? }
      end

      best_index = nil
      best_value = nil
      @board.each_with_index do |player, index|
        next if open_slot_index(open_slots, player[:positions]).nil?

        candidate = player[key]
        if best_index.nil? || candidate > best_value
          best_index = index
          best_value = candidate
        end
      end
      best_index
    end

    def open_slot_index(open_slots, positions)
      open_slots.index { |slot| slot_accepts?(slot, positions) }
    end

    def slot_accepts?(slot, positions)
      allowed = League::SLOT_ELIGIBILITY.fetch(slot)
      Array(positions).any? { |position| allowed.include?(position) }
    end
end
