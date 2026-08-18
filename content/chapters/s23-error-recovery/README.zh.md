---
id: s23
slug: s23-error-recovery
title: "错误恢复与防御式模式"
summary: "agent loop 如何协作式地取消轮次与工具调用而不是硬杀死它们，agent/request-error 如何驱动透明重试，以及三篇真实事故复盘所体现的、让本代码库的失败保持「响亮」而非静默的防御性工程规则。"
module: orchestration-and-capstone
order: 23
sources:
  - path: docs/architecture.zh.md
    lineStart: 67
    lineEnd: 94
    label: "轮次流程 ASCII 时序"
  - path: docs/subsystems/core.zh.md
    lineStart: 57
    lineEnd: 201
    label: "Agent 句柄：cancel()、CancelOptions、AgentCancelCause"
  - path: docs/subsystems/core.zh.md
    lineStart: 924
    lineEnd: 951
    label: "agent/request-error waterfall"
  - path: .agents/notes/implemented/architecture/2026-07-16-explicit-turn-cancellation.zh.md
    label: "Agent Note：显式轮次取消能力"
  - path: .agents/notes/implemented/architecture/2026-07-19-cooperative-tool-cancellation.zh.md
    label: "Agent Note：注册表边界上的协作式工具取消"
  - path: packages/core/agent-loop/src/agent.ts
    lineStart: 332
    lineEnd: 371
    label: "step()：request-error waterfall 与重试循环"
  - path: packages/core/agent-loop/src/tool-calls.ts
    lineStart: 248
    lineEnd: 259
    label: "appendSkippedToolCall()：未派发调用的持久配对记录"
  - path: packages/llm/llm-retry/README.zh.md
    label: "dsh-llm-retry：基于 agent/request-error 的 normal/always 重试模式"
  - path: docs/defensive-patterns.zh.md
    label: "防御性模式"
  - path: docs/postmortem/README.zh.md
    label: "事故复盘索引"
  - path: docs/postmortem/0001-acp-default-export-drops-inject.zh.md
    label: "事故复盘 0001：export default 丢弃 inject"
  - path: docs/postmortem/0002-js-expression-disabled-filesystem-tools.zh.md
    label: "事故复盘 0002：!!js 永久禁用文件系统工具"
  - path: docs/postmortem/0004-landlock-partial-notice-misclassified-child-failures.zh.md
    label: "事故复盘 0004：Landlock 部分强制执行通知导致子进程失败被误归类"
---

## 两类失败，两种截然不同的应对

本章讨论的是一个正在运行的 agent 出问题时会发生什么——不是应用代码里的 bug，而是一次运行期失败：用户想停掉一个轮次、某个工具调用需要在执行途中被打断、一次模型请求返回了传输层错误。DeepSeek Harness 把这些看作两个不同的问题，用两套不同的机制处理：

- **取消（cancellation）是刻意的**：某个主体（用户、父 agent、hook、dispose）决定某个轮次或工具调用应当停止。循环会与这个决定*协作*，而不是强行杀死正在进行的工作。
- **重试（retry）是自动的**：一次模型请求以某种「重试可能会成功」的方式失败了，某个插件决定是否透明地重试它，模型和用户都不会看到这次失败。

这两套机制都体现了贯穿整个代码库的同一条设计承诺：**永远不要放弃一份你无法证明已经停止的工作。** 被取消的轮次不会在它打断的工作真正停稳之前就返回「已取消」；被重试的请求也不会悄悄重复一次工具调用。这正是 [`docs/defensive-patterns.md`](../../../../deepseek-harness/docs/defensive-patterns.md) 里那条通用规则——「dispose 必须达到完全停稳，而不仅仅是请求停止」——被具体应用在轮次/步骤驱动器上的样子。

本章的后半部分转向另一个问题：既然失败总会发生，这个代码库究竟是如何从真正上线过的失败中吸取教训的？三篇真实的事故复盘展示了「防御性工程」在这里的具体样子——不是抽象的谨慎，而是针对一次具体事故写下的规则。

