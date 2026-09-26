require "test_helper"

class WeightSearchRunTest < ActiveSupport::TestCase
  test "user_slot must be a Team Chino draft slot, 1 through 8" do
    assert build_run(1).valid?
    assert build_run(8).valid?
    [ nil, 0, 9 ].each do |user_slot|
      record = build_run(user_slot)
      refute record.valid?
      assert_includes record.errors[:user_slot], "is not included in the list"
    end
  end

  test "margins round-trip as a float array" do
    record = build_run(2, margins: [ 1.5, -0.25, 3.0 ])
    record.save!

    assert_equal [ 1.5, -0.25, 3.0 ], WeightSearchRun.find(record.id).margins
  end

  test "one saved run per slot" do
    build_run(4).save!

    assert_raises(ActiveRecord::RecordNotUnique) { build_run(4).save! }
  end

  private
    def build_run(user_slot, **attributes)
      WeightSearchRun.new(
        {
          user_slot: user_slot,
          weight_set_name: "Draft slot #{user_slot}",
          weights: WeightSet::CATEGORIES.index_with { 1.0 },
          rank: 1,
          roto_points: 100.5,
          margin: 2.5,
          won: true,
          draft_order: MockDraft.draft_order_for(1),
          standings: [],
          picks: []
        }.merge(attributes)
      )
    end
end
