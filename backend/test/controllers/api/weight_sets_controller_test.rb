require "test_helper"

module Api
  class WeightSetsControllerTest < ActionDispatch::IntegrationTest
    SCORED_CATEGORIES = %w[
      fgm fg_pct ftm ft_pct tpm tp_pct oreb dreb ast ato stl str blk to pf dd td pts ppm
    ].freeze

    test "GET /api/weight_sets returns an empty list then rows ordered by lower name" do
      get "/api/weight_sets"

      assert_response :success
      assert_equal [], JSON.parse(response.body)

      WeightSet.create!(name: "Zebra", weights: weights_at(1.0))
      WeightSet.create!(name: "alpha", weights: weights_at(1.0))

      get "/api/weight_sets"

      assert_response :success
      json = JSON.parse(response.body)
      assert_equal [ "alpha", "Zebra" ], json.map { |row| row["name"] }
      assert_equal %w[id name updated_at weights], json.first.keys.sort
    end

    test "POST /api/weight_sets with all 19 keys returns 201 and the row" do
      post "/api/weight_sets", params: { name: "Balanced", weights: weights_at(1.0) }, as: :json

      assert_response :created
      body = JSON.parse(response.body)
      assert_equal "Balanced", body["name"]
      assert_equal weights_at(1.0), body["weights"]
      assert body["id"].is_a?(Integer)
      assert body["updated_at"].present?
      assert_not body.key?("created_at")
      assert_equal 1, WeightSet.count
      assert_equal "Balanced", WeightSet.find(body["id"]).name
    end

    test "POST /api/weight_sets missing pf returns 422 naming pf" do
      weights = weights_at(1.0)
      weights.delete("pf")

      post "/api/weight_sets", params: { name: "Broken", weights: weights }, as: :json

      assert_response :unprocessable_entity
      body = JSON.parse(response.body)
      assert_equal "invalid", body["error"]
      assert_match(/pf/, body["details"].join("\n"))
      assert_equal 0, WeightSet.count
    end

    test "POST /api/weight_sets with a differently cased duplicate name returns 422" do
      WeightSet.create!(name: "Balanced", weights: weights_at(1.0))

      post "/api/weight_sets", params: { name: "BALANCED", weights: weights_at(1.0) }, as: :json

      assert_response :unprocessable_entity
      body = JSON.parse(response.body)
      assert_equal "invalid", body["error"]
      assert body["details"].any?
      assert_equal 1, WeightSet.count
    end

    test "PATCH /api/weight_sets/:id renames and updates weights" do
      record = WeightSet.create!(name: "Balanced", weights: weights_at(1.0))
      updated = weights_at(1.0)
      updated["pf"] = 0.8

      patch "/api/weight_sets/#{record.id}",
        params: { name: "Low fouls", weights: updated },
        as: :json

      assert_response :success
      body = JSON.parse(response.body)
      assert_equal record.id, body["id"]
      assert_equal "Low fouls", body["name"]
      assert_in_delta 0.8, body["weights"]["pf"]
      record.reload
      assert_equal "Low fouls", record.name
      assert_in_delta 0.8, record.weights.fetch("pf")
    end

    test "PATCH /api/weight_sets/:id returns 404 for an unknown id" do
      patch "/api/weight_sets/999999",
        params: { name: "Missing", weights: weights_at(1.0) },
        as: :json

      assert_response :not_found
      assert_equal({ "error" => "not_found" }, JSON.parse(response.body))
    end

    test "DELETE /api/weight_sets/:id returns 204 and removes the row" do
      record = WeightSet.create!(name: "Balanced", weights: weights_at(1.0))

      delete "/api/weight_sets/#{record.id}"

      assert_response :no_content
      assert_equal "", response.body
      assert_nil WeightSet.find_by(id: record.id)
    end

    private
      def weights_at(value)
        SCORED_CATEGORIES.index_with { value }
      end
  end
end
