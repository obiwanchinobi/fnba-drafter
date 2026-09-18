require "test_helper"

class EspnProjectionsClientTest < ActiveSupport::TestCase
  FakeResponse = Struct.new(:code, :body, :headers, keyword_init: true) do
    def [](name)
      return nil if headers.nil?

      headers[name] || headers[name.to_s] || headers[name.to_s.downcase]
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
      @responses.shift || FakeResponse.new(code: "200", body: { "players" => [] }.to_json, headers: {})
    end
  end

  test "missing Chrome ESPN cookies raises MissingCredentialsError" do
    error = assert_raises(EspnProjectionsClient::MissingCredentialsError) do
      EspnProjectionsClient.new(cookies: EspnCookies.new(swid: nil, espn_s2: nil)).each_page { }
    end

    refute_match(/SWID=/i, error.message)
    refute_match(/espn_s2=/i, error.message)
  end

  test "blank cookies raise MissingCredentialsError without performing HTTP" do
    http = FakeHttp.new(FakeResponse.new(code: "200", body: { "players" => [] }.to_json, headers: {}))

    assert_raises(EspnProjectionsClient::MissingCredentialsError) do
      EspnProjectionsClient.new(
        http: http,
        cookies: EspnCookies.new(swid: "", espn_s2: "   ")
      ).each_page { }
    end

    assert_empty http.requests
  end

  test "HTTP 401 raises UnauthorizedError" do
    http = FakeHttp.new(FakeResponse.new(code: "401", body: "unauthorized", headers: {}))

    assert_raises(EspnProjectionsClient::UnauthorizedError) do
      client_with(http).each_page { }
    end
  end

  test "HTTP 400 JSON includes ESPN filter messages without cookie values" do
    http = FakeHttp.new(
      FakeResponse.new(
        code: "400",
        body: { "messages" => [ "Filter: Limit request must be accompanied by a sort" ] }.to_json,
        headers: {}
      )
    )

    error = assert_raises(EspnProjectionsClient::InvalidResponseError) do
      client_with(http).each_page { }
    end

    assert_match(/HTTP 400/, error.message)
    assert_match(/accompanied by a sort/, error.message)
    refute_match(/SWID=/i, error.message)
    refute_match(/espn_s2=/i, error.message)
  end

  test "non-JSON body raises InvalidResponseError" do
    http = FakeHttp.new(FakeResponse.new(code: "200", body: "<html>nope</html>", headers: {}))

    assert_raises(EspnProjectionsClient::InvalidResponseError) do
      client_with(http).each_page { }
    end
  end

  test "paginates with offset until a short page and sets kona headers" do
    page50 = { "players" => Array.new(50) { |i| { "id" => i } } }.to_json
    page2 = { "players" => [ { "id" => 50 }, { "id" => 51 } ] }.to_json
    http = FakeHttp.new(
      FakeResponse.new(code: "200", body: page50, headers: { "X-Fantasy-Filter-Player-Count" => "52" }),
      FakeResponse.new(code: "200", body: page2, headers: { "X-Fantasy-Filter-Player-Count" => "52" })
    )

    pages = []
    client_with(http).each_page { |players| pages << players }

    assert_equal 2, pages.size
    assert_equal 50, pages.first.size
    assert_equal 2, pages.last.size
    assert_equal 2, http.requests.size

    first = http.requests.first
    assert_equal "kona", first["x-fantasy-source"]
    assert_equal "espn-fantasy-web", first["x-fantasy-platform"]
    assert_includes first["Cookie"], "SWID={dummy-swid}"
    assert_includes first["Cookie"], "espn_s2=dummy-s2"
    assert_includes first.path, "/apis/v3/games/fba/seasons/2027/segments/0/leagues/43046"
    assert_includes first.path, "view=kona_player_info"

    filters = http.requests.map { |request| JSON.parse(request["x-fantasy-filter"]) }
    assert_equal 0, filters[0].dig("players", "offset")
    assert_equal 50, filters[1].dig("players", "offset")
    assert_equal 50, filters[0].dig("players", "limit")
    assert_equal [ 2026, 2027 ], filters[0].dig("players", "filterStatsForExternalIds", "value")
    assert_equal (0..11).to_a, filters[0].dig("players", "filterSlotIds", "value")
    assert_equal [ 0, 1 ], filters[0].dig("players", "filterStatsForSourceIds", "value")
    assert_equal true, filters[0].dig("players", "useFullProjectionTable", "value")
    assert_equal "102027", filters[0].dig("players", "sortAppliedStatTotal", "value")
    assert_equal "ROTO", filters[0].dig("players", "sortDraftRanks", "value")
    assert_equal true, filters[0].dig("players", "sortDraftRanks", "sortAsc")
    assert_equal 2, filters[0].dig("players", "sortDraftRanks", "sortPriority")
    assert_equal false, filters[0].dig("players", "sortPercOwned", "sortAsc")
    assert_equal 4, filters[0].dig("players", "sortPercOwned", "sortPriority")
    assert_equal 5, filters[0].dig("players", "filterStatsForTopScoringPeriodIds", "value")
    assert_equal %w[002027 102027 002026 012027 022027 032027 042027],
      filters[0].dig("players", "filterStatsForTopScoringPeriodIds", "additionalValue")
  end

  test "stops when offset reaches the filter player count" do
    page50 = { "players" => Array.new(50) { |i| { "id" => i } } }.to_json
    http = FakeHttp.new(
      FakeResponse.new(code: "200", body: page50, headers: { "X-Fantasy-Filter-Player-Count" => "50" }),
      FakeResponse.new(code: "200", body: page50, headers: { "X-Fantasy-Filter-Player-Count" => "50" })
    )

    pages = []
    client_with(http).each_page { |players| pages << players }

    assert_equal 1, pages.size
    assert_equal 1, http.requests.size
  end

  test "caps pagination so a full page stream cannot loop forever" do
    http = Class.new do
      attr_reader :request_count

      def initialize
        @request_count = 0
      end

      def request(_req)
        @request_count += 1
        body = { "players" => Array.new(50) { { "id" => 1 } } }.to_json
        EspnProjectionsClientTest::FakeResponse.new(code: "200", body: body, headers: {})
      end
    end.new

    yielded = 0
    assert_raises(EspnProjectionsClient::Error) do
      client_with(http).each_page { yielded += 1 }
    end

    assert_equal 30, http.request_count
    assert_equal 30, yielded
  end

  private
    def client_with(http)
      EspnProjectionsClient.new(
        http: http,
        cookies: EspnCookies.new(swid: "{dummy-swid}", espn_s2: "dummy-s2")
      )
    end
end
