module Api
  class WeightSearchesController < ApplicationController
    def create
      payload = create_payload
      render json: WeightSearch.run!(budget: budget_from(payload), seed: seed_from(payload))
    rescue MockDraft::BoardTooSmall
      render json: { error: "board_too_small" }, status: :unprocessable_entity
    end

    private
      # json 3 JSON.parse no longer accepts the options ActiveSupport::JSON.decode
      # still passes, so JSON POST bodies cannot be read via params.
      def create_payload
        raw = request.raw_post
        return {} if raw.blank?

        parsed = JSON.parse(raw)
        parsed.is_a?(Hash) ? parsed : {}
      rescue JSON::ParserError
        {}
      end

      def budget_from(payload)
        budget = payload["budget"]
        return WeightSearch::DEFAULT_BUDGET unless budget.is_a?(Integer)

        budget.clamp(1, WeightSearch::MAX_BUDGET)
      end

      def seed_from(payload)
        seed = payload["seed"]
        seed.is_a?(Integer) ? seed : nil
      end
  end
end
