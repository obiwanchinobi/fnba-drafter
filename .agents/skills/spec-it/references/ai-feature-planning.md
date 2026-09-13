# AI feature planning

Read this when `spec-it` marks an AI/LLM feature `actioned`. It captures the planning guidance previously supplied by Grok's bundled `build-with-ai` skill so every harness uses the same baseline. This is a plan-only workflow: do not install SDKs, create accounts, obtain keys, or call a paid API to produce the plan.

- Follow explicit user requirements and existing repository provider decisions. Otherwise retain the original skill's SpaceXAI default (the provider uses xAI's API). Identify the provider assumption in the plan; do not silently replace an existing integration.
- For xAI, the key variable is `XAI_API_KEY` and the OpenAI-compatible base URL is `https://api.x.ai/v1`. Do not invent `SPACEXAI_*` variables or domains.
- Check current official provider documentation before proposing model IDs, SDK calls, or streaming/API behavior. For xAI, start with the [quickstart](https://docs.x.ai/developers/quickstart) and [models](https://docs.x.ai/developers/models). Do not inherit a fixed model ID from a harness's bundled examples.
- If documentation cannot be accessed, mark the affected details unverified in the plan and identify the verification needed before implementation.
- Specify server-side key handling through environment variables or the project's existing secret configuration; never put credentials in source code, browser bundles, or the plan.
- Describe the existing integration points, required configuration, error handling, and meaningful verification steps. For a loop or graph, identify the tools and halt condition. Do not invoke a vendor-bundled skill to substitute different planning rules.
