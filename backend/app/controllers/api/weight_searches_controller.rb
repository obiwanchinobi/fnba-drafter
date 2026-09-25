module Api
  class WeightSearchesController < ApplicationController
    include DraftPickJson

    RUN_FIELDS = %i[user_slot weight_set_name weights rank roto_points margin won draft_order standings].freeze

    def create
      payload = create_payload
      render json: serialize_search(WeightSearch.run!(budget: budget_from(payload), seed: seed_from(payload)))
    rescue MockDraft::BoardTooSmall
      render json: { error: "board_too_small" }, status: :unprocessable_entity
    end

    private
      def serialize_search(result)
        runs = result[:runs]
        player_ids = runs.flat_map { |run| run[:picks].map { |pick| pick["player_id"] } }.uniq
        players = player_ids.empty? ? {} : Player.where(id: player_ids).index_by(&:id)

        {
          "budget" => result[:budget],
          "seed" => result[:seed],
          "projection_imported_at" => result[:projection_imported_at]&.utc&.iso8601(3),
          "runs" => runs.map { |run| serialize_run(run, players) }
        }
      end

      def serialize_run(run, players)
        run.slice(*RUN_FIELDS).transform_keys(&:to_s).merge(
          "picks" => run[:picks].sort_by { |pick| pick["overall_pick"] }
            .map { |pick| draft_pick_json(pick, players.fetch(pick["player_id"])) }
        )
      end

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
