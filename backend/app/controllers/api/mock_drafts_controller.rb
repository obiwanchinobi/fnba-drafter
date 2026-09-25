module Api
  class MockDraftsController < ApplicationController
    include DraftPickJson

    def index
      drafts = MockDraft.includes(:runs).order(created_at: :desc, id: :desc)
      render json: drafts.map { |draft| serialize_summary(draft) }
    end

    def show
      draft = load_draft(params[:id])
      return head :not_found if draft.nil?

      render json: serialize_draft(draft)
    end

    def create
      payload = create_payload
      weight_set = weight_set_from(payload)
      return if performed?

      draft = MockDraft.simulate!(policy: payload["policy"], weight_set: weight_set)
      render json: serialize_draft(load_draft(draft.id)), status: :created
    rescue MockDraft::UnknownPolicy
      render json: { error: "unknown_policy" }, status: :unprocessable_entity
    rescue MockDraft::BoardTooSmall
      render json: { error: "board_too_small" }, status: :unprocessable_entity
    end

    def destroy
      draft = MockDraft.find_by(id: request.path_parameters[:id])
      return head :not_found if draft.nil?

      draft.destroy!
      head :no_content
    end

    private
      def load_draft(id)
        MockDraft.includes(runs: { picks: :player }).find_by(id: id)
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

      # Absent, or JSON null, means the default unweighted board. A present id
      # that does not match a collection is unknown_weight_set.
      def weight_set_from(payload)
        return nil unless payload.key?("weight_set_id")

        id = payload["weight_set_id"]
        return nil if id.nil?

        found = WeightSet.find_by(id: id)
        return found if found

        render json: { error: "unknown_weight_set" }, status: :unprocessable_entity
        nil
      end

      def serialize_summary(draft)
        serialize_identity(draft).merge(
          "runs" => ordered_runs(draft).map { |run| serialize_run_summary(run, draft.user_team) }
        )
      end

      def serialize_draft(draft)
        serialize_identity(draft).merge(
          "runs" => ordered_runs(draft).map { |run| serialize_run(run, draft.user_team) }
        )
      end

      def serialize_identity(draft)
        {
          "id" => draft.id,
          "policy" => draft.policy,
          "source" => draft.source,
          "season" => draft.season,
          "projection_imported_at" => draft.projection_imported_at.utc.iso8601(3),
          "pool_size" => draft.pool_size,
          "user_team" => draft.user_team,
          "weight_set_name" => draft.weight_set_name,
          "weights" => draft.weights,
          "created_at" => draft.created_at.utc.iso8601(3)
        }
      end

      def ordered_runs(draft)
        draft.runs.sort_by(&:user_slot)
      end

      def serialize_run_summary(run, user_team)
        chino = standing_for(run, user_team)
        {
          "user_slot" => run.user_slot,
          "winners" => winners_of(run),
          "user_rank" => chino&.dig("rank"),
          "user_roto_points" => chino&.dig("roto_points")
        }
      end

      def serialize_run(run, user_team)
        serialize_run_summary(run, user_team).merge(
          "id" => run.id,
          "draft_order" => run.draft_order,
          "standings" => run.standings,
          "picks" => run.picks.sort_by(&:overall_pick).map { |pick| draft_pick_json(pick.attributes, pick.player) }
        )
      end

      def winners_of(run)
        Array(run.standings).select { |row| standing_value(row, "rank").to_i == 1 }
          .map { |row| standing_value(row, "team") }
      end

      def standing_for(run, team)
        Array(run.standings).find { |row| standing_value(row, "team") == team }
      end

      def standing_value(row, key)
        row[key] || row[key.to_sym]
      end
  end
end
