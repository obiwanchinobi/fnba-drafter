# Load backend/.env* into ENV without overriding real environment variables.
# dotenv-rails is intentionally not used.

module FnbaEnv
  module_function

  def load!(root: File.expand_path("..", __dir__), env: ENV["RAILS_ENV"] || ENV["RACK_ENV"] || "development")
    paths = [ File.join(root, ".env") ]
    paths << File.join(root, ".env.local") unless env.to_s == "test"
    paths << File.join(root, ".env.#{env}")
    paths << File.join(root, ".env.#{env}.local")
    paths.each { |path| apply(path) }
  end

  def apply(path)
    return unless File.file?(path)

    File.foreach(path) do |line|
      stripped = line.strip
      next if stripped.empty? || stripped.start_with?("#")

      key, value = stripped.split("=", 2)
      next if key.nil? || key.empty? || value.nil?

      ENV[key] ||= value
    end
  end
end

FnbaEnv.load!