## 显式轮次取消

### 一个轮次，一个所有者，一个 signal

每个 agent 轮次（完整的轮次/步骤机制见[第 4 章](../s04-agent-loop/README.zh.md)）都运行在恰好一个 `AbortController` 之下，由循环私有持有，并在发布 `agent/status = running` 之前就安装好。这个控制器的 signal 贯穿轮次触及的每一个阶段：inbox 领取、`agent/pre-step`、提示词组装、每个步骤的模型请求与工具执行，以及 `agent/turn-stopping`。循环会在发布 `turn/end` 之前立即清除这个持有者，因此终止事件的观察者和随后的持久化 flush 都无法取消已经提交的工作——即便驱动器对外的状态要等到那次 flush 结束才会翻回 `idle`。

`Agent.cancel()` 是唯一的入口：

```ts type-equiv
cancel(cause: AgentCancelCause, options?: CancelOptions): void
```

```ts type-equiv
type AgentCancelCause =
  | { readonly kind: 'user' }
  | { readonly kind: 'parent' }
  | { readonly kind: 'hook'; readonly reason: string }
  | { readonly kind: 'disposed' }
```

这个 cause 是一个封闭的、由 TypeScript 强制的联合类型——不是自由格式的字符串。这是有意为之的选择：字符串原因会招致拼写漂移，也无法做穷尽式 `switch`，而运行时恰恰需要精确分类到底是谁请求了停止（`user`、发起本次轮次的 `parent` agent、带自己理由文本的 `hook`，还是 agent 自身的 `disposed`）。不带参数调用 `cancel()` 时，cause 默认为 `user`。`CancelOptions.keepInbox` 允许调用方在中止当前活跃轮次的同时，为后续轮次保留已排队和正在 steering 的 inbox 项——普通取消则会直接丢弃它们。

在空闲 agent 上调用 `cancel()` 是空操作：没有活跃的持有者可供中止，取消也不会为之后的工作预先武装。在轮次运行期间调用它会中止那个轮次的控制器——对活跃持有者而言先到者获胜，但之后的调用仍可以清空新排入队列的待处理工作。当前生效的 cause 会被复制进控制器的 `AbortSignal.reason`，并被冻结；一个 signal 本身不赋予后续观察它的代码任何分类权限，它只携带「已经触发」这一个事实。

### 哪些会被持久记录——哪些不会

一个被中断的存活轮次会以粗粒度的持久结果 `{ kind: 'aborted' }` 结束在它的 `turn/end` 事件里。这条记录刻意**不**携带四种 cause 中究竟是哪一种触发了它。理由在 [显式轮次取消 Agent Note](../../../../deepseek-harness/.agents/notes/implemented/architecture/2026-07-16-explicit-turn-cancellation.zh.md) 中被直接说明：

> 没有任何生产环境的回放、UI、ACP、遥测或 workflow 消费方需要区分 `user` 和 `parent`。把请求来源复制进终止结果会把两个事实混为一谈，还会为没有消费方的场景增加 Session 专属的校验逻辑。

这是「model-visible 即已记录」规则的另一面：终止事件记录的是*轮次发生了什么*（它被中止了），而*运行时*的 signal 标识的是*谁*请求了这次中止——两个不同的事实，只有第一个配得上进入持久历史。Session 的种子/加载逻辑会主动拒绝带有 reason 字段或任何其他额外字段的历史 aborted 记录，从根本上杜绝了通过回放重新引入调用方私有取消细节的可能。另有一个独立的、进程本地的 `agent/cancel-requested` 通知会在工作被清理之前携带已解析的 cause 触发——但它不是持久的，它是为存活观察者准备的，不是为日志准备的。

### 协作，而非抢占

循环会在每一个被 await 的边界前后检查 `signal.aborted`（通过 `throwIfAborted()`）——构建请求之前、每个流式分片之后、派发工具调用之前——但它从不用一个正在进行的 Promise 去和中止 signal 赛跑，从而提前放弃它。忽略 signal 的工作仍然必须在 `whenIdle()` resolve 之前、dispose 完成之前、循环上报「已停稳」之前完全结算完毕。

