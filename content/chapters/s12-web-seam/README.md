---
id: s12
slug: s12-web-seam
title: The Web Seam
summary: ctx.web bundles two operations — search and fetch — behind one provider registry
  and one execution-time selection policy; three competing search vendors and one
  fetch backend sit side by side, and dsh-tool-web is their single stable model-facing
  consumer.
seamKind: seam
module: world-and-collab-seams
order: 12
---

## One seam, two operations

Every other capability seam covered so far — shell, and shortly LLM — resolves one thing: one executor, one adapter. `ctx.web` is different on purpose. The [`dsh-web` README](../../../packages/web/web/README.md) states it directly: "Unlike shell/fs it spans two operations (search and fetch) on one seam, with potentially multiple providers each." Search and fetch share no request schema and no business logic — a `WebSearchRequest` looks nothing like a `WebFetchRequest`, and the code that calls Exa's endpoint has nothing in common with the code that follows an HTTP redirect. What they share is everything *around* the operation: one provider-id registry, one execution-time selection policy, one abort/error vocabulary (`WebError`), and one product-facing "how does this harness reach the web" configuration surface.

The [web capability seam Agent Note](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) is explicit about why this is one seam and not two: splitting into `dsh-search`/`dsh-fetch` was considered and rejected, because the shared machinery — the provider-id registry, the registration-order-independent selection policy, abort propagation, the `WebError` taxonomy — "is real and would otherwise be duplicated across two near-identical seams." The price of keeping them together is a `WebRuntime` class with parallel `search()`/`fetch()` method pairs and two separate provider maps rather than one. That asymmetry-that-isn't is accepted deliberately, not a missed extraction.

## The Service Definition: a concrete registry, not an abstract class

