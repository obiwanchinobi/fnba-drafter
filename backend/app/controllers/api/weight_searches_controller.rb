module Api
  class WeightSearchesController < ApplicationController
    include DraftPickJson

    def show
      search = WeightSearch.order(created_at: :desc, id: :desc).first
      return head :not_found unless search

      render json: serialize_search(search)
    end

    def create
      payload = create_payload
      search = WeightSearch.run!(budget: budget_from(payload), seed: seed_from(payload))
      render json: serialize_search(search), status: :created
    rescue MockDraft::BoardTooSmall
      render json: { error: "board_too_small" }, status: :unprocessable_entity
    end

    private
      def serialize_search(search)
        runs = search.runs.order(:user_slot).to_a
        player_ids = runs.flat_map { |run| run.picks.map { |pick| pick["player_id"] } }.uniq
        players = player_ids.empty? ? {} : Player.where(id: player_ids).index_by(&:id)

        {
          "budget" => search.budget,
          "seed" => search.seed,
          "projection_imported_at" => search.projection_imported_at.utc.iso8601(3),
          "created_at" => search.created_at.utc.iso8601(3),
          "runs" => runs.map { |run| serialize_run(run, players) }
        }
      end

      def serialize_run(run, players)
        {
          "user_slot" => run.user_slot,
          "weight_set_name" => run.weight_set_name,
          "weights" => run.weights,
          "rank" => run.rank,
          "roto_points" => run.roto_points.to_f,
          "margin" => run.margin.to_f,
          "won" => run.won,
          "draft_order" => run.draft_order,
          "standings" => run.standings,
          "picks" => run.picks.sort_by { |pick| pick["overall_pick"] }
            .map { |pick| draft_pick_json(pick, players.fetch(pick["player_id"])) }
        }
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

      # Out-of-range integers are treated as absent: seeds are stored as bigint.
      def seed_from(payload)
        seed = payload["seed"]
        seed.is_a?(Integer) && WeightSearch::SEED_RANGE.cover?(seed) ? seed : nil
      end
  end
end
