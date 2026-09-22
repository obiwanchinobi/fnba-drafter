require "test_helper"

class WeightSetTest < ActiveSupport::TestCase
  SCORED_CATEGORIES = %w[
    fgm fg_pct ftm ft_pct tpm tp_pct oreb dreb ast ato stl str blk to pf dd td pts ppm
  ].freeze

  test "is valid with all 19 category weights at 1.0" do
    record = WeightSet.new(name: "Balanced", weights: weights_at(1.0))

    assert_equal 19, SCORED_CATEGORIES.size
    assert_equal SCORED_CATEGORIES, record.weights.keys
    assert record.valid?, record.errors.full_messages
  end

  test "weights of 0 and 5 are valid" do
    weights = weights_at(1.0)
    weights["to"] = 0
    weights["pf"] = 5

    assert WeightSet.new(name: "Edges", weights: weights).valid?
  end

  test "is invalid when a category is missing" do
    weights = weights_at(1.0)
    weights.delete("pf")
    record = WeightSet.new(name: "Balanced", weights: weights)

    assert_not record.valid?
    assert_match(/pf/, record.errors.full_messages.join("\n"))
  end

  test "is invalid when an extra category is present" do
    record = WeightSet.new(name: "Balanced", weights: weights_at(1.0).merge("reb" => 1.0))

    assert_not record.valid?
    assert_match(/reb/, record.errors.full_messages.join("\n"))
  end

  test "is invalid when a weight is negative" do
    record = WeightSet.new(name: "Balanced", weights: weights_at(1.0).merge("to" => -0.1))

    assert_not record.valid?
    assert_match(/to/, record.errors.full_messages.join("\n"))
  end

  test "is invalid when a weight is above 5" do
    record = WeightSet.new(name: "Balanced", weights: weights_at(1.0).merge("pts" => 5.1))

    assert_not record.valid?
    assert_match(/pts/, record.errors.full_messages.join("\n"))
  end

  test "is invalid when a weight is NaN" do
    record = WeightSet.new(name: "Balanced", weights: weights_at(1.0).merge("td" => Float::NAN))

    assert_not record.valid?
    assert_match(/td/, record.errors.full_messages.join("\n"))
  end

  test "is invalid when a weight is not numeric" do
    record = WeightSet.new(name: "Balanced", weights: weights_at(1.0).merge("pf" => "abc"))

    assert_not record.valid?
    assert_match(/pf/, record.errors.full_messages.join("\n"))
  end

  test "name must be present" do
    missing = WeightSet.new(weights: weights_at(1.0))
    blank = WeightSet.new(name: "   ", weights: weights_at(1.0))

    assert_not missing.valid?
    assert missing.errors[:name].any?
    assert_not blank.valid?
    assert blank.errors[:name].any?
  end

  test "name is unique regardless of case" do
    WeightSet.create!(name: "Balanced", weights: weights_at(1.0))
    duplicate = WeightSet.new(name: "balanced", weights: weights_at(1.0))

    assert_not duplicate.valid?
    assert duplicate.errors[:name].any?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate.save(validate: false) }
  end

  test "numeric strings are coerced to floats on save" do
    weights = weights_at("1.0")
    weights["pf"] = "0.8"
    record = WeightSet.create!(name: "Soft fouls", weights: weights)

    stored = record.reload.weights
    assert_instance_of Float, stored.fetch("pf")
    assert_in_delta 0.8, stored.fetch("pf")
    assert_in_delta 1.0, stored.fetch("fgm")
    assert_equal SCORED_CATEGORIES.sort, stored.keys.sort
  end

  private
    def weights_at(value)
      SCORED_CATEGORIES.index_with { value }
    end
end
