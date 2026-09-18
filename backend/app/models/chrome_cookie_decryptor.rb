require "open3"
require "openssl"

# Decrypts Chrome v10/v11 cookie blobs using the Chrome Safe Storage key.
class ChromeCookieDecryptor
  class Error < StandardError; end

  KEYCHAIN_TIMEOUT = 8
  SALT = "saltysalt"
  ITERATIONS = 1003
  KEY_LENGTH = 16
  IV = " " * 16

  def initialize(password: nil, keychain_command: nil, keychain_timeout: KEYCHAIN_TIMEOUT)
    @password = password
    @keychain_command = keychain_command || [
      "security",
      "find-generic-password",
      "-w",
      "-s", "Chrome Safe Storage",
      "-a", "Chrome"
    ]
    @keychain_timeout = keychain_timeout
  end

  DOMAIN_HASH_LENGTH = 32

  def decrypt(blob, host: nil)
    bytes = blob.to_s.b
    prefix = bytes[0, 3]
    unless prefix == "v10" || prefix == "v11"
      raise Error, "unsupported chrome cookie prefix"
    end

    cipher = OpenSSL::Cipher.new("aes-128-cbc")
    cipher.decrypt
    cipher.key = derived_key
    cipher.iv = IV
    plaintext = cipher.update(bytes[3..]) + cipher.final
    strip_domain_hash(plaintext, host)
  rescue OpenSSL::Cipher::CipherError
    raise Error, "chrome cookie decrypt failed"
  end

  private
    def strip_domain_hash(plaintext, host)
      return plaintext if host.blank?

      bytes = plaintext.to_s.b
      return plaintext if bytes.bytesize <= DOMAIN_HASH_LENGTH

      digest = OpenSSL::Digest::SHA256.digest(host.to_s)
      return plaintext unless bytes.start_with?(digest)

      bytes[DOMAIN_HASH_LENGTH..].force_encoding(Encoding::UTF_8)
    end

    def derived_key
      @derived_key ||= OpenSSL::PKCS5.pbkdf2_hmac(password, SALT, ITERATIONS, KEY_LENGTH, "SHA1")
    end

    def password
      @password ||= read_keychain
    end

    def read_keychain
      out_r, out_w = IO.pipe
      err_r, err_w = IO.pipe
      pid = spawn(*@keychain_command, out: out_w, err: err_w, in: File::NULL)
      out_w.close
      err_w.close

      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + @keychain_timeout
      status = nil
      loop do
        _waited, status = Process.wait2(pid, Process::WNOHANG)
        break if status
        if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline
          begin
            Process.kill("KILL", pid)
            Process.wait(pid)
          rescue Errno::ESRCH, Errno::ECHILD
            nil
          end
          raise Error, "chrome keychain unavailable"
        end
        sleep 0.05
      end

      secret = out_r.read.to_s.strip
      raise Error, "chrome keychain unavailable" unless status.success?
      raise Error, "chrome keychain unavailable" if secret.empty?

      secret
    ensure
      out_r&.close
      err_r&.close
    end
end
