class MockDraftPick < ApplicationRecord
  belongs_to :run, class_name: "MockDraftRun", foreign_key: :mock_draft_run_id, inverse_of: :picks
  belongs_to :player
end
