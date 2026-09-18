require "fileutils"
require "open3"
require "tmpdir"

# Local Chrome cookie databases (one file per profile).
class ChromeCookieStore
  Row = Struct.new(
    :path,
    :host,
    :name,
    :encrypted,
    :expires_utc,
    :last_access_utc,
    keyword_init: true
  )

  SKIP_DIR_NAMES = [
    "Snapshots",
    "System Profile",
    "Guest Profile",
    "Storage"
  ].freeze

  COOKIE_SQL =
    "SELECT host_key, name, hex(encrypted_value), expires_utc, last_access_utc " \
    "FROM cookies WHERE name IN ('SWID', 'espn_s2') " \
    "AND (host_key = '.espn.com' OR host_key LIKE '%espn.com');"

  def initialize(root: default_root)
    @root = root
  end

  def espn_rows
    cookie_paths.flat_map { |path| rows_from(path) }
  end

  private
    def default_root
      File.expand_path("~/Library/Application Support/Google/Chrome")
    end

    def cookie_paths
      return [] unless File.directory?(@root)

      Dir.glob(File.join(@root, "**", "Cookies")).select do |path|
        File.file?(path) && SKIP_DIR_NAMES.none? { |name| path.include?("/#{name}/") }
      end
    end

    def rows_from(path)
      with_unlocked_db(path) do |copy|
        out, status = Open3.capture2("sqlite3", "-separator", "\t", copy, COOKIE_SQL)
        return [] unless status.success?

        out.each_line.filter_map { |line| parse_row(path, line) }
      end
    end

    def parse_row(path, line)
      host, name, hex, expires_utc, last_access_utc = line.strip.split("\t", 5)
      return if host.blank? || name.blank? || hex.blank?

      Row.new(
        path: path,
        host: host,
        name: name,
        encrypted: [ hex ].pack("H*"),
        expires_utc: expires_utc.to_i,
        last_access_utc: last_access_utc.to_i
      )
    end

    def with_unlocked_db(src)
      dir = Dir.mktmpdir("chrome-cookies")
      dest = File.join(dir, "Cookies")
      FileUtils.cp(src, dest)
      %w[-wal -shm].each do |suffix|
        extra = src + suffix
        FileUtils.cp(extra, dest + suffix) if File.exist?(extra)
      end
      yield dest
    ensure
      FileUtils.remove_entry(dir) if dir && File.exist?(dir)
    end
end
