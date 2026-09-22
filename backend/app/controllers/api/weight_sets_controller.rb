module Api
  class WeightSetsController < ApplicationController
    def index
      render json: WeightSet.order(WeightSet.arel_table[:name].lower.asc)
    end

    def create
      record = WeightSet.create!(json_body.slice("name", "weights"))
      render json: record, status: :created
    rescue ActiveRecord::RecordInvalid => error
      render json: { error: "invalid", details: error.record.errors.full_messages }, status: :unprocessable_entity
    end

    def update
      # params parses the JSON body with ActiveSupport::JSON.decode, which
      # raises under json 3. The id is a path parameter.
      record = WeightSet.find_by(id: request.path_parameters[:id])
      unless record
        render json: { error: "not_found" }, status: :not_found
        return
      end

      record.assign_attributes(json_body.slice("name", "weights"))
      record.save!
      render json: record
    rescue ActiveRecord::RecordInvalid => error
      render json: { error: "invalid", details: error.record.errors.full_messages }, status: :unprocessable_entity
    end

    def destroy
      WeightSet.find(request.path_parameters[:id]).destroy!
      head :no_content
    end
  end
end