这是「异步状态不是同步状态」和「dispose 必须达到完全停稳」两条防御性规则的一次直接实践：`Promise.race` 式的提前放弃会让驱动器在被放弃的工作的副作用仍在落地——比如某个工具还在写文件，或者某个子进程还在运行——的时候就上报 `idle`。在 JavaScript 里赛跑本是一个现成的*选项*，而这个代码库对取消场景明确拒绝了它。这个取舍是真实的：不配合的同进程工作会拖慢一次取消真正生效可见的速度，但上报出来的「已停稳」状态始终是真实的。真正卡死的工作需要硬性终止，那是 worker 或进程隔离边界的职责——不在这个控制机制的范围内。

### signal 触达的范围

在一个轮次的生命周期内，每个参与其中的方法、事件和请求对象都携带同一个显式 signal——下一个轮次会拿到全新的一个。具体来说：`agent/pre-step`、`agent/request`、模型流式响应、`agent/request-error` 恢复逻辑、工具执行、审批、`agent/turn-stopping`、subagent/workflow 请求，都在各自的 payload 里携带 `signal: AbortSignal`。Hook 桥接接受 `RunHookOptions.signal`，因此取消一个轮次能一路触达 bash executor 的进程组 kill 与 join。`SystemPrompt.assemble()` 把 `signal?: AbortSignal` 作为普通可选字段接受，因为提示词组装也可能发生在任何轮次之外（例如冷渲染），那时根本没有 signal 可传。

`ctx.agents`（[发起者作用域](../s16-subagent-seam/README.zh.md)）始终只携带发起本次操作的那个 `Agent`——从不携带轮次或取消 signal。这是设计笔记明确点出的边界：如果把轮次生命周期的状态加进驱动器生命周期的环境上下文里，会让一个陈旧的异步后代看起来仍然对*之后*的某个轮次保有权限。因此取消只有一个所有者，并且只通过显式参数传递，从不通过环境查找。

## 协作式工具取消

轮次取消停止的是循环本身；工具取消是下一层对应的机制，作用在[第 6 章](../s06-tool-pipeline-and-prompt/README.zh.md)所描述的工具注册表边界上。同样的「请求停止而非杀死」哲学在这里适用，并带有它自己的类型层保证。

### signal 是必需的，不是可选的

```ts type-equiv
interface ToolExecutionInput {
  readonly signal: AbortSignal
  // ...
}
```

`ToolExecutionInput.signal`、`ToolExecution.signal` 和 `ToolRunContext.signal` 都是必需、只读的 `AbortSignal` 字段——不是 `signal?: AbortSignal`。`defineTool()` 把每个注册工具的 `exec.signal` 类型化为必需字段，因此工具体无需类型断言或空值检查就能观察或转发取消。注册表不提供任何重载、默认控制器、永不中止的哨兵值，也不提供任何可以省略它的便捷调用路径。每个调用方都必须提供它真正拥有的那个 signal。

这体现了贯穿整个代码库的「显式优于隐式」惯例：可选的 signal 会允许某个调用方悄悄跳过取消机制，而注册表也无法合成一个代表它并不拥有的生命周期的兜底 signal。在类型层面把它设为必需，把「这个工具从未被正确取消过」这一类 bug 从运行时意外变成了编译期错误。

### 可变性跟随流水线阶段

并不是工具调用的每一个参与者都需要——或者应该拥有——*修改* signal 的权力。`ToolDispatchExecution`（仅供 `tools/execute` waterfall 使用）是唯一一个 `signal` 可变的类型；其余每个阶段——前置策略、后置策略、结果观察者，以及工具实现本身——拿到的都是只读视图。一个环绕式（around-dispatch）包装器可以在自己委托出去的生命周期内临时*替换* `exec.signal`（比如加一个截止时间），但不能删除它或把它设为 `undefined`；注册表会在工具体真正运行之前，把每一次包装器替换与原始调用方 signal 融合起来，并在包装器的作用域结束后无条件恢复上游 signal。这让「截止时间」式的组合得以存在，同时工具体永远不会在完全没有取消路径的情况下运行。