Where [the shell seam](../s07-capability-seams-primer/README.md#the-service-definition-in-code) defines `ShellExecutor` as an `abstract class` that each backend subclasses, `WebRuntime` takes the other legal shape a Service Definition can take: a concrete class that owns two `Map`s and dispatches into whichever registered object satisfies the request, mirroring `LlmRuntime`'s name-keyed adapter registry rather than the shell seam's inheritance-based template. No provider *subclasses* `WebRuntime`; every provider is a plain object satisfying `WebSearchProvider` or `WebFetchProvider` that gets handed to `registerSearchProvider`/`registerFetchProvider`.

```ts filename="packages/web/web/src/index.ts"
export class WebRuntime extends Service {
  static Config: z<WebRuntimeConfig> = z.object({
    searchProvider: z.string(),
    fetchProvider: z.string(),
  })

  private searchProviders = new Map<string, WebSearchProvider>()
  private fetchProviders = new Map<string, WebFetchProvider>()
  private readonly searchProviderId: string | undefined
  private readonly fetchProviderId: string | undefined

  constructor(ctx: Context, config: WebRuntimeConfig = {}) {
    super(ctx, 'web')
    this.searchProviderId = config.searchProvider ?? process.env.DSH_WEB_SEARCH_PROVIDER
    this.fetchProviderId = config.fetchProvider ?? process.env.DSH_WEB_FETCH_PROVIDER
  }

  registerSearchProvider(provider: WebSearchProvider): () => void {
    return this.registerProvider(this.searchProviders, provider)
  }

  registerFetchProvider(provider: WebFetchProvider): () => void {
    return this.registerProvider(this.fetchProviders, provider)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const provider = resolveProvider({
      providers: this.searchProviders,
      ...this.searchProviderId !== undefined ? { configuredId: this.searchProviderId } : {},
    })
    const result = await provider.search(request, signal)
    return capSources(result, request.maxResults)
  }

  async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    const provider = resolveProvider({
      providers: this.fetchProviders,
      ...this.fetchProviderId !== undefined ? { configuredId: this.fetchProviderId } : {},
    })
    return provider.fetch(request, signal)
  }
}
```

`registerSearchProvider`/`registerFetchProvider` both funnel through a private `registerProvider` helper that wraps the `Map.set` in `ctx.effect()` — registration is torn down with the contributing fiber, the same disposer discipline every seam uses. A duplicate `id` within one capability kind throws `WebError` `WEB_DUPLICATE_PROVIDER` synchronously, at registration time, not execution time.

## Provider selection: verified from source, not assumed

The chapter brief asks the load-bearing question directly: is there one active search provider chosen at boot, or can several coexist? The answer, read from `resolveProvider` in `packages/web/web/src/index.ts:172-194`, is: **multiple providers can be registered simultaneously, and selection happens fresh on every call**, not once at boot.

```ts
function resolveProvider<P extends ResolvableProvider>(selection: Selection<P>): P {
  const { configuredId, providers } = selection
  if (configuredId !== undefined) {
    const provider = providers.get(configuredId)
    if (!provider) {
      throw new WebError(`configured web provider "${configuredId}" is not registered`, 'WEB_PROVIDER_CONFIGURED_MISSING')
    }
    if (!provider.available()) {
      throw new WebError(`configured web provider "${configuredId}" is registered but unavailable`, 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE')
    }
    return provider
  }
  const usable = [...providers.values()].filter(provider => provider.available())
  const [single] = usable
  if (single === undefined) {
    throw new WebError('no usable web provider is registered', 'WEB_PROVIDER_UNAVAILABLE')
  }
  if (usable.length > 1) {
    const ids = usable.map(provider => provider.id).join(', ')
    throw new WebError(`multiple usable web providers are registered (${ids}); configure one explicitly`, 'WEB_PROVIDER_AMBIGUOUS')
  }
  return single
}
```

Three deployments are all legal at once, and the seam behaves differently in each:

| Registered providers | `searchProvider` config | Behavior |
|---|---|---|
| Exa only | unset | auto-selects Exa (exactly one usable provider) |
| Exa + Perplexity | unset | every `search()` call throws `WEB_PROVIDER_AMBIGUOUS` naming both ids |
| Exa + Perplexity | `exa` | every call runs Exa; Perplexity sits registered but never selected |
| Exa + Perplexity, Exa's `apiKey` unset | `exa` | `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` — the configured id is real but its `available()` is false |

So a `cordis.yml` composition genuinely can mount `dsh-web-search-exa`, `dsh-web-search-perplexity`, and `dsh-web-search-deepseek` side by side in the same process — nothing in the Loader or the seam rejects it — but `ctx.web.search()` will refuse to guess among them unless `searchProvider` (or `$DSH_WEB_SEARCH_PROVIDER`) names exactly one. This is the opposite of "swap one provider for another": it is "mount several, then point a config knob at the one that wins," with the seam actively refusing the ambiguous case rather than picking by registration order. The [Agent Note names that alternative explicitly and rejects it](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md#alternatives-considered): "Registration order is not a product policy. It can change with config order, plugin loading, HMR, or refactors."

`available()` is the other half of the mechanism worth being precise about. It is a synchronous, local-only check — credential presence, parseable endpoint config — and providers must not make network calls inside it. It answers "is this concrete implementation usable," not "is the network reachable right now." Selection is therefore always a pairing of two independent facts: which id is configured (or how many are usable when none is), and whether the resolved provider's cheap local check currently passes.

## Why three search vendors, not one swapped for another

Exa, Perplexity, and DeepSeek's native search are not interchangeable drop-ins of the same wire shape — they differ in exactly the ways a normalized seam has to absorb:

- **Exa** exposes a dedicated `POST /search` retrieval endpoint. It returns a flat `results[]` with no generated answer; `content` is always omitted. Cost/latency are retrieval-only — one HTTP call, no model inference.
- **Perplexity** exposes an OpenAI-compatible `POST /chat/completions` endpoint. It returns a *generated answer* (`choices[0].message.content`) plus citations, and — critically — has no result-count control on the wire, so `maxResults` is enforced only after the fact by seam truncation.
- **DeepSeek** exposes no dedicated search endpoint at all. The provider issues a full Anthropic-compatible Messages API call with the native `web_search_20250305` server tool attached, so "one search" costs a complete model turn — real generation latency and tokens — not a retrieval call. It runs in **strict mode**: if the response carries no `web_search_tool_result` block, the provider throws rather than degrading to scraping URLs out of prose.

These are genuinely different search-quality/API-shape/cost tradeoffs, which is exactly the case the [Agent Note's problem statement](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md#problem) says the seam exists to prove: supporting Exa and Perplexity from the start — "two deliberately different provider shapes" — is what demonstrates the normalized `WebSearchResult` contract doesn't just mirror one vendor's response. A single-provider design would have let `content`, `sources[].snippet`, and result-count semantics silently calcify around whichever vendor shipped first.

## Why fetch is a separate operation, not folded into search

Fetching a known URL and searching for one are different problems with different security postures. Search returns *citations* — provider-controlled excerpts of pages the provider already crawled. Fetch retrieves an *arbitrary caller-supplied URL* directly, which makes `web_fetch` a live network boundary: the [`dsh-web-fetch-http` README](../../../packages/web/web-fetch-http/README.md) states plainly that "this provider is an SSRF primitive" until private-network blocking lands, and it currently ships with only same-origin redirect following, byte/character/URL-length caps, credential-in-URL rejection, and a real `User-Agent` — no DNS-resolve-then-validate, no per-hop re-validation, no blocking of loopback/link-local/private ranges. None of that transport hygiene is a search concern; search providers never touch the model's caller-supplied URL at all.

The responsibility split inside fetch itself mirrors the seam's general discipline: the provider owns safe *retrieval* (validation, transport, redirect policy, decoding, binary rejection), while `dsh-tool-web` owns *presentation* (HTML→markdown via turndown, truncation formatting). A non-2xx HTTP response is a **result** — status code plus decoded body — never a `WebError`; the error type is reserved for failures to safely retrieve or represent the resource at all.

## The comparison

| Package | Kind | Wire shape | `content`? | Result-count control | Cost per call |
|---|---|---|---|---|---|
| `dsh-web-search-exa` | search | `POST /search` (dedicated) | never (omitted) | `numResults` request param, seam-enforced final bound | retrieval only |
| `dsh-web-search-perplexity` | search | `POST /chat/completions` (OpenAI-compatible) | generated answer | none — seam truncates post-hoc | retrieval + generation |
| `dsh-web-search-deepseek` | search | `POST /messages` (Anthropic-compatible, native `web_search` server tool) | never (untrusted prose is not `content`) | `maxUses` (search count, not result count) — seam truncates post-hoc | a full model turn |
| `dsh-web-fetch-http` | fetch | direct HTTP(S) GET | n/a (`WebFetchBody`, not `WebSearchResult`) | n/a — `maxBodyChars`/`maxResponseBytes` caps | one HTTP round trip |

Every search provider ultimately answers to the same seam-side enforcement: `WebRuntime.search()` calls `capSources(result, request.maxResults)` after the provider returns, truncating `sources[]` and setting `truncated: true` if the provider handed back more than the caller asked for — regardless of whether the provider itself has a request-time count knob (Exa) or not (Perplexity, DeepSeek).

## The Consumer: one path into the seam, never a provider import

`dsh-tool-web` registers two independent `ToolDefinition`s — `web_search` and `web_fetch` — each individually toggleable via config (`{ search: false }` / `{ fetch: false }`), and each carrying its own cooperative tool-call timeout budget (`searchTimeoutMs`/`fetchTimeoutMs`, default 30000ms each, enforced by `dsh-tool-call-timeout-policy`, not the seam). The tool never imports a concrete provider package, and — this is the same discipline the shell chapter's `dsh-tool-bash` follows for `sandboxMode` — it never calls a provider's `available()` directly either:

```ts
// packages/web/tool-web/src/search.ts:258-270
async execute(args, exec) {
  const input = parseSearchArgs(args)
  const result = await ctx.web.search(
    { query: input.query, maxResults },
    exec.signal,
  )
  return {
    ...result.content !== undefined ? { content: result.content } : {},
    sources: result.sources.map(projectSource),
    truncated: result.truncated,
  }
}
```

`ctx.web.search()` is the tool's *only* path into the seam. Provider unavailability, ambiguity, or misconfiguration never prevents `web_search`'s schema from being registered — enablement (the `search`/`fetch` config booleans) controls registration, while provider health is purely an execution-time concern that surfaces as a structured `WebError` the model reads as an ordinary tool error. This is the [Agent Note's stated tradeoff](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md#decision): "A tool is never unregistered merely because its selected provider is missing, misconfigured, missing credentials, ambiguous, or temporarily unavailable." A provider that appears mid-session becomes usable on the very next call, with zero schema churn and zero KV-cache invalidation from the provider side.

`max_results` never reaches the model as an argument at all — it is a `dsh-tool-web`-owned config bound (`searchMaxResults`, default `8`) applied to the `WebSearchRequest` the tool constructs, so the product controls context volume without the model needing an opinion about it.

## What this seam deliberately does not expose

Two omissions matter for reading the rest of the seam correctly. First, there is no capability-status query and no provider-change event: a caller "observes" availability only by executing and routing the thrown `WebError` code — the [seam's Known Limitations](../../../packages/web/web/README.md) call this out directly, along with the reference to the [dropped-observation-surface Agent Note](../../../.agents/notes/archived/simplification/2026-07-04-drop-unconsumed-web-observation-surface.md) recording why no consumer ever needed one. Second, `WebSearchRequest` carries only `query` and `maxResults` — no recency window, domain filter, or search-depth control reaches the seam, even though Perplexity's `searchRecency` and Exa's `searchType`/`highlightsPerResult` exist as *provider-private* config fields. A provider-neutral field is added only once every current search provider can honor it honestly; until then, provider-specific knobs stay out of the shared vocabulary rather than leaking through as optional fields only some providers fill in.
