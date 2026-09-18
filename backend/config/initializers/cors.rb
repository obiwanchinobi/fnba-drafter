# Be sure to restart your server when you modify this file.

# Local Vite origins only; no wildcards. Happy-path SPA calls go through the
# Vite /api proxy and never hit CORS. This covers hitting Rails on :3000 directly.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "http://localhost:5173", "http://127.0.0.1:5173"

    resource "/api/*",
      headers: :any,
      methods: [:get, :head, :options],
      credentials: false
  end
end
