# One Team Chino draft slot of a saved WeightSearch: the winning weights (a
# snapshot, since "Draft slot N" collections stay editable), its score, draft
# order, roto standings and picks (jsonb in the mock_draft_picks column shape).
class WeightSearchRun < ApplicationRecord
  attribute :weights, WeightSet::WeightsType.new
  attribute :standings, MockDraftRun::StandingsType.new
  attribute :picks, MockDraftRun::StandingsType.new

  belongs_to :weight_search, inverse_of: :runs
end
