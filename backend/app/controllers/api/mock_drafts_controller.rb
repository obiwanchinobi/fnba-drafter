module Api
  class MockDraftsController < ApplicationController
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
      draft = MockDraft.simulate!(policy: create_payload["policy"])
      render json: serialize_draft(load_draft(draft.id)), status: :created
    rescue MockDraft::UnknownPolicy
      render json: { error: "unknown_policy" }, status: :unprocessable_entity
    rescue MockDraft::BoardTooSmall
      render json: { error: "board_too_small" }, status: :unprocessable_entity
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
          "picks" => run.picks.sort_by(&:overall_pick).map { |pick| serialize_pick(pick) }
        )
      end

      def serialize_pick(pick)
        player = pick.player
        {
          "player_id" => pick.player_id,
          "full_name" => player.full_name,
          "positions" => player.positions,
          "nba_team" => player.nba_team,
          "injury_status" => player.injury_status,
          "round" => pick.round,
          "slot" => pick.slot,
          "overall_pick" => pick.overall_pick,
          "team" => pick.team,
          "roster_slot" => pick.roster_slot,
          "z_total" => pick.z_total.to_f
        }
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
