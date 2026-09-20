class Player < ApplicationRecord
  ALLOWED_POSITIONS = %w[PG SG SF PF C].freeze

  has_many :player_projections, dependent: :destroy
  has_many :season_stats, class_name: "PlayerSeasonStat", dependent: :destroy

  validates :first_name, :last_name, :full_name, :nba_team, presence: true
  validates :espn_player_id, uniqueness: true, allow_nil: true
  validate :positions_are_traditional_labels

  private
    def positions_are_traditional_labels
      return if positions.is_a?(Array) && positions.all? { |position| ALLOWED_POSITIONS.include?(position) }

      errors.add(:positions, "must only include PG, SG, SF, PF, or C")
    end
end