### 两种取消 code，因为「是否已经运行过」很重要

一次工具调用可能在好几个不同的时间点被取消：任何策略检查之前、审批期间、环绕式派发的等待过程中、工具体已经开始执行之后，或者后置策略仍在等待一个已经完成的工具体时。一个不加区分的「已中止」结果无法告诉持久消费方，这次工具调用的副作用是否已经可能发生过。因此 `dsh-tools` 导出了两个不同的 code：

- **`TOOL_ABORTED_BEFORE_DISPATCH`**——取消发生在工具体被调用之前，工具体从未被触发。模型可见文本：`Error: tool call aborted before dispatch`。
- **`TOOL_ABORTED`**——取消发生在工具体已经被调用*之后*（例如一个环绕式包装器或后置策略监听器正在等待一个已经在运行的调用）。模型可见文本：`Error: tool call aborted`。

注册表会精确标记它调用 `ToolDefinition.execute()` 的那个确切时刻，因此这个区分是精确的，不是猜测。拒绝、包装器失败或工具本身的失败，始终比这两种通用取消 code 更具体；由超时策略拥有的超时也始终保留自己的 `TOOL_TIMEOUT`——取消 code 从不会掩盖一个更具体的失败。

正是这个区分，解释了 agent loop 里的 `appendSkippedToolCall()`（位于 `packages/core/agent-loop/src/tool-calls.ts`）为什么会为一个轮次在批量调用中途被取消时、被放弃的每一个兄弟工具调用写下 `'Error: tool call aborted before dispatch'`——按构造，这些调用从未到达工具体：

```ts
// packages/core/agent-loop/src/tool-calls.ts:248-259
function appendSkippedToolCall(session: Session, turn: number, step: number, block: ToolCallBlock): void {
  const callSeq = appendToolCall(session, turn, step, block)
  appendToolResult(session, turn, step, block, {
    content: [{ type: 'text', text: 'Error: tool call aborted before dispatch' }],
    isError: true,
    error: {
      message: 'tool call aborted before dispatch',
      info: { name: 'AbortError', code: TOOL_ABORTED_BEFORE_DISPATCH },
    },
  }, callSeq)
}
```

注意这里的形状：每一个被放弃的调用仍然会得到一对持久的 `tool/call` + `tool/result`，从不留下一个静默的空洞。如果一条模型消息请求了五次工具调用，日志里永远会看到五对配对的结果——无论它们是真正运行了、被取消跳过了，还是彻底失败了。这正是保持回放确定性的关键：从日志重建历史的消费方永远不需要去猜「缺失的结果」到底意味着「仍在进行中」还是「丢失了」。

### 一旦工具体开始运行，注册表就会等它

和轮次取消完全一样，一旦某个工具的 `execute()` 真正被调用，注册表会把它等到彻底完成，而不是拿它和中止 signal 赛跑。一个协作式的工具实现会观察自己的 `exec.signal` 并停止（或者把取消转发给它调用的任何子进程或能力），然后完成结算；一个不配合的实现如果忽略这个 signal，就会让注册表——进而让整个轮次——一直挂起。这仍然是「dispose 必须达到完全停稳」这条防御性规则在另一层的体现：[协作式工具取消 Agent Note](../../../../deepseek-harness/.agents/notes/implemented/architecture/2026-07-19-cooperative-tool-cancellation.zh.md) 明确拒绝了赛跑 Promise 的方案，并直接引用了这条规则。

## 重试：agent/request-error

取消是关于刻意停止工作；`agent/request-error` 处理的是相反的情形：一次模型请求自己失败了，某个东西决定是否要再试一次。

### 这个 waterfall

