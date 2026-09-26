module Api
  class WeightSearchesController < ApplicationController
    include DraftPickJson

    def show
      runs = WeightSearchRun.order(:user_slot).to_a
      render json: { "scenario_count" => WeightSearch::SCENARIO_COUNT, "runs" => serialize_runs(runs) }
    end

    def create
      payload = create_payload
      user_slot = payload["user_slot"]
      unless user_slot.is_a?(Integer) && WeightSearch::SLOTS.cover?(user_slot)
        return render json: { error: "invalid_slot" }, status: :unprocessable_entity
      end

      run = WeightSearch.run!(user_slot: user_slot, budget: budget_from(payload), seed: seed_from(payload))
      render json: serialize_runs([ run ]).first, status: :created
    rescue MockDraft::BoardTooSmall
      render json: { error: "board_too_small" }, status: :unprocessable_entity
    end

    private
      def serialize_runs(runs)
        player_ids = runs.flat_map { |run| run.picks.map { |pick| pick["player_id"] } }.uniq
        players = player_ids.empty? ? {} : Player.where(id: player_ids).index_by(&:id)
        runs.map { |run| serialize_run(run, players) }
      end

      def serialize_run(run, players)
        {
          "user_slot" => run.user_slot,
          "weight_set_name" => run.weight_set_name,
          "weights" => run.weights,
          "rank" => run.rank,
          "roto_points" => run.roto_points.to_f,
          "margin" => run.margin.to_f,
          "won" => run.margin.positive?,
          "win_rate" => run.win_rate&.to_f,
          "mean_margin" => run.mean_margin&.to_f,
          "worst_margin" => run.worst_margin&.to_f,
          "margins" => run.margins,
          "scenario_count" => run.scenario_count,
          "noise_sd" => run.noise_sd&.to_f,
          "budget" => run.budget,
          "seed" => run.seed,
          "source" => run.source,
          "season" => run.season,
          "projection_imported_at" => run.projection_imported_at&.utc&.iso8601(3),
          "created_at" => run.created_at.utc.iso8601(3),
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
