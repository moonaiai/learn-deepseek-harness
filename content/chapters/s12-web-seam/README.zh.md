---
id: s12
slug: s12-web-seam
title: Web 接缝
summary: ctx.web 在一个提供方注册表和一套执行时选择策略之下，捆绑了搜索与抓取两种操作；三个互相竞争的搜索厂商与一个抓取后端并列共存，dsh-tool-web
  是它们唯一稳定的面向模型 Consumer。
seamKind: seam
module: world-and-collab-seams
order: 12
---

## 一个 seam,两种操作

此前介绍过的每一个能力接缝——shell,以及紧接着要讲的 LLM——都只解析一件事:一个执行器、一个适配器。`ctx.web` 有意与众不同。[`dsh-web` 的 README](../../../packages/web/web/README.md) 直接说明了这一点:"与 shell/fs 不同,它在一个 seam 上跨越搜索与抓取两种操作,每种操作都可能有多个提供方。"搜索与抓取没有共享的请求 schema,也没有共享的业务逻辑——`WebSearchRequest` 和 `WebFetchRequest` 长得完全不像,调用 Exa 端点的代码与跟随 HTTP 重定向的代码毫无共同之处。它们共享的是操作*周围*的一切:一个提供方 id 注册表、一套执行时选择策略、一套中止／错误词汇(`WebError`),以及一个面向产品的"该 harness 如何访问 web"配置接口。

[web 能力 seam Agent Note](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) 明确说明了为什么这是一个 seam 而不是两个:拆分为 `dsh-search`／`dsh-fetch` 的方案曾被考虑并遭到否决,因为共享机制——提供方 id 注册表、与注册顺序无关的选择策略、中止传播、`WebError` 分类体系——"是真实存在的,否则会在两个近乎相同的 seam 之间重复。"保持二者合一的代价,是 `WebRuntime` 类上一对并行的 `search()`／`fetch()` 方法,以及两个独立的提供方 map,而不是一个。这种"看似不对称实则有意为之"的设计是刻意接受的,不是遗漏的抽取。

## Service Definition:一个具体的注册表,而非抽象类

