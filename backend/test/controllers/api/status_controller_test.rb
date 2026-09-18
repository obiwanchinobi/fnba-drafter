require "test_helper"

module Api
  class StatusControllerTest < ActionDispatch::IntegrationTest
    test "GET /api/status returns 200 and ok true" do
      get "/api/status"

      assert_response :success

      json = JSON.parse(response.body)
      assert_equal true, json["ok"]
      assert_equal "fnba-drafter", json["app"]
    end
  end
end

