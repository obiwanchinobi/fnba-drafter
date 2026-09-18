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

  def initialize(http: nil)
    @http = http
  end

  def each_page
    ensure_credentials!

    offset = 0
    pages = 0

    with_http do |http|
      loop do
        raise Error, "ESPN pagination exceeded #{MAX_PAGES} pages" if pages >= MAX_PAGES

        players, count = parse_response(http.request(build_request(offset)))
        yield players
        pages += 1
        offset += Espn::PAGE_SIZE

        break if players.size < Espn::PAGE_SIZE
        break if count && offset >= count
      end
    end
  end

  private
    def ensure_credentials!
      if swid.blank? || s2.blank?
        raise MissingCredentialsError, "ESPN_SWID and ESPN_S2 must be set"
      end
    end

    def swid
      ENV["ESPN_SWID"]
    end

    def s2
      ENV["ESPN_S2"]
    end

    def cookie_header
      "SWID=#{swid}; espn_s2=#{s2}"
    end

    def page_uri
      URI.parse(
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/#{Espn::SEASON}/segments/0/leagues/#{Espn::LEAGUE_ID}?view=kona_player_info"
      )
    end

    def build_request(offset)
      request = Net::HTTP::Get.new(page_uri)
      request["x-fantasy-source"] = "kona"
      request["x-fantasy-platform"] = "espn-fantasy-web"
      request["Cookie"] = cookie_header
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
      raise InvalidResponseError, "ESPN request failed with HTTP #{code}" unless code == "200"

      json = parse_json(response.body)
      players = json["players"]
      unless players.is_a?(Array)
        raise InvalidResponseError, "ESPN players payload was not an array"
      end

      count_header = response["X-Fantasy-Filter-Player-Count"]
      count = count_header.present? ? count_header.to_i : nil

      [ players, count ]
    end

    def parse_json(body)
      json = JSON.parse(body.to_s)
      raise InvalidResponseError, "ESPN response was not JSON" unless json.is_a?(Hash)

      json
    rescue JSON::ParserError
      raise InvalidResponseError, "ESPN response was not JSON"
    end
end
