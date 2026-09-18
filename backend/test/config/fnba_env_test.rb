require "test_helper"
require "erb"
require "tmpdir"
require "yaml"

class FnbaEnvTest < ActiveSupport::TestCase
  def parse_database_yml
    path = Rails.root.join("config/database.yml")
    YAML.safe_load(ERB.new(File.read(path)).result, aliases: true)
  end

  def with_env(vars)
    previous = vars.keys.index_with { |key| ENV[key] }
    vars.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
    yield
  ensure
    previous.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
  end

  test "database.yml honors FNBA_DB_NAME and FNBA_TEST_DB_NAME from ENV" do
    with_env("FNBA_DB_NAME" => "fnba_dev_ft_board", "FNBA_TEST_DB_NAME" => "fnba_test_ft_board") do
      config = parse_database_yml

      assert_equal "fnba_dev_ft_board", config.dig("development", "database")
      assert_equal "fnba_test_ft_board", config.dig("test", "database")
    end
  end

  test "database.yml defaults to main database names" do
    with_env("FNBA_DB_NAME" => nil, "FNBA_TEST_DB_NAME" => nil) do
      config = parse_database_yml

      assert_equal "fnba_drafter_development", config.dig("development", "database")
      assert_equal "fnba_drafter_test", config.dig("test", "database")
    end
  end

  test "ActiveRecord test configuration uses the env fetch default" do
    db_config = ActiveRecord::Base.configurations.configs_for(env_name: "test", name: "primary")
    expected = ENV.fetch("FNBA_TEST_DB_NAME", "fnba_drafter_test")

    assert_match(/\A#{Regexp.escape(expected)}(_\d+)?\z/, db_config.database)
  end

  test "fnba_env does not override an exported FNBA_DB_NAME" do
    path = Rails.root.join("config/fnba_env.rb")
    assert_path_exists path
    load path

    Dir.mktmpdir do |dir|
      File.write(File.join(dir, ".env.local"), "FNBA_DB_NAME=from_file\n")
      with_env("FNBA_DB_NAME" => "from_shell") do
        FnbaEnv.load!(root: dir, env: "development")

        assert_equal "from_shell", ENV["FNBA_DB_NAME"]
      end
    end
  end

  test "fnba_env skips .env.local in test and reads .env.test.local" do
    path = Rails.root.join("config/fnba_env.rb")
    assert_path_exists path
    load path

    Dir.mktmpdir do |dir|
      File.write(File.join(dir, ".env.local"), "FNBA_TEST_DB_NAME=from_local\n")
      File.write(File.join(dir, ".env.test.local"), "FNBA_TEST_DB_NAME=from_test_local\n")
      with_env("FNBA_TEST_DB_NAME" => nil) do
        FnbaEnv.load!(root: dir, env: "test")

        assert_equal "from_test_local", ENV["FNBA_TEST_DB_NAME"]
      end
    end
  end
end
