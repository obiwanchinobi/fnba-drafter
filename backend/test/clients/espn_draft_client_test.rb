require "test_helper"

class EspnDraftClientTest < ActiveSupport::TestCase
  FakeResponse = Struct.new(:code, :body, keyword_init: true) do
    def [](_name)
      nil
    end
  end

  class FakeHttp
    attr_reader :requests

    def initialize(*responses)
      @responses = responses
      @requests = []
    end

    def request(req)
      @requests << req
      @responses.shift || FakeResponse.new(code: "200", body: { "draftDetail" => {} }.to_json)
    end
  end

  test "blank cookies raise MissingCredentialsError without performing HTTP" do
    http = FakeHttp.new

    error = assert_raises(EspnProjectionsClient::MissingCredentialsError) do
      EspnDraftClient.new(http: http, cookies: EspnCookies.new(swid: "", espn_s2: nil)).fetch
    end

    assert_empty http.requests
    refute_match(/SWID=/i, error.message)
    refute_match(/espn_s2=/i, error.message)
  end

  test "HTTP 401 raises UnauthorizedError" do
    http = FakeHttp.new(FakeResponse.new(code: "401", body: "unauthorized"))

    assert_raises(EspnProjectionsClient::UnauthorizedError) do
      client_with(http).fetch
    end
  end

  test "non-200 raises InvalidResponseError with the HTTP code and ESPN messages" do
    http = FakeHttp.new(FakeResponse.new(code: "500", body: { "messages" => [ "boom" ] }.to_json))

    error = assert_raises(EspnProjectionsClient::InvalidResponseError) do
      client_with(http).fetch
    end

    assert_match(/HTTP 500/, error.message)
    assert_match(/boom/, error.message)
    refute_match(/espn_s2=/i, error.message)
  end

  test "non-JSON body raises InvalidResponseError" do
    http = FakeHttp.new(FakeResponse.new(code: "200", body: "<html>nope</html>"))

    assert_raises(EspnProjectionsClient::InvalidResponseError) do
      client_with(http).fetch
    end
  end

  test "JSON that is not an object raises InvalidResponseError" do
    http = FakeHttp.new(FakeResponse.new(code: "200", body: [ 1, 2 ].to_json))

    assert_raises(EspnProjectionsClient::InvalidResponseError) do
      client_with(http).fetch
    end
  end

  test "fetch returns the parsed league hash and sends draft views, cookies and headers" do
    payload = JSON.parse(file_fixture("espn_draft_detail.json").read)
    http = FakeHttp.new(FakeResponse.new(code: "200", body: payload.to_json))

    json = client_with(http).fetch

    assert_equal payload, json
    assert_equal 1, http.requests.size

    request = http.requests.first
    assert_kind_of Net::HTTP::Get, request
    assert_includes request.path, "/apis/v3/games/fba/seasons/2027/segments/0/leagues/43046"
    assert_includes request.path, "view=mDraftDetail"
    assert_includes request.path, "view=mTeam"
    assert_includes request.path, "view=mSettings"
    assert_equal "espn-fantasy-web", request["x-fantasy-platform"]
    assert_equal "application/json", request["Accept"]
    assert_includes request["Cookie"], "SWID={dummy-swid}"
    assert_includes request["Cookie"], "espn_s2=dummy-s2"
  end

  test "season: overrides the season segment of the URI" do
    http = FakeHttp.new(FakeResponse.new(code: "200", body: { "teams" => [] }.to_json))

    EspnDraftClient.new(
      http: http,
      cookies: EspnCookies.new(swid: "{dummy-swid}", espn_s2: "dummy-s2"),
      season: 2026
    ).fetch

    assert_includes http.requests.first.path, "/seasons/2026/segments/0/leagues/43046"
  end

  private
    def client_with(http)
      EspnDraftClient.new(
        http: http,
        cookies: EspnCookies.new(swid: "{dummy-swid}", espn_s2: "dummy-s2")
      )
    end
end
