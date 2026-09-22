class MockDraftRun < ApplicationRecord
  # json 3.0 rejects JSON.parse(source, {}), which ActiveSupport::JSON.decode still calls.
  class StandingsType < ActiveRecord::Type::Json
    def deserialize(value)
      return value unless value.is_a?(::String)

      ::JSON.parse(value)
    end
  end

  attribute :standings, StandingsType.new

  belongs_to :mock_draft, inverse_of: :runs
  has_many :picks,
    class_name: "MockDraftPick",
    foreign_key: :mock_draft_run_id,
    dependent: :destroy,
    inverse_of: :run
end
