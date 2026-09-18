# FNBA Drafter

Local-only Rails API + React SPA. The browser talks to Vite; Vite proxies `/api` to Rails. There is no production host.

## Prerequisites

Ruby and Node run on the host (not Docker). Homebrew PostgreSQL should already be listening on 5432.

Versions observed on this machine:

- Ruby 3.2.2
- Rails 8.1.3
- Node 24
- npm >= 11.10 (11.13 observed)
- PostgreSQL 16
- Bundler 4.0.20 (`gem install bundler -v 4.0.20`)

## Setup

```sh
bin/setup
```

Installs backend gems (`bundle install` with Bundler 4.0.20), frontend packages (`npm install`), and prepares PostgreSQL databases (`bin/rails db:prepare` in `backend/`). Fails if Postgres is not accepting connections on `127.0.0.1:5432`. Does not start the servers.

## Develop

```sh
bin/dev
```

Starts both processes and kills the process group on exit (Ctrl-C):

| Process | URL | Command |
|---|---|---|
| API | http://127.0.0.1:3000 | `backend/bin/rails server` |
| SPA | http://localhost:5173 | Vite (`npm run dev` in `frontend/`) |

Open **http://localhost:5173**. Vite proxies `/api` to the Rails API, so the SPA can `fetch('/api/status')` without CORS on the happy path.

**Update from source** reads `SWID` and `espn_s2` from the ESPN session in local Google Chrome (not env vars). Stay logged in to ESPN in Chrome. macOS may ask once to allow Keychain access so those cookies can be decrypted.

Direct API check:

```sh
curl -s http://127.0.0.1:3000/api/status
```

Proxied through Vite:

```sh
curl -s http://localhost:5173/api/status
```

## Tests

```sh
python3 scripts/test_fnba_cli.py
python3 scripts/check_supply_chain.py
(cd backend && bin/rails test)
(cd backend && bin/rubocop)
(cd frontend && npm test)
```

## Layout

- `backend/` — Rails 8 API-only app (`FnbaDrafter`)
- `frontend/` — Vite + React 19 + MUI SPA