在 `ReactLoopAgent.step()` 内部，模型请求跑在一个内层的 `while (true)` 循环里，专门是为了让一次失败的请求可以在不离开这个步骤的前提下重试：

```ts
// packages/core/agent-loop/src/agent.ts:339-371
while (true) {
  const { request, preparedCall } = await this.buildRequest(/* ... */)
  const stream = preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request)
  for await (const chunk of stream) {
    chunkSeqs.push(this.session.append('assistant/chunk', { turn, step, chunk }).seq)
    assembler.push(chunk)
  }
  const finish = assembler.finish
  if (finish.kind === 'error' || finish.kind === 'aborted') {
    const action = await this.dispatch.waterfall(
      'agent/request-error',
      { turn, step, provider: request.provider, failure: finish.failure, retryPolicy: preparedCall?.retryPolicy, signal },
      () => Promise.resolve<RequestErrorAction>(undefined),
    )
    if (action?.kind !== 'retry') {
      throw new LlmError(finish.failure.message, finish.failure.code, finish.failure)
    }
    continue   // 回到循环顶部：重建并重新发送请求
  }
  // ...成功路径：追加 assistant/message，派发工具调用
}
```

`agent/request-error` 会在一次模型流式尝试以 `error` 或 `aborted` 结束之后触发——此时失败的步骤已经关闭，但轮次本身尚未关闭，轮次的取消 signal 依然存活，因此一个恢复监听器仍然可以与正在进行的取消协作。它是一个只有两种可能结果的 waterfall：

```ts type-equiv
type RequestErrorAction = { kind: 'retry' } | undefined
```

想要自己接管恢复的监听器会返回 `{ kind: 'retry' }`，并且**不**调用 `next()`——这会让 waterfall 短路，把控制权直接送回 `while` 循环顶部的 `continue`，从同一份持久历史重建请求并重新发起一次全新的 provider 调用。不想处理这次失败的监听器会调用 `next()` 委托给链条上的下一个。当没有任何监听器介入时，默认的终端处理器会返回 `undefined`，循环把这当作终态处理：抛出一个 `LlmError`，一路向上传播，同时关闭这个步骤和这个轮次，结果为 `error`。

每一次重试都会在同一个轮次内开启一个**新的步骤**——不是日志里看不见的隐藏内层循环。失败尝试的 `step/end` 已经是持久的；重试的请求作为轮次的一次普通延续运行，一旦成功，在日志里和任何其他多步骤轮次没有区别。

### `dsh-llm-retry`：一个具体的监听器长什么样

harness 提供了一个真实的 `agent/request-error` 消费方——`@deepseek-ai/dsh-llm-retry`，它是一个普通的函数插件，不是循环里的特例逻辑。它从服务这次失败请求的那个适配器注册中读取 `retryPolicy`（在注册时就已捕获，因此后续路由的释放或替换不会改变一次正在进行的失败所使用的恢复策略），并提供两种模式：

- **normal 模式**（提供方没有配置 `retryPolicy` 时的默认值）：对 `EMPTY_RESPONSE`、`RATE_LIMIT`、`SERVER`、`TIMEOUT`、`TRANSPORT` 最多重试两次，退避策略是从 500 毫秒到 10 秒的有界指数退避加 10% jitter。`EMPTY_RESPONSE`——一个没有产生任何持久内容的退化 provider 完成——之所以被纳入，是因为按构造重复它是安全的：什么都没有被提交过。
- **always 模式**：先请求下游恢复逻辑处理，然后无次数上限地重试*每一种*模型请求失败——包括身份验证错误或无效请求这类永久性失败——直到成功、取消或插件 dispose 为止。

在等待退避之前，插件会追加一条不进入表层的 `llm/retry` 事件，携带失败信息、计划延迟和一个 `retryId`；等待结束时，它会在返回 `{ kind: 'retry' }` 之前立即追加带有相同 id 的 `llm/retry-started`——如果退避期间发生取消，则不会写入 `started` 事件。这个拆分之所以重要，是因为它让「一次重试被调度了」和「一次重试真正开始了」成为两个可以独立观察的持久事实，这正是「正交结果独立上报」这条防御性规则的又一次体现：检视日志的调用方能够分辨出「已调度但被取消的重试」和「真正跑起来的重试」。

