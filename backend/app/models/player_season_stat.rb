class PlayerSeasonStat < ApplicationRecord
  belongs_to :player

  validates :source, :season, :imported_at, presence: true
  validates :player_id, uniqueness: { scope: [ :source, :season ] }
end
