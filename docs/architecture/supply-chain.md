# Package install supply-chain policy

Adopted 18 September 2026. This is how FNBA delays and hardens dependency installs for the planned stack: **npm** (React / Vite SPA) and **Bundler** (Rails API). Product scoring rules stay in [product-vision.md](../context/product-vision.md).

Most registry compromises land in a short window: a maintainer account is taken over, a malicious version is published, and the next `npm install` / `bundle install` resolves to it before the version is yanked. A **minimum release age of 7 days** skips that window. Compromised releases are usually caught within hours; we wait a week.

This does not replace lockfiles, checksums, or advisory scanners. It only holds back versions that are too new to have been scrutinized.

## npm (frontend)

Canonical file: [`.npmrc`](../../.npmrc) at the repository root. npm 11.10.0+ is required (`min-release-age`). This machine has npm 11.13.0, which honors it. npm 11.13 resolves `min-release-age` to a `before` timestamp (`npm config get min-release-age` prints `null`; `npm config get before` is about seven days ago).

| Setting | Value | Why |
|---|---|---|
| `min-release-age` | `7` (days) | Do not install a version published in the last 7 days |
| `ignore-scripts` | `true` | Block `preinstall` / `install` / `postinstall` payloads |
| `allow-git` | `none` | Git deps can run tooling outside lifecycle scripts |
| `save-exact` | `true` | New deps are pinned, not a floating `^` range |
| `package-lock` | `true` | Always write `package-lock.json` |
| `audit` | `true` | Run `npm audit` on install |
| `engine-strict` | `true` | Once `engines.npm` exists, refuse older CLIs |

npm reads **project** `.npmrc` from the directory that owns `package.json`, not from parent folders. Root `.npmrc` covers commands run from the repo root (`npm create …`). When `frontend/` exists it must have the same keys (copy the root file). `frontend/package.json` must set `"engines": { "npm": ">=11.10.0" }`. Commit `package-lock.json`. Prefer `npm ci` once that lockfile exists.

`allow-remote` / `allow-file` are not set: npm 11.13 warns on those keys and npm 12 will error. Revisit after an npm 12 upgrade.

Vite may need a one-off native rebuild if `ignore-scripts` skips a binary (esbuild). Rebuild that package explicitly. Do not turn `ignore-scripts` off for the whole tree.

## Bundler (backend)

Cooldown ships in **Bundler 4.0.13+**. This machine currently has Bundler **2.4.15**, which stores a `cooldown` config key but does **not** filter versions. Before `rails new` or any `bundle install` that resolves gems, install Bundler 4 alongside 2.4:

```sh
gem install bundler -v 4.0.20
```

Do not run `gem update --system` unless you intend to change RubyGems for every project on this Ruby. Other lockfiles that record `BUNDLED WITH 2.4.x` can keep using Bundler 2.4.

When a Gemfile exists (expected at `backend/Gemfile`), the rubygems.org source must declare the delay in the file so every clone enforces it:

```ruby
source "https://rubygems.org", cooldown: 7
```

Commit `Gemfile.lock`. An existing lockfile is honored as-is; cooldown applies when resolving (first install or `bundle update`).

This repository has no Gemfile yet. The checker enforces the source line and Bundler version only after one appears.

## Escape hatch (0-day / actively exploited advisory)

The delay is wrong when the version you need is the one published today. Override **one command**, then restore the policy. Do not commit `min-release-age=0` or `cooldown: 0`.

```sh
npm install --min-release-age=0
bundle install --cooldown 0
# or: BUNDLE_COOLDOWN=0 bundle update rails
```

## Checker

```sh
python3 scripts/check_supply_chain.py
```

Run it before committing changes to `.npmrc`, a Gemfile source line, or `frontend/package.json` engines. Tests: `python3 scripts/test_check_supply_chain.py`.

## Out of scope

- Switching the frontend from npm to pnpm or Yarn
- Pointing Bundler at a third-party cooldown registry
- Socket / Dependabot / CI malware scanning (no CI in this repo yet)
- `bundler-audit` (known CVEs; add with the Rails app, it does not delay fresh malware)