[shell seam](../s07-capability-seams-primer/README.zh.md#the-service-definition-in-code) 把 `ShellExecutor` 定义为一个 `abstract class`,由每个后端继承;`WebRuntime` 采取的是 Service Definition 可以采取的另一种合法形态:一个持有两个 `Map` 的具体类,把请求分派给满足条件的已注册对象——这更接近 `LlmRuntime` 基于名称的适配器注册表,而非 shell seam 那种基于继承的模板。没有任何提供方去*继承* `WebRuntime`;每个提供方都是一个满足 `WebSearchProvider` 或 `WebFetchProvider` 的普通对象,交给 `registerSearchProvider`／`registerFetchProvider` 注册。

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

`registerSearchProvider`／`registerFetchProvider` 都通过一个私有的 `registerProvider` 辅助方法,把 `Map.set` 包裹在 `ctx.effect()` 中——注册会随贡献它的 fiber 一并释放,这与每个 seam 使用的 disposer 纪律一致。同一能力类型下 id 重复,会在**注册时**同步抛出 `WebError` `WEB_DUPLICATE_PROVIDER`,而不是在执行时。

## 提供方选择:从源码验证,而非假设

本章的核心问题是:是在启动时选定一个活跃的搜索提供方,还是可以多个共存?答案来自对 `packages/web/web/src/index.ts:172-194` 中 `resolveProvider` 的实际阅读:**多个提供方可以同时注册,而每次调用都会重新执行一次选择**,而不是在启动时选定一次。

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

以下三种部署都是合法的,而 seam 在每一种情况下的行为都不同:

| 已注册提供方 | `searchProvider` 配置 | 行为 |
|---|---|---|
| 仅 Exa | 未设置 | 自动选择 Exa(恰好一个可用提供方) |
| Exa + Perplexity | 未设置 | 每次 `search()` 调用都会抛出 `WEB_PROVIDER_AMBIGUOUS`,并列出两个 id |
| Exa + Perplexity | `exa` | 每次调用都运行 Exa;Perplexity 保持已注册状态,但永远不会被选中 |
| Exa + Perplexity,Exa 的 `apiKey` 未设置 | `exa` | `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`——已配置的 id 真实存在,但其 `available()` 为 false |

因此,一份 `cordis.yml` 组合确实可以在同一进程中并列挂载 `dsh-web-search-exa`、`dsh-web-search-perplexity` 和 `dsh-web-search-deepseek`——Loader 或 seam 都不会拒绝这种组合——但除非 `searchProvider`(或 `$DSH_WEB_SEARCH_PROVIDER`)恰好指定唯一一个,否则 `ctx.web.search()` 会拒绝在它们之间猜测。这与"用一个提供方替换另一个"恰恰相反:这是"挂载多个,再用一个配置旋钮指向获胜者",而 seam 会主动拒绝歧义情形,而不是按注册顺序挑选。[Agent Note 明确点名了这个替代方案并否决了它](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md#alternatives-considered):"注册顺序不是产品策略。它可能因配置顺序、插件加载、HMR 或重构而改变。"

`available()` 是该机制中同样值得精确说明的另一半。它是一个同步的、仅限本地的检查——凭据是否存在、端点配置是否可解析——提供方在其中禁止发起网络调用。它回答的是"这个具体实现现在是否可用",而不是"网络现在是否可达"。因此,选择永远是两个独立事实的配对:配置了哪个 id(或者未配置时有多少个可用),以及被解析出的提供方的廉价本地检查当前是否通过。

## 为什么有三个搜索厂商,而不是一个替换另一个

Exa、Perplexity 与 DeepSeek 原生搜索并不是同一种协议格式(wire shape)下可以互换的替代品——它们的差异恰好是一个规范化 seam 必须吸收的差异:

- **Exa** 提供专用的 `POST /search` 检索端点。它返回扁平的 `results[]`,不含生成答案;`content` 始终省略。成本与延迟只来自检索本身——一次 HTTP 调用,没有模型推理。
- **Perplexity** 提供 OpenAI 兼容的 `POST /chat/completions` 端点。它返回一个*生成答案*(`choices[0].message.content`)加引用,而且关键在于——协议上没有结果数量控制,因此 `maxResults` 只能由 seam 事后截断来强制执行。
- **DeepSeek** 完全没有专用搜索端点。该提供方发起一次完整的 Anthropic 兼容 Messages API 调用,附带原生 `web_search_20250305` 服务器工具,因此"一次搜索"的代价是一整个模型轮次——真实的生成延迟与 token 开销——而非一次检索调用。它运行在**严格模式**下:如果响应不含 `web_search_tool_result` 块,提供方会直接抛出异常,而不是退化为从模型文本中抓取 URL。

这些确实是不同的搜索质量／API 形状／成本取舍,而这正是 [Agent Note 的问题陈述](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md#problem)所说明的 seam 存在理由:从一开始就同时支持 Exa 与 Perplexity——"两种刻意不同的提供方形状"——正是用来证明规范化的 `WebSearchResult` 约定不是单纯照搬某一个厂商的响应。单一提供方的设计,会让 `content`、`sources[].snippet` 以及结果数量语义悄悄固化为最先接入的那个厂商的形状。

## 为什么抓取是一个独立操作,而不是并入搜索

抓取一个已知 URL 和搜索一个未知 URL 是两个不同的问题,有着不同的安全姿态。搜索返回的是*引用*——提供方已经爬取过的页面、由提供方控制的摘录。抓取直接获取*调用方任意提供的 URL*,这使得 `web_fetch` 成为一个真实的网络边界:[`dsh-web-fetch-http` 的 README](../../../packages/web/web-fetch-http/README.md) 明确指出,在私有网络屏蔽落地之前,"该提供方是一个 SSRF 原语",目前只交付了同源重定向跟随、字节／字符／URL 长度上限、URL 中凭据拒绝,以及真实的 `User-Agent`——没有先解析 DNS 再验证、没有逐跳重新验证,也不屏蔽 loopback／link-local／私有网段。这些传输卫生措施没有一项与搜索有关;搜索提供方从不接触模型调用方提供的 URL。

抓取内部的职责拆分,呼应了该 seam 的一般纪律:提供方负责安全的*获取*(验证、传输、重定向策略、解码、二进制拒绝),而 `dsh-tool-web` 负责*呈现*(通过 turndown 完成 HTML→markdown、截断格式化)。非 2xx 的 HTTP 响应是一个**结果**——状态码加解码后的正文——从不是 `WebError`;该错误类型只用于无法安全获取或表示资源本身的失败。

## 对照表

| 包 | 类型 | 协议格式 | `content`? | 结果数量控制 | 单次调用成本 |
|---|---|---|---|---|---|
| `dsh-web-search-exa` | 搜索 | `POST /search`(专用端点) | 从不(省略) | 请求参数 `numResults`,由 seam 强制最终上限 | 仅检索 |
| `dsh-web-search-perplexity` | 搜索 | `POST /chat/completions`(OpenAI 兼容) | 生成答案 | 无——由 seam 事后截断 | 检索 + 生成 |
| `dsh-web-search-deepseek` | 搜索 | `POST /messages`(Anthropic 兼容,原生 `web_search` 服务器工具) | 从不(未经信任的模型文本不算 `content`) | `maxUses`(搜索次数,而非结果数量)——由 seam 事后截断 | 一整个模型轮次 |
| `dsh-web-fetch-http` | 抓取 | 直接 HTTP(S) GET | 不适用(`WebFetchBody`,而非 `WebSearchResult`) | 不适用——`maxBodyChars`／`maxResponseBytes` 上限 | 一次 HTTP 往返 |

每个搜索提供方最终都要服从同一套 seam 侧强制执行:提供方返回结果后,`WebRuntime.search()` 会调用 `capSources(result, request.maxResults)`,如果提供方返回的数量超过调用方请求的数量,就截断 `sources[]` 并设置 `truncated: true`——无论提供方自身是否有请求时的数量旋钮(Exa 有,Perplexity、DeepSeek 没有)。

## Consumer:进入 seam 只有一条路,绝不导入提供方

`dsh-tool-web` 注册两个独立的 `ToolDefinition`——`web_search` 与 `web_fetch`——各自可通过配置单独开关(`{ search: false }`／`{ fetch: false }`),各自携带自己的协作式工具调用超时预算(`searchTimeoutMs`／`fetchTimeoutMs`,默认各 30000ms,由 `dsh-tool-call-timeout-policy` 强制执行,而非 seam 本身)。该工具从不导入任何具体的提供方包,而且——与 shell 一章中 `dsh-tool-bash` 对待 `sandboxMode` 的纪律相同——它也从不直接调用提供方的 `available()`:

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

`ctx.web.search()` 是该工具进入 seam 的*唯一*路径。提供方不可用、存在歧义或配置错误,永远不会阻止 `web_search` 的 schema 完成注册——启用状态(`search`／`fetch` 配置布尔值)控制注册,而提供方健康状况纯粹是一个执行时关注点,会以结构化 `WebError` 的形式呈现,模型将其当作普通的工具错误来读取。这是 [Agent Note 明确说明的取舍](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md#decision):"一个工具绝不会仅仅因为其选中的提供方缺失、配置错误、缺少凭据、存在歧义或暂时不可用而被取消注册。"一个在会话中途才出现的提供方,会在下一次调用中立即变为可用,provider 侧不会带来任何 schema 变动,也不会导致任何 KV Cache 失效。

`max_results` 从不作为参数到达模型——它是一个由 `dsh-tool-web` 拥有的配置上限(`searchMaxResults`,默认 `8`),应用在该工具构造的 `WebSearchRequest` 上,因此产品可以控制上下文体量,而无需模型对此有任何主张。

## 这个 seam 有意不暴露的部分

有两处省略,对正确理解该 seam 的其余部分很重要。第一,没有能力状态查询,也没有提供方变更事件:调用方只能通过执行并按抛出的 `WebError` code 路由来"观测"可用性——[seam 的已知限制](../../../packages/web/web/README.md)直接点明了这一点,并引用了 [已废弃的观测接口 Agent Note](../../../.agents/notes/archived/simplification/2026-07-04-drop-unconsumed-web-observation-surface.md),记录了为什么从未有消费方需要这样的接口。第二,`WebSearchRequest` 只携带 `query` 和 `maxResults`——没有任何新近程度窗口、域名过滤条件或搜索深度控制能到达 seam,尽管 Perplexity 的 `searchRecency` 与 Exa 的 `searchType`／`highlightsPerResult` 确实作为*提供方私有*配置字段存在。只有当每一个当前的搜索提供方都能诚实支持某个提供方无关字段时,该字段才会被加入;在那之前,提供方专属的旋钮会留在共享词汇之外,而不是作为只有部分提供方会填充的可选字段泄漏进来。
