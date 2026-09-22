class ApplicationController < ActionController::API
  private
    # json 3 JSON.parse no longer accepts the options ActiveSupport::JSON.decode
    # still passes, so JSON POST bodies cannot be read via params.
    def json_body
      raw = request.raw_post
      return {} if raw.blank?

      parsed = JSON.parse(raw)
      parsed.is_a?(Hash) ? parsed : {}
    rescue JSON::ParserError
      {}
    end
end
