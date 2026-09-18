require "test_helper"
require "open3"

class FnbaNoServiceObjectsCopTest < ActiveSupport::TestCase
  test "a domain PORO with a domain verb is allowed" do
    stdout, status = investigate(<<~RUBY, path: "app/models/espn_projections.rb")
      class EspnProjections
        def replace_stored!; end
      end
    RUBY

    assert status.success?, stdout
    refute_includes stdout, "Fnba/NoServiceObjects"
  end

  test "an HTTP client class is allowed" do
    stdout, status = investigate(<<~RUBY, path: "app/clients/espn_projections_client.rb")
      class EspnProjectionsClient
        def each_page; end
      end
    RUBY

    assert status.success?, stdout
    refute_includes stdout, "Fnba/NoServiceObjects"
  end

  test "app/domain is an offense" do
    stdout, status = investigate(<<~RUBY, path: "app/domain/espn_projections.rb")
      class EspnProjections
        def replace_stored!; end
      end
    RUBY

    assert_not status.success?
    assert_includes stdout, "Fnba/NoServiceObjects"
    assert_includes stdout, "app/domain"
  end

  test "app/services is an offense even without a Service suffix" do
    stdout, status = investigate(<<~RUBY, path: "app/services/thing.rb")
      class Thing
      end
    RUBY

    assert_not status.success?
    assert_includes stdout, "Fnba/NoServiceObjects"
    assert_includes stdout, "app/services"
  end

  test "*Service type names are an offense" do
    stdout, status = investigate(<<~RUBY, path: "app/models/refresh_projections_service.rb")
      class RefreshProjectionsService
        def replace_stored!; end
      end
    RUBY

    assert_not status.success?
    assert_includes stdout, "Fnba/NoServiceObjects"
    assert_includes stdout, "*Service"
  end

  test "a #call API on a domain object is an offense" do
    stdout, status = investigate(<<~RUBY, path: "app/models/import_espn_projections.rb")
      class ImportEspnProjections
        def call; end
      end
    RUBY

    assert_not status.success?
    assert_includes stdout, "Fnba/NoServiceObjects"
    assert_includes stdout, "#call"
  end

  private
    def investigate(source, path:)
      rubocop = Rails.root.join("bin/rubocop").to_s
      Open3.capture2e(
        rubocop,
        "--only", "Fnba/NoServiceObjects",
        "--stdin", path,
        "--format", "simple",
        "-c", Rails.root.join(".rubocop.yml").to_s,
        stdin_data: source
      )
    end
end