从模型的视角看，这一切都不存在。没有任何重试事件、延迟、provider 错误或失败的部分输出是模型可见的——重试请求会从持久历史中重建同一个显式的 provider/model 调用，因此一次成功的重试，从对话内部看，和一次第一次尝试就成功的请求没有区别。这是「model-visible 即已记录」这条边界规则反过来发挥作用的例子：重试机制是真实且持久的，但它从不跨越到会被渲染为对话历史的那一侧。

## 防御性模式：源自真实 bug 的规则

`docs/defensive-patterns.md` 篇幅刻意很短——六条规则，每一条都能追溯到一个在这个代码库里真正上线过或者差点上线的缺陷。在动手写生命周期、并发、子进程或清理代码之前，先读它。上面两套机制里已经用到了其中两条规则：

- **异步状态不是同步状态。** `agent/status` 或 `whenIdle()` 从来不是某一条特定消息的结果：多条已排队的后续消息、steering、注入的工作可能共用同一个 `running` 区间，取消或 dispose 可能丢弃尚未开始的项。一个真正需要把某个结果归因于某条特定消息的调用方，必须显式定义自己的区间（比如，从那条消息的持久 inbox 回执，到整个 agent 下一次进入 `idle`），并把观察到的任何输出描述为整个区间的输出，而不是那条特定消息导致的。
- **dispose 必须达到完全停稳，而不仅仅是请求停止。** 前文已经涉及：一次只发出中止信号就返回、不等待被中止的工作真正停下来的清理流程会留下孤儿。清理逻辑要等待子工作退出——先发出终止信号，再 await `done`。

另外四条同样具体：

- **正交结果独立上报。** 一个进程可能同时超时*并且*以退出码 0 结束，因为它捕获了终止信号。`timedOut`、`signal`、`exitCode` 是三个独立的事实；把一个嵌套进另一个的分支里，会让调用方把一次提前终止的运行误判为干净的成功。
- **公共约定两侧都要遵守。** 当一个实现可能以好几种不同形式收到同一个结果（一次抛出的异常，或者一个结构化的 `finish {kind:'error'}` 分片）时，应在跨越公共 API 边界之前就把它规范化，这样消费方就不必猜测捕获到的异常究竟来自 provider、某个包装层，还是自己的组装代码。
- **在分发器中隔离回调异常。** 用户提供的监听器如果抛出异常，不得让它所在的 promise 被 reject，也不得饿死排在它后面的监听器。用 try/catch 包裹分发循环；一个行为不当的订阅者绝不能破坏核心生命周期。
- **绝不将环境变量或可预测路径暴露给不可信输出**，以及**用 `lstatSync` + `unlinkSync` 删除链接形态的路径，而不是递归的 `rmSync`。** 这两条都是子进程/文件系统场景下同一个理念的具体化：不要让一个组件的清理或输出通道变成另一个组件的攻击面。

## 三篇事故复盘：真实坏掉的是什么

在这个仓库里，事故复盘不是一个设计决策——它是对一次失败的回顾性记录：什么坏了、机制是什么、为什么每道安全网都没拦住、以及为此新增了哪些具体防护措施，让同类 bug 下次出现时会明确报错。现存的四篇里有三篇格外有启发性，因为它们的机制隐蔽、逃逸的原因是系统性的（测试或约定的缺口，而非一次性笔误），并且这个修复方案能推广到这个代码库之外。

### 事故复盘 0001——一行多余的 `export default` 悄悄丢弃了插件的 `inject`

ACP 服务器在真实编辑器连接的瞬间崩溃：`session/new` 报错 `cannot get property "agents" without inject`，尽管有 178 个绿色单元测试和 100% 行覆盖率。这个插件的源文件本是一个普通的*命名空间插件*——为 `name`、`inject`、`Config`、`apply` 分别使用独立的命名导出——但它多了一行仓库里其他任何插件都没有的代码：`export default apply`。

