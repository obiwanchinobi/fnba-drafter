require "test_helper"

class ChromeCookieDecryptorTest < ActiveSupport::TestCase
  test "a hanging keychain command is killed instead of blocking" do
    decryptor = ChromeCookieDecryptor.new(
      keychain_command: [ "sleep", "10" ],
      keychain_timeout: 0.2
    )

    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    error = assert_raises(ChromeCookieDecryptor::Error) do
      decryptor.decrypt("v10#{'x' * 32}")
    end
    elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started

    assert_equal "chrome keychain unavailable", error.message
    assert elapsed < 2, "expected keychain hang to abort quickly, took #{elapsed}"
  end
end
