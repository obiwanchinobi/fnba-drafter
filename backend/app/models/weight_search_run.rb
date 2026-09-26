# One Team Chino draft slot's saved WeightSearch, one row per slot: the search
# inputs (budget, seed, projection snapshot, scenario count and noise scale),
# the winning weights (a snapshot, since "Draft slot N" collections stay
# editable), the scenario scores (win rate, mean and worst margin, and every
# scenario's margin, base scenario first) and the base scenario's rank, points,
# margin, draft order, roto standings and picks (jsonb in the mock_draft_picks
# column shape).
class WeightSearchRun < ApplicationRecord
  attribute :weights, WeightSet::WeightsType.new
  attribute :margins, WeightSet::WeightsType.new
  attribute :standings, MockDraftRun::StandingsType.new
  attribute :picks, MockDraftRun::StandingsType.new

  validates :user_slot, inclusion: { in: 1..League::TEAM_COUNT }
end
