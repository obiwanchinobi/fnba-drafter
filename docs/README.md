# Docs

Two homes, plus a gitignored scratch directory for plans.

| Folder | What belongs here |
|--------|-------------------|
| [architecture/](architecture/) | How we build: agent harness, shared skills, worktrees, package-install supply-chain policy, POROs (RuboCop), design-pattern notes |
| [context/](context/) | FNBA league and product: vision, scoring, history, draft-night analysis |
| `tmp/` | Gitignored spec-it plans; not committed |

Product source of truth: [context/product-vision.md](context/product-vision.md). Agent operating rules stay in [`AGENTS.md`](../AGENTS.md). Parallel checkouts: [architecture/worktrees.md](architecture/worktrees.md). npm/Bundler install delays: [architecture/supply-chain.md](architecture/supply-chain.md). Rails domain POROs are enforced by RuboCop (`Fnba/NoServiceObjects`); notes: [architecture/poro.md](architecture/poro.md).
