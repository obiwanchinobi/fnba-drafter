# ESPN API session cookies (SWID + espn_s2) from the local Chrome profile.
class EspnCookies
  class Missing < StandardError; end
  class Unreadable < StandardError; end

  CHROME_EPOCH = Time.utc(1601, 1, 1)
  PREFERRED_HOST = ".espn.com"

  attr_reader :swid, :espn_s2

  def initialize(swid:, espn_s2:)
    @swid = swid.presence
    @espn_s2 = espn_s2.presence
  end

  def present?
    swid.present? && espn_s2.present?
  end

  def header
    raise Missing, "ESPN Chrome session cookies are missing" unless present?

    "SWID=#{swid}; espn_s2=#{espn_s2}"
  end

  def inspect
    "#<EspnCookies present=#{present?}>"
  end
  alias to_s inspect

  def self.from_chrome(store: ChromeCookieStore.new, decryptor: ChromeCookieDecryptor.new)
    grouped = Hash.new { |hash, key| hash[key] = {} }
    decrypt_failed = false

    store.espn_rows.each do |row|
      next if expired?(row)

      begin
        grouped[[ row.path, row.host ]][row.name] = {
          value: decryptor.decrypt(row.encrypted, host: row.host),
          last_access_utc: row.last_access_utc.to_i
        }
      rescue ChromeCookieDecryptor::Error
        decrypt_failed = true
      end
    end

    best = grouped
      .select { |_key, names| names["SWID"] && names["espn_s2"] }
      .max_by do |(path, host), names|
        [ host == PREFERRED_HOST ? 1 : 0, names.values.map { |item| item[:last_access_utc] }.max, path ]
      end

    if best
      _key, names = best
      return new(swid: names["SWID"][:value], espn_s2: names["espn_s2"][:value])
    end

    raise Unreadable, "ESPN Chrome cookies could not be decrypted" if decrypt_failed

    new(swid: nil, espn_s2: nil)
  end

  def self.expired?(row)
    return false if row.expires_utc.to_i <= 0

    Time.now.utc >= CHROME_EPOCH + (row.expires_utc.to_i / 1_000_000.0)
  end
  private_class_method :expired?
end
