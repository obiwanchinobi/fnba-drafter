class WeightSet < ApplicationRecord
  CATEGORIES = %w[fgm fg_pct ftm ft_pct tpm tp_pct oreb dreb ast ato stl str blk to pf dd td pts ppm].freeze
  WEIGHT_RANGE = (0.0..5.0)

  # json 3 JSON.parse no longer accepts the options ActiveSupport::JSON.decode
  # still passes, so the stock jsonb caster cannot read or write this column.
  class WeightsType < ActiveRecord::Type::Json
    def deserialize(value)
      return value unless value.is_a?(::String)

      ::JSON.parse(value, allow_nan: true)
    end

    def serialize(value)
      ::JSON.generate(value, allow_nan: true) unless value.nil?
    end
  end

  attribute :weights, WeightsType.new

  validates :name, presence: true, uniqueness: { case_sensitive: false }
  validate :weights_cover_every_category

  before_validation :normalize_weights

  def as_json(options = nil)
    super((options || {}).merge(only: %i[id name weights updated_at]))
  end

  private
    def normalize_weights
      return unless weights.is_a?(Hash)

      self.weights = weights.each_with_object({}) do |(key, value), normalized|
        normalized[key.to_s] = coerce_weight(value)
      end
    end

    def coerce_weight(value)
      return value unless value.is_a?(String)

      Float(value)
    rescue ArgumentError, TypeError
      value
    end

    def weights_cover_every_category
      unless weights.is_a?(Hash)
        errors.add(:weights, "must include every scored category")
        return
      end

      (CATEGORIES - weights.keys).each do |key|
        errors.add(:weights, "is missing #{key}")
      end

      (weights.keys - CATEGORIES).each do |key|
        errors.add(:weights, "includes extra key #{key}")
      end

      weights.each do |key, value|
        next unless CATEGORIES.include?(key)

        reject_weight_value(key, value)
      end
    end

    def reject_weight_value(key, value)
      unless value.is_a?(Numeric) && value.finite?
        errors.add(:weights, "#{key} is not a finite number")
        return
      end

      return if WEIGHT_RANGE.cover?(value)

      errors.add(:weights, "#{key} must be from 0 to 5")
    end
end
