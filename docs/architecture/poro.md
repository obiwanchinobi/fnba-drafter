# Domain POROs (no service objects)

Adopted 18 September 2026. Inverse of common Rails advice is intentional. Do not “improve” this toward service objects.

A service object is often itself a plain Ruby object, so “always use POROs” is ambiguous unless the **layer, naming, and API** are banned. This file is the unambiguous form.

## Rule

- Extracted domain behavior is a **PORO under** [`backend/app/models/`](../../backend/app/models/), alongside Active Record. A model is a domain concept, not “a class that inherits from `ApplicationRecord`.”
- Name the class after the **thing** (`EspnProjections`, `EspnCookies`), not an Import/Perform/Execute command and not a generic role (`*Service`).
- Public methods are domain verbs on that thing (`fetch`, `replace_stored!`, `from_chrome`). Never a command object whose only API is `#call`.
- Controllers and jobs talk to those POROs. They do not grow the operation.
- Never create `backend/app/services/`, `app/domain/`, `*Service`, `ApplicationService`, or a “service object” layer.
- HTTP adapters stay in [`backend/app/clients/`](../../backend/app/clients/).

Canonical example: [`backend/app/models/espn_projections.rb`](../../backend/app/models/espn_projections.rb) plus [`backend/app/models/espn_kona_player.rb`](../../backend/app/models/espn_kona_player.rb). Copy that shape. Do not add a second pattern.

## Why

Training data defaults to `app/services`, `SomethingService`, and `Something.new.call`. This repo does not. Relocating a `#call` command object into `app/models/` is still a service object.

## Linter

Enforced by RuboCop cop `Fnba/NoServiceObjects` (`backend/lib/rubocop/cop/fnba/no_service_objects.rb`). Do not restate this in `AGENTS.md`.

```sh
(cd backend && bin/rubocop)
```

It fails on `app/services/`, types named `*Service`, and a `#call` API on objects under `app/models/` or `app/services/`.