Cordis 的 Loader 通过 `unwrapExports` 规范化一个被导入的模块，这个函数在默认导出存在时会优先使用它：`exports.default ?? exports`。有了默认导出，这个表达式解析出来的就是*裸露的 `apply` 函数*——一个函数没有 `inject`、没有 `name`、没有 `Config`；这些原本作为模块命名空间上的兄弟命名导出存在，而 unwrap 到 `.default` 就把整个命名空间扔掉了。`apply` 随后运行在一个没有任何注入服务的 fiber 里，第一行代码（`const agents = ctx.agents`）在遍历一棵什么都没授予的 fiber 树时就直接抛错。

所有测试都没能捕获这个问题，因为所有测试都是手动挂载插件——`ctx.plugin({ name, inject, apply })`——这种方式手动提供了 `inject`，因此永远不可能触发 `unwrapExports`，因为这个函数只会被真正的 Loader 调用，从不会被 `ctx.plugin` 调用。100% 的行覆盖率全程都是满足的；覆盖率证明的是代码行*跑过了*，不是这个功能*按照它上线的方式*真的能用。

**修复：** 删掉那行多余的 `export default`。**防护措施：** 一个无需 API key 的 `session/new` 端到端测试现在会以子进程方式、通过真正的 Loader 启动真实的示例，并在这个确切的错误重新出现时明确报错——已通过重新引入这个 bug 并观察它失败来验证。这次事故催生的通用规则现在是硬性约定：*「服务类的包默认导出它的服务类；函数插件命名导出 `name`/`inject`/`Config`/`apply`，不带默认导出。混用这两种形式会让 Loader 丢弃函数插件的命名空间。」*

### 事故复盘 0002——一个字面量 `!!js` 对象永久禁用了文件系统工具

某个 ACP 示例组合希望文件系统工具（`read`、`write`、`edit`）只在特定启动模式下启用，于是在插件的 Loader entry 上写了 `disabled: !!js <表达式>`，期望 Cordis 求值这个表达式来有条件地控制这条 entry。但它从未如愿：Cordis 的 `!!js` 标签只会在插件的 `config` 字段内部被插值——`Entry._resolveConfig()` 专门遍历并求值这个字段，而 `Entry.disabled` 直接读取 `entry.options.disabled`，完全没有插值这一步。这段 YAML 语法上是合法的，所以加载过程不会产生任何错误或警告；每一条文件系统 entry 看到的都是一个本该是布尔值的位置上坐着一个真值的 JavaScript 表达式对象，于是在任何模式下都保持禁用。

七个文件系统场景和一个混合工作区编辑场景，最终都调用了注册表里根本不存在的工具——`ToolNotFoundError`，code 为 `UNKNOWN_TOOL`——而快照测试套件照样通过了，因为*通用的失败工具卡片*本身渲染是确定性的，快照刷新流程直接把这次失败记录成了新的预期输出。这个套件证明的是回归的确定性可回放，而不是行为正确。

**修复：** 文件系统场景现在启动一个显式、固定的完全访问 overlay 配置（`fs.cordis.yml`），而不是运行时条件表达式。**防护措施：** `verify-cordis-config` 现在会静态解析仓库里的 Cordis YAML，拒绝 Loader entry 元数据（不只是 `config`）中出现的任何表达式节点；快照工具本身也会拒绝把结构化的 `UNKNOWN_TOOL` 结果提交为预期输出——无论是在新跑一次的结果里，还是在已提交的会话日志里。这里的通用教训是：快照刷新是生产 fixture，不是正确性审查——一个缺失的已注册工具是一种语义上的不可能，需要自己独立的断言，不能依赖「转录是否能确定性回放」来把关。

### 事故复盘 0004——共享的 stderr 前缀让一个沙箱化子进程自身的退出码被误判为沙箱失败

