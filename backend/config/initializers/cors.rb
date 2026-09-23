# Be sure to restart your server when you modify this file.

# Local Vite origins only; no wildcards. Happy-path SPA calls go through the
# Vite /api proxy and never hit CORS. This covers hitting Rails directly.
# FRONTEND_ORIGIN is included when set; nil is omitted.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*[ "http://localhost:5173", "http://127.0.0.1:5173", ENV["FRONTEND_ORIGIN"] ].compact)

    resource "/api/*",
      headers: :any,
      methods: [ :get, :head, :options ],
      credentials: false
  end
end
