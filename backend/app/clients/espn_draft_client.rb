require "net/http"
require "json"
require "uri"

# Read-only pull of the league's live draft state (mDraftDetail, mTeam and
# mSettings views) using the same Chrome ESPN session as EspnProjectionsClient.
# Errors are EspnProjectionsClient's so controllers share one rescue ladder.
class EspnDraftClient
  VIEWS = %w[mDraftDetail mTeam mSettings].freeze
  OPEN_TIMEOUT = EspnProjectionsClient::OPEN_TIMEOUT
  READ_TIMEOUT = EspnProjectionsClient::READ_TIMEOUT

  def initialize(http: nil, cookies: nil, season: Espn::SEASON)
    @http = http
    @cookies = cookies
    @season = season
  end

  # Returns the parsed league hash.
  def fetch
    session = cookies
    unless session.present?
      raise EspnProjectionsClient::MissingCredentialsError, "ESPN Chrome session cookies are missing"
    end

    with_http { |http| parse_response(http.request(build_request(session))) }
  end

  private
    def cookies
      @cookies ||= EspnCookies.from_chrome
    end

    def league_uri
      query = VIEWS.map { |view| "view=#{view}" }.join("&")
      URI.parse(
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/#{@season}/segments/0/leagues/#{Espn::LEAGUE_ID}?#{query}"
      )
    end

    def build_request(session)
      request = Net::HTTP::Get.new(league_uri)
      request["x-fantasy-platform"] = "espn-fantasy-web"
      request["Cookie"] = session.header
      request["Accept"] = "application/json"
      request
    end

    def with_http
      if @http
        yield @http
      else
        uri = league_uri
        Net::HTTP.start(
          uri.host,
          uri.port,
          use_ssl: true,
          open_timeout: OPEN_TIMEOUT,
          read_timeout: READ_TIMEOUT
        ) { |http| yield http }
      end
    end

    def parse_response(response)
      code = response.code.to_s
      raise EspnProjectionsClient::UnauthorizedError, "ESPN authentication failed" if code == "401"
      unless code == "200"
        raise EspnProjectionsClient::InvalidResponseError, espn_failure_message(code, response.body)
      end

      parse_json(response.body)
    end

    def espn_failure_message(code, body)
      json = JSON.parse(body.to_s)
      messages = json.is_a?(Hash) ? Array(json["messages"]).map(&:to_s).reject(&:blank?) : []
      detail = messages.any? ? messages.join("; ") : "HTTP #{code}"
      "ESPN request failed with HTTP #{code}: #{detail}"
    rescue JSON::ParserError
      "ESPN request failed with HTTP #{code}"
    end

    def parse_json(body)
      json = JSON.parse(body.to_s)
      raise EspnProjectionsClient::InvalidResponseError, "ESPN response was not JSON" unless json.is_a?(Hash)

      json
    rescue JSON::ParserError
      raise EspnProjectionsClient::InvalidResponseError, "ESPN response was not JSON"
    end
end