原生 Landlock 启动器在使用较旧 Landlock ABI 的内核上会打印恰好一行无害的通知——`landlock-run: partial enforcement (older Landlock ABI)`——然后正常继续执行子进程。相对地，*启动器失败*会打印另一行带 `landlock-run:` 前缀的不同内容，并以退出码 125 结束、根本不会执行子进程。而这个 harness 的分类逻辑把这两种情况合并成了同一个判断：任何非零退出码，只要 stderr 中出现子字符串 `landlock-run: `，就被判定为启动器失败。

这意味着一个完全成功、被完整沙箱化的子进程，仅仅因为它出于自身完全正常的原因返回了非零退出码，就可能被误报为沙箱崩溃。ripgrep 用退出码 1 表示「运行正常，只是没找到匹配项」——一个完全正常的结果——但在部分 ABI 的内核上，这个退出码和已经被打印到 stderr 上的无害「部分强制执行」通知放在一起，就足以触发 `SANDBOX_UNAVAILABLE`。事故发生时还存在一个独立的第二个 bug，加重了后果：当时以 bash 为后端的文件系统搜索会捕获每一个非中止的 bash 拒绝，并把它替换成一个通用的 `SEARCH_FAILED`，从而丢弃了调用方原本需要用来真正诊断一次真实沙箱失败的结构化 `SandboxUnavailableError`。

测试覆盖之所以没能发现这个问题，是因为测试套件里的假沙箱 provider 要么完全不产生任何 runner 输出行，要么产生一行毫不含糊的致命行——从来没有产生过「一行无害的 runner 通知，紧跟着一个由子进程自己决定的非零退出码」这种组合；而真实内核测试在没有可用 Landlock 内核的宿主上会自我跳过，因此触发这个 bug 所需的确切 ABI 条件在大多数 CI 宿主上根本没有被测试到。

**修复：** 沙箱结果类型现在表达的是一个真正的证据合取，而不是一堆子字符串的集合——一个 `RunnerFailureRule` 携带允许的退出码、逐行的致命特征、以及*精确*（而不是子字符串）的信息性行排除规则，因此判定启动器失败需要同时满足匹配的退出码和一行明确无误的致命信息，不能仅凭「包含这个前缀」。文件系统搜索也被完全移出了沙箱化的 bash 路径，直接改为通过 subprocess 能力使用打包的 ripgrep。**防护措施：** 原生边界上现在有一个确定性的 fake，专门复现「先是信息性通知，然后子进程非零退出」这个场景，再加上一个把这个确切场景端到端固定下来的组合快照，不依赖真实内核是否可用。这里的通用教训是：进程归因需要一个独立证据的合取，而不是一个共享的字符串前缀——一个会自我跳过的真实内核测试永远无法单独承载一个回归用例；它需要一个能在任何宿主上运行的确定性 fake 来配合。

## 贯穿始终的主线

上面三篇事故复盘，以及本章前半部分的两套取消机制，都收敛到同样几个想法上：

- **一个结果从来不是单一事实，要把每一个独立事实分别上报**——退出码和信号、启动器失败和子进程自身的退出、已调度的重试和已开始的重试、派发前中止的工具调用和派发后中止的工具调用。
- **覆盖率和通过的测试只能证明代码跑过了，不能证明上线的行为是正确的**——能捕获事故复盘 0001 或 0002 的唯一测试，是那种真正走通*真实* Loader 路径、或者断言一个*语义上不可能*的情形的测试，而不是那种手动搭建被测对象的测试。
- **对任何真正拥有实际副作用的工作而言，协作胜过强制。** 轮次和工具调用总是被「请求停止」并被「等到停稳」，从不被拿去赛跑然后放弃——因为一个在副作用还在飞行中时就上报「已完成」的调用方，无法被信任来做出它的下一个决定。

`docs/defensive-patterns.md` 里的规则和本章的这些事故复盘，不是事后补上去的检查清单——它们是若干具体事故的直接产物，每一条现在都由一个具体的测试、一次静态检查，或者一个让旧错误再也写不出来的类型来强制执行。
