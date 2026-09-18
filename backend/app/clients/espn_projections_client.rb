require "net/http"
require "json"
require "uri"

class EspnProjectionsClient
  class Error < StandardError; end
  class MissingCredentialsError < Error; end
  class UnauthorizedError < Error; end
  class InvalidResponseError < Error; end

  MAX_PAGES = 30
  OPEN_TIMEOUT = 10
  READ_TIMEOUT = 10

  def initialize(http: nil, cookies: nil)
    @http = http
    @cookies = cookies
  end

  def each_page
    session = cookies
    unless session.present?
      raise MissingCredentialsError, "ESPN Chrome session cookies are missing"
    end

    offset = 0
    pages = 0

    with_http do |http|
      loop do
        raise Error, "ESPN pagination exceeded #{MAX_PAGES} pages" if pages >= MAX_PAGES

        players, count = parse_response(http.request(build_request(offset, session)))
        yield players
        pages += 1
        offset += Espn::PAGE_SIZE

        break if players.size < Espn::PAGE_SIZE
        break if count && offset >= count
      end
    end
  end

  private
    def cookies
      @cookies ||= EspnCookies.from_chrome
    end

    def cookie_header(session)
      session.header
    end

    def page_uri
      URI.parse(
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/#{Espn::SEASON}/segments/0/leagues/#{Espn::LEAGUE_ID}?view=kona_player_info"
      )
    end

    def build_request(offset, session)
      request = Net::HTTP::Get.new(page_uri)
      request["x-fantasy-source"] = "kona"
      request["x-fantasy-platform"] = "espn-fantasy-web"
      request["Cookie"] = cookie_header(session)
      request["x-fantasy-filter"] = JSON.generate(filter_payload(offset))
      request["Accept"] = "application/json"
      request
    end

    def filter_payload(offset)
      {
        "players" => {
          "filterStatsForExternalIds" => { "value" => [ Espn::SEASON - 1, Espn::SEASON ] },
          "filterSlotIds" => { "value" => (0..11).to_a },
          "filterStatsForSourceIds" => { "value" => [ 0, 1 ] },
          "useFullProjectionTable" => { "value" => true },
          "sortAppliedStatTotal" => { "sortAsc" => false, "sortPriority" => 3, "value" => Espn::STAT_BLOCK_ID },
          "sortDraftRanks" => { "sortPriority" => 2, "sortAsc" => true, "value" => "ROTO" },
          "sortPercOwned" => { "sortPriority" => 4, "sortAsc" => false },
          "limit" => Espn::PAGE_SIZE,
          "offset" => offset,
          "filterStatsForTopScoringPeriodIds" => {
            "value" => 5,
            "additionalValue" => %w[002027 102027 002026 012027 022027 032027 042027]
          }
        }
      }
    end

    def with_http
      if @http
        yield @http
      else
        uri = page_uri
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
      raise UnauthorizedError, "ESPN authentication failed" if code == "401"
      unless code == "200"
        raise InvalidResponseError, espn_failure_message(code, response.body)
      end

      json = parse_json(response.body)
      players = json["players"]
      unless players.is_a?(Array)
        raise InvalidResponseError, "ESPN players payload was not an array"
      end

      count_header = response["X-Fantasy-Filter-Player-Count"]
      count = count_header.present? ? count_header.to_i : nil

      [ players, count ]
    end

    def espn_failure_message(code, body)
      json = JSON.parse(body.to_s)
      messages = Array(json["messages"]).map(&:to_s).reject(&:blank?)
      detail = messages.any? ? messages.join("; ") : "HTTP #{code}"
      "ESPN request failed with HTTP #{code}: #{detail}"
    rescue JSON::ParserError
      "ESPN request failed with HTTP #{code}"
    end

    def parse_json(body)
      json = JSON.parse(body.to_s)
      raise InvalidResponseError, "ESPN response was not JSON" unless json.is_a?(Hash)

      json
    rescue JSON::ParserError
      raise InvalidResponseError, "ESPN response was not JSON"
    end
end
