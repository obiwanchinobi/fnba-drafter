require "test_helper"
require "fileutils"
require "openssl"
require "open3"
require "tmpdir"

class EspnCookiesTest < ActiveSupport::TestCase
  PASSWORD = "test-chrome-password"

  test "present? requires both SWID and espn_s2" do
    assert_not EspnCookies.new(swid: nil, espn_s2: "s2").present?
    assert_not EspnCookies.new(swid: "{abc}", espn_s2: "  ").present?
    assert EspnCookies.new(swid: "{abc}", espn_s2: "s2").present?
  end

  test "header does not leak cookie values in Missing errors" do
    error = assert_raises(EspnCookies::Missing) do
      EspnCookies.new(swid: nil, espn_s2: nil).header
    end

    refute_match(/SWID=/i, error.message)
    refute_match(/espn_s2=/i, error.message)
  end

  test "inspect redacts cookie values" do
    cookies = EspnCookies.new(swid: "{secret-swid}", espn_s2: "secret-s2")

    refute_includes cookies.inspect, "secret-swid"
    refute_includes cookies.inspect, "secret-s2"
    assert_includes cookies.inspect, "present=true"
  end

  test "from_chrome reads SWID and espn_s2 from a chrome cookie db" do
    Dir.mktmpdir("chrome-root") do |root|
      db = File.join(root, "Profile 2", "Cookies")
      FileUtils.mkdir_p(File.dirname(db))
      write_cookie_db(
        db,
        [
          cookie_row(".espn.com", "SWID", "{live-swid}", last_access_utc: 200),
          cookie_row(".espn.com", "espn_s2", "live-s2", last_access_utc: 200)
        ]
      )

      cookies = EspnCookies.from_chrome(
        store: ChromeCookieStore.new(root: root),
        decryptor: ChromeCookieDecryptor.new(password: PASSWORD)
      )

      assert cookies.present?
      assert_equal "{live-swid}", cookies.swid
      assert_equal "live-s2", cookies.espn_s2
    end
  end

  test "from_chrome strips the SHA-256 host prefix Chromium prepends to plaintext" do
    Dir.mktmpdir("chrome-root") do |root|
      db = File.join(root, "Profile 2", "Cookies")
      FileUtils.mkdir_p(File.dirname(db))
      write_cookie_db(
        db,
        [
          cookie_row(".espn.com", "SWID", "{live-swid}", last_access_utc: 200, domain_hash: true),
          cookie_row(".espn.com", "espn_s2", "live-s2", last_access_utc: 200, domain_hash: true)
        ]
      )

      cookies = EspnCookies.from_chrome(
        store: ChromeCookieStore.new(root: root),
        decryptor: ChromeCookieDecryptor.new(password: PASSWORD)
      )

      assert_equal "{live-swid}", cookies.swid
      assert_equal "live-s2", cookies.espn_s2
      refute_equal OpenSSL::Digest::SHA256.digest(".espn.com"), cookies.swid.b[0, 32]
    end
  end

  test "from_chrome skips expired cookies and prefers .espn.com" do
    Dir.mktmpdir("chrome-root") do |root|
      stale = File.join(root, "Default", "Cookies")
      live = File.join(root, "Profile 2", "Cookies")
      FileUtils.mkdir_p(File.dirname(stale))
      FileUtils.mkdir_p(File.dirname(live))
      write_cookie_db(
        stale,
        [
          cookie_row(".espn.com", "SWID", "{expired}", expires_utc: 1, last_access_utc: 999),
          cookie_row(".espn.com", "espn_s2", "expired-s2", expires_utc: 1, last_access_utc: 999)
        ]
      )
      write_cookie_db(
        live,
        [
          cookie_row(".espn.com.au", "SWID", "{au}", last_access_utc: 50),
          cookie_row(".espn.com.au", "espn_s2", "au-s2", last_access_utc: 50),
          cookie_row(".espn.com", "SWID", "{us}", last_access_utc: 40),
          cookie_row(".espn.com", "espn_s2", "us-s2", last_access_utc: 40)
        ]
      )

      cookies = EspnCookies.from_chrome(
        store: ChromeCookieStore.new(root: root),
        decryptor: ChromeCookieDecryptor.new(password: PASSWORD)
      )

      assert_equal "{us}", cookies.swid
      assert_equal "us-s2", cookies.espn_s2
    end
  end

  test "from_chrome returns empty cookies when none are stored" do
    Dir.mktmpdir("chrome-root") do |root|
      cookies = EspnCookies.from_chrome(
        store: ChromeCookieStore.new(root: root),
        decryptor: ChromeCookieDecryptor.new(password: PASSWORD)
      )

      assert_not cookies.present?
    end
  end

  private
    def cookie_row(host, name, plaintext, expires_utc: far_future, last_access_utc: 10, domain_hash: false)
      payload = domain_hash ? OpenSSL::Digest::SHA256.digest(host) + plaintext : plaintext
      {
        host: host,
        name: name,
        encrypted: encrypt_v10(payload),
        expires_utc: expires_utc,
        last_access_utc: last_access_utc
      }
    end

    def far_future
      ((Time.utc(2099, 1, 1) - EspnCookies::CHROME_EPOCH) * 1_000_000).to_i
    end

    def encrypt_v10(plaintext)
      key = OpenSSL::PKCS5.pbkdf2_hmac(PASSWORD, "saltysalt", 1003, 16, "SHA1")
      cipher = OpenSSL::Cipher.new("aes-128-cbc")
      cipher.encrypt
      cipher.key = key
      cipher.iv = " " * 16
      "v10" + cipher.update(plaintext) + cipher.final
    end

    def write_cookie_db(path, rows)
      sql = +<<~SQL
        CREATE TABLE cookies (
          host_key TEXT,
          name TEXT,
          encrypted_value BLOB,
          expires_utc INTEGER,
          last_access_utc INTEGER
        );
      SQL
      rows.each do |row|
        hex = row[:encrypted].unpack1("H*")
        sql << "INSERT INTO cookies VALUES ('#{row[:host]}', '#{row[:name]}', X'#{hex}', #{row[:expires_utc]}, #{row[:last_access_utc]});\n"
      end
      _out, status = Open3.capture2("sqlite3", path, sql)
      assert status.success?, "sqlite3 failed writing #{path}"
    end
end
