---
id: s05
slug: s05-agent-interface
title: "Agent 接口与注册表"
summary: "循环无关的 Agent 契约、AgentRegistry 工厂模式，以及进程本地的发起方作用域"
module: foundations
order: 5
sources:
  - path: packages/core/agent/README.zh.md
    label: "dsh-agent README"
  - path: packages/core/agent/src/runtime-types.ts
    lineStart: 24
    lineEnd: 144
    label: "AgentOptions、AgentStatus、Agent 接口"
  - path: packages/core/agent/src/index.ts
    lineStart: 172
    lineEnd: 214
    label: "AgentHandle、AgentFactory"
  - path: packages/core/agent/src/index.ts
    lineStart: 256
    lineEnd: 298
    label: "AgentRegistry 字段与构造函数"
  - path: packages/core/agent/src/index.ts
    lineStart: 300
    lineEnd: 388
    label: "currentInitiator/requireInitiator/withInitiator/withoutInitiator、setFactory"
  - path: packages/core/agent/src/index.ts
    lineStart: 405
    lineEnd: 457
    label: "create、resume、register"
  - path: packages/core/agent/src/index.ts
    lineStart: 474
    lineEnd: 577
    label: "enter/detachEntered/announce 的有序发布"
  - path: packages/core/agent/src/index.ts
    lineStart: 640
    lineEnd: 670
    label: "runWithInitiator（AsyncLocalStorage 边界 + drain 跟踪）"
  - path: packages/core/agent/src/dispatch.ts
    label: "agentEvents 融合分发器与 assembleContextFor"
  - path: packages/core/agent/src/inbox.ts
    label: "agent/inbox/spliced 的 Inbox 投影"
  - path: packages/core/agent/src/model-selection.ts
    label: "installModelSelection"
  - path: packages/core/agent/src/consumed-work.ts
    label: "foldConsumedWork"
  - path: .agents/notes/implemented/architecture/2026-07-15-agent-initiator-scope.zh.md
    label: "Agent Note：基于 AsyncLocalStorage 的发起 Agent 作用域"
  - path: packages/core/agent-loop/src/agent.ts
    lineStart: 182
    lineEnd: 191
    label: "wakeDriver() 用 withInitiator(this, ...) 包裹 kick()"
  - path: packages/core/agent-loop/src/index.ts
    lineStart: 296
    lineEnd: 350
    label: "AgentLoop 实现 AgentFactory，通过 setFactory 注册"
  - path: docs/architecture.zh.md
    lineStart: 43
    lineEnd: 51
    label: "核心包表格：core/agent 与 core/agent-loop"
---

## 为什么这个包要和循环分开存在

上一章讲的是 `AgentLoop`——那个认领 inbox 输入、开启轮次、驱动模型步骤、分派工具的具体状态机。`AgentLoop` 只是一种*实现*。`packages/core/agent`（`@deepseek-ai/dsh-agent`）才是所有其他插件真正面向编程的*接口*：`Agent` 类型、挂在 `ctx.agents` 上的 `AgentRegistry` 服务，以及 `agent/*` 事件词汇表。它对 `agent-loop` 没有任何依赖。

这种拆分不是偶然的分层,而正是设计的核心。[架构文档的核心包表格](../../../../docs/architecture.zh.md)把二者列为两个独立的条目,是有原因的:

| 包 | 职责 | `ctx` 键 |
|---|---|---|
| `core/agent` | `Agent` 接口、活跃 agent 注册表和 `agent/*` 事件 | `ctx.agents` |
| `core/agent-loop` | 实现该接口的默认驱动器 | `ctx.agentLoop` |

一个 UI 层、ACP 桥接层、某个钩子,或者想要发消息、取消运行、观察状态变化的编排器,只需要 import `dsh-agent` 并调用 `ctx.agents.get(id)`。这些代码完全不需要知道某个 id 背后的 agent 究竟是由 `AgentLoop` 驱动、由测试替身驱动,还是由未来某种别的驱动器驱动——只要那个替代实现满足 `Agent` 接口,并通过 `ctx.agents.register()` 完成注册即可。[包 README](../../../../packages/core/agent/README.zh.md) 把这一点说得很直白:"每个插件(UI、钩子、编排器)都面向此处定义的 `Agent` handle 编程;它不依赖循环,因此循环可以替换。"

本章覆盖 `dsh-agent` 提供、`agent-loop` 在其之上构建的四样东西:`Agent` 接口契约、`AgentRegistry` 的生命周期(register/enter/announce,以及基于工厂的 create/resume 路径)、进程本地的发起方作用域(`withInitiator()`/`currentInitiator()`),以及 `AgentHandle` 的所有权模型。

## `Agent` 接口

`Agent`(定义在 `packages/core/agent/src/runtime-types.ts:64-144`)是一份纯粹的对象契约——没有 class,没有对循环的耦合:

```ts
export interface Agent {
  readonly id: SessionId
  readonly options: AgentOptions
  readonly session: Session
  readonly inbox: Inbox
  readonly status: AgentStatus
  readonly ctx: Context

  cancel(cause: AgentCancelCause, options?: CancelOptions): void
  whenIdle(): Promise<void>
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>
  send(message: UserMessage, target: InboxTarget, wakeup: boolean): void
  followup(message: UserMessage): void
  steer(message: UserMessage): void
  inject(message: UserMessage): void
}
```

这份契约里有几点值得留意——不管是它包含了什么,还是它刻意没有包含什么:

- **`id` 与 `session.id` 共用同一个值。** agent 和它的 session 是同一个身份;进程中任意时刻,一个 agent 恰好对应一个存活的 session,反之亦然。`AgentRegistry.enter()`(`index.ts:474-478`)在插入时就强制检查这一点,若 `agent.id !== agent.session.id` 会直接抛出。
- **`status` 只有两种取值:`'idle' | 'running'`。** dispose 不是第三种状态——一个已经被 teardown 的 agent 只是不再出现在注册表里而已。
- **`ctx` 是 agent 自己的、带作用域的 Cordis context。** 任何通过 `agent.ctx` 注册的东西——工具、提示词片段、监听器——都只对这一个 agent 生效,并在该 agent dispose 时自动全部撤销。这正是上一章讨论循环时提到的 `dsh-scope` 机制;`dsh-agent` 是它的两个消费方之一(另一个是 `system-prompt`)。
- **喂入输入有四种方式**,唤醒/排队语义各不相同:`send()` 是通用原语(显式指定 `target` 和 `wakeup`),`followup()` 和 `steer()` 是固定预设的别名(分别对应 `next-turn`/唤醒 和 `next-step`/唤醒),`inject()` 则排队一条不唤醒的 `next-step` 上下文——适合注入那些应该搭上"下一次不管怎样都会发生的步骤"的模型可见材料,而不强行触发一次新的步骤。
- **`cancel()` 和 `whenIdle()` 描述的是整个 agent 的活动状态**,而不是某一条消息的命运。`followup()` 不返回任何完成 handle——拿到的消息 id 只标识 inbox 插入、认领和丢弃这几个会话日志事实,而不指向后续的某个 `turn/end`。如果需要知道被消费的输入最终发生了什么,那是另一次独立的读取(见下文的 `foldConsumedWork`)。

`cancel`、`whenIdle`、`send` 等等方法里,没有任何一处提到轮次/步骤机器、具体的模型调用流程,或者 `AgentLoop` 本身。任何满足这份接口的对象——包括手写的测试替身——都是合法的 `Agent`。

## `AgentRegistry`(`ctx.agents`)

`AgentRegistry extends Service`(`index.ts:256`)是进程中所有存活 `Agent` 的实时目录,同时也是下文发起方作用域机制的载体。它对外的查询面很小、且是同步的:

- `get(id: SessionId): Agent | undefined`
- `list(): Agent[]`——所有存活 agent,按注册顺序
- `roots(): Agent[]`——没有所属 agent context 的存活 agent(一个恢复出来的 fork 会话仍可能是运行时的根;这里的"所属"是一个存活期的关系,与持久会话谱系无关)
- `isOwnedBy(id, owner): boolean`——`id` 对应的*那个确切存活条目*是否是通过 `owner` 的作用域 context 创建的

### 把 agent 送进注册表的两条路径

**`register(agent)`**(`index.ts:450-457`)是普通路径:把一个已经构造完成的 `Agent` 交给它,它就会记录下来、恰好发出一次 `agent/created`,并在调用方所在的 fiber 卸载时 dispose(同时发出 `agent/disposed`)。任何不是 `AgentLoop` 的自定义驱动器都直接走这条路。

**`enter()` + `announce()`**(`index.ts:474-509`、`549-576`)是更底层的有序生命周期原语,`register()` 本身就是用它拼出来的;异步创建工厂(见下文)之所以要用它,是因为创建过程需要在 agent 对任何人可见*之前*先完成一些工作——等待 `setup()`。`enter()` 执行权威的 id 冲突检查,并在不发出通知的情况下插入条目;`announce()` 稍后恰好发出一次 `agent/created`。之所以要把两者拆开,是因为 `agent/created` 的某个监听器可能会同步请求 dispose("detach")——注册表会把这个 detach 推迟到 `announce()` 的分发完全展开之后才真正执行(`index.ts:494-506` 和 `559-575` 里的 `entry.announcing`/`entry.detachRequested` 处理),这样一来,同一次分发触及到的每个监听器都能观察到同一个稳定的条目,而一个过期的 detach 闭包也绝不可能删掉后来复用同一个 id 的新条目。

### 工厂模式:创建逻辑留在接口之外

`AgentRegistry` 并不知道怎么构造一个 `Agent`——它只知道怎么注册一个。构造被委托给任何实现了 `AgentFactory` 的插件:

```ts
// packages/core/agent/src/index.ts:183-214
export interface AgentFactory {
  createAgent(ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle>
  resume(ownerCtx: Context, options: ResumeAgentOptions): Promise<AgentHandle>
}
```

`AgentLoop` 是目前唯一的具体实现方(`packages/core/agent-loop/src/index.ts:296`,`class AgentLoop extends Service implements AgentFactory`),它通过 `ctx.effect(() => ctx.agents.setFactory(this), 'agentLoop.setFactory()')`(`index.ts:350`)把自己注册进去。`setFactory()`(`packages/core/agent/src/index.ts:372-388`)如果检测到第二个工厂尝试注册就会抛出——进程中只能有一个工厂——并在 dispose 时清空这个槽位。

`ctx.agents.create(options)` 和 `ctx.agents.resume(options)`(`index.ts:405-430`)是很薄的转发层:它们把已注册的工厂重新通过调用方自己的 context 做 trace(这样一来,工厂注册的各种 effect 会挂在*调用方*所在的 fiber 上,而不是工厂自己的 fiber 上),然后调用 `target.createAgent(ownerCtx, options)` / `target.resume(ownerCtx, options)`。如果没有注册任何工厂,两者都会以 `no agent factory registered (load an agent-loop plugin)` 拒绝。

这层间接正是接口/实现拆分带来的收益:ACP 桥接层、进程内 subagent 后端,以及任何其他想要启动一个 agent 的消费方,都只需要调用 `ctx.agents.create()`——它们从不 import `dsh-agent-loop`。换一个不同的 `AgentFactory`,上述每一处调用点都能原样继续工作。

`CreateAgentOptions.setup(agentCtx)` 和 `ResumeAgentOptions.setup(agentCtx)` 是在 session 和 agent 都对外可见*之前*组合一个 agent 的作用域世界(工具、提示词片段、监听器)的钩子——所有通过 `agentCtx` 注册的东西,都先于 `agent/created`、`agent/session-start` 和第一次提示词组装存在。setup 是受信任的、只负责组合的同进程代码:它绝不能开始驱动这个 agent,只能负责把它组装起来。setup 期间的拒绝、抛出的同步提交,或者 owner 的 dispose,都会把整个事务完整回滚,两个 id 都不会被发布。

## `AgentHandle`:一种 dispose 能力,而不是查询结果

```ts
// packages/core/agent/src/index.ts:172-175
export interface AgentHandle {
  agent: Agent
  dispose(): Promise<void>
}
```

包 README 明确指出 `dispose()` 是"一种**消费方能力**——仅持有裸注册表条目的观察方无法 teardown 这个 agent"。任何人通过 `ctx.agents.get(id)` 查到的仍然是裸 `Agent`;只有从 `create()`/`resume()` 拿到 `AgentHandle` 的那个调用方才握有 disposer。调用方所在的 fiber 和已注册的工厂提供方是*结构上的共同拥有者*:普通的调用方 fiber 卸载会通过正常的 Cordis 所有权关系触发 dispose,而工厂卸载则必须独立地停止它创建的每一个存活实例,因为这个 agent 作用域内的依赖面(工具、通过工厂 context 解析出的各种 provider)归属于那个 provider。不管从哪条路径调用 `dispose()`,最终都会汇聚到同一个被记忆化的完全停稳边界:停止循环、等待其退出、从注册表移除该 agent、从存储中删除对应会话、撤销其作用域世界。

配置创建的 agent——即 `AgentLoop` 直接从其 `cordis.yml` 的 `agents:` 条目启动的那些——归属于循环所在的 fiber,根本不需要一个单独的 handle;不存在另一个等着去 dispose 它们的消费方。

## `withInitiator()` / `currentInitiator()`:显式参数之下的身份

这是这个包里最微妙的一部分,它解决的是一个真实但很窄的问题,[对应的 Agent Note](../../../../.agents/notes/implemented/architecture/2026-07-15-agent-initiator-scope.zh.md) 有完整记录。

### 要解决的问题

Cordis 的 `Context` 已经回答了"谁能看见这个服务、是谁注册的它"。`agent.ctx` 已经回答了"哪些东西作用域绑定在这一个存活 agent 上"。但二者都没有回答第三个、完全不同的问题:*作为一个值*,当前这条正在执行的异步调用链,其主体究竟是哪一个 `Agent`?某个宿主感知的传输层、追踪辅助函数,或者深埋在库代码里的日志器——远在循环之下、远在任何工具调用之下——有时候确实需要合理地知道"这是谁引发的",而不需要让中间经过的每一个函数签名都为了这一个目的去显式转发一个 `agent: Agent` 参数。

三种看起来诱人的替代方案,各自都有明确的错误之处:

- **无论如何都显式转发 `Agent`。** 在显式边界(服务调用、worker/进程/wire 消息、持久化记录)这样做是正确的——这些地方也确实继续这样做——但要求驱动器*之下*的每一个私有辅助函数都携带它,只是重复的转发,却没有带来任何可信度上的好处,因为那已经是同进程代码了。
- **进程级的可变全局槽。** 并发的 agent(比如一个父 agent 正在驱动一个被委托的 subagent)会在跨 `await` 边界时相互覆盖;没有任何串行化保证能让一个裸的全局变量在这种场景下保持安全。
- **从模型可见的参数中推导。** 模型绝不能被信任去自行选择它自己的会话身份或路由。

### 机制

`AgentRegistry` 用一个 Node `AsyncLocalStorage<Agent | undefined>`(`index.ts:259`,字段名 `initiators`)携带发起 `Agent`。它直接存储 `Agent` 值本身——没有额外字段的包装帧——因为轮次、步骤、`signal`、`cwd`、沙箱和授权都已经各自有权威的归属方了;给携带的帧再加字段只会制造出别处已经正确跟踪的状态的陈旧副本。

四个操作(`index.ts:309-358`):

- **`currentInitiator(): Agent | undefined`**——可选读取;用于日志、追踪,或者那些必须也能容忍无 agent 调用的宿主归因场景。
- **`requireInitiator(): Agent`**——如果没有继承到任何值就抛出 `no initiating agent is active`。用于那些契约上必然处于某个驱动器之下的私有辅助函数。
- **`withInitiator(agent, operation)`**——以 `agent` 作为环境发起方运行 `operation`,并保留 `operation` 返回的确切同步值或 Promise 身份。
- **`withoutInitiator(operation)`**——建立一个*清空*边界,使得延迟初始化的共享基础设施(定时器、队列泵、连接池)不会意外继承第一次触发它初始化的那个 agent。

`AgentLoop` 是生产代码里唯一调用 `withInitiator` 的地方。`wakeDriver()` 把整个每次唤醒的驱动器调用包裹起来:

```ts
// packages/core/agent-loop/src/agent.ts:191
this.loopCtx.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject)
```

循环内部每一个包私有的编排入口——轮次调度、步骤调度、工具调用分派——都通过 `ctx.agents.currentInitiator()`/`requireInitiator()` 恢复出确切的 `Agent`,一次性推导出 `agent.session`,让操作内部的辅助函数直接闭包捕获这个值,而不是把具体的驱动器实例或裸 `Session` 通过浅层接口一路转发下去。深层的、横切的基础设施因此获得了一个可信的"这是为谁做的",而调用链上的中间函数不需要各自声明一个自己本不需要的 `agent` 参数。

### 为什么创建与 setup 刻意留在子边界之外

并发的驱动器各自拥有独立的存储:一个子驱动器的 continuation 携带子 agent 作为发起方,而 `withInitiator()` 一旦返回,*调用方*的 continuation 立刻恢复为父 agent——这正是 `AsyncLocalStorage.run()` 组合方式的自然结果。但创建、持久化加载,以及尚未发布的 `setup(agentCtx)` 都刻意运行在子驱动器自身的边界*之外*。如果一个父 agent 创建了一个子 agent(比如一个 subagent),setup 回调里观察到的当前发起方是*父* agent(因为 setup 因果上属于父 agent 正在进行的工作的一部分),而同一个回调内的 `agentCtx.agent` 显式标识的是正在被构造的*子* agent。环境发起方身份回答的是"这是谁引发的";显式的 `agentCtx.agent` 字段回答的是"这个作用域是为了什么"。把二者混为一谈——比如让 setup 回调把自己看作自己的发起方——是错误的,因为 setup 此时还没有开始驱动任何东西。

### teardown 在"关闭"与"排空"之间刻意保持不对称

注册表自己的 teardown effect(`index.ts:294-297`)分两步走:先 `disposeInitiators()`,再 `closeInitiators()`。`closeInitiators()` 把一个状态标志从 `'active'` 翻转为 `'closing'`,拒绝任何*新的* `withInitiator`/`withoutInitiator` 调用。`disposeInitiators()`(`index.ts:625-637`)随后等待每一个当前活跃边界返回的 Promise 全部完成(用 `activeInitiatorRuns` 这个简单计数器跟踪,在 `runWithInitiator` 中每个边界会各自加一减一,见 `index.ts:640-670`),然后才最终调用 `AsyncLocalStorage.disable()`——Node 要求在一个 ALS 实例变得可垃圾回收之前必须先调用它,而这一点对于 HMR 替换这个服务来说很关键。

一个小小的例外:如果某个发起方边界自身继承的异步链,恰好正是触发所属 Cordis fiber 卸载的那条链——也就是说,teardown 是从*内部*一个仍然技术上"活跃"的边界被触发的——排空就会陷入等待自身的死锁。`releaseReentrantInitiatorRuns()`(`index.ts:688-694`)会沿着*当前正在执行*的 `initiatorRuns` 存储(一个专门为此记账用的、并行的第二个 `AsyncLocalStorage<InitiatorRun>`——它不携带身份,只有活跃/父级链接)一路向上遍历父链,把这条嵌套链从排空计数里释放出去,从而让卸载不会等待自己。任何*无关*的并发边界仍然正常排空。这是对"如何让自我触发的 teardown 顺利完成,既不死锁,又不会误伤那些与本次 teardown 毫无关系的边界"这一具体问题给出的一个窄而精确的答案。

### 这个作用域明确没有替代什么

环境中的存在既不是存活证明,也不是授权凭证。凡是已经存在显式字段的地方,那些字段依然是权威来源:`ToolExecution.agent`、`AssembleContext.agent`、任务归属、审批/钩子的主体、`cwd` 选择、取消、worker/进程消息、持久化记录,以及 wire 身份,全都继续显式传递。一个宿主感知的传输层或许会从 `ctx.agents.requireInitiator().session.id` 推导出类似 `X-Harness-Session-Id` 这样由部署方拥有的出站请求头——但这个请求头绝不会出现在模型可见的 schema 里。而且这个作用域严格限定在进程内部:它不会跨越 worker 线程、子进程、HTTP,或者持久化队列;任何需要跨越这类边界传递身份的场景,都必须把身份显式物化进一份类型化的消息。

## 配套模块:`dispatch.ts`、`inbox.ts`、`model-selection.ts`、`consumed-work.ts`

四个更小的模块补全了这个包的公共机制,`AgentLoop` 和任何自定义驱动器都会用到它们。

**`agentEvents(ctx, agent)`**(`dispatch.ts:107-149`)是每一个 payload 携带 `agent: Agent` 字段、处理函数声明 `this: Scoped<Agent>` 的 `agent/*` 事件的融合分发器。它把作用域载体(`dsh-scope` 的键,也就是 agent 本身)和注入的 payload 主体绑定在一起,使二者在结构上不可能分歧——调用方不可能把分发作用域绑定到一个 agent,却又声称主体是另一个 agent。它对外暴露 `emit`(发后不理,同时容纳同步抛出和被拒绝的 Promise,这样一个坏监听器就不会拖垮其余监听器)、`serial`(等待、按序,Cordis 的 `serial`)和 `waterfall`(环绕式中间件,Cordis 的 `waterfall`)。`agentCarrier(agent)` 只构造一次可复用的、无状态的载体,这样热路径上的重复分发方(循环驱动器)就不会每次调用都重新分配它。

**`Inbox`**(`inbox.ts:25-220`)是 agent 自己拥有的、对持久 `agent/inbox/spliced` 会话事件的一次性重放投影,投影到两份内存列表(`nextTurn`、`nextStep`)。它在构造时从会话的事件日志重建自身(`inbox.ts:32-40`)——持久日志是权威来源,内存列表只是一份读缓存。`claim()`(`inbox.ts:71-78`)是循环自己在步骤边界的读取操作:它是一次纯删除的 splice,不会重新插入,只由驱动器调用,不作为一个通用的插件扩展点暴露出去。`append`/`prepend`/`replace`/`remove`/`clear`/`splice` 才是面向插件的变更接口;每一次都会先持久记录一条 `agent/inbox/spliced` 事件,*然后*才变更内存投影(`inbox.ts:186-191`),这样一个同步的 `session/event` 观察者看到的就是 splice 之前的状态,能够准确重建出到底删除了什么。

**`installModelSelection(agentCtx, selection)`**(`model-selection.ts:39-75`)把一个可变的 `ModelSelectionRef` 和两个 agent 作用域的监听器绑定在一起:一个挂在 `system-prompt/assemble` 上,把当前选中的 provider/model 快照进提示词变量;另一个挂在 `agent/request` 上,把完整的选择(provider、model 和 reasoning effort)应用到该步骤冻结的请求配置上。如果没有选定的推理强度,会显式清除任何*继承*来的推理强度,而不是保留它——这样切换模型时,新模型会退回到它自己适配器/provider 的默认值,而不会沿用一个对它并不适用的设置。

**`foldConsumedWork(events)`**(`consumed-work.ts:68-108`)回答了一个仅凭轮次/步骤词汇无法回答的问题:一份日志实际消费掉的工作最终变成了什么?一个认领了 inbox 输入、却在到达某个步骤之前就被拒绝的轮次,产生的 `turn/end` 和一个什么都没拿到就干净结束的轮次,长得一模一样——只看轮次边界本身,分辨不出"认领了工作但被中途砍掉"和"什么都没做"这两种情况。这个函数把事件流走一遍,跟踪哪些轮次进入过步骤、哪些只是认领了输入,返回能为已消费工作交代清楚的最新一个轮次,以及被接受的工作是否在真正运行之前就已经被从 inbox 里取消掉了。由于所有输入都来自日志本身,不管是谁发起的取消——agent 自己的 teardown、祖先的中断,还是某个正在卸载的插件——读回来的结果都是一致的。

## `agent-loop` 里额外提供了什么

本章所讲的一切都与循环无关。`agent-loop`(上一章讲过)在此之上加的是真正的状态机:轮次/步骤编排、`agent/pre-step` → `step/start` → `agent/request` → 工具分派 → `agent/turn-stopping` → `turn/end` 这条序列,以及决定 `wakeDriver()` 何时触发的阶段机(`idle`/`running`)。`dsh-agent` 声明的是这些阶段所发出的 `agent/*` 事件*词汇表*本身——`agent/created`、`agent/disposed`、`agent/status`、inbox 相关事件、`agent/pre-step`、`agent/request`、`agent/request-error`、`agent/turn-stopping`、`agent/error`——但对这些事件如何触发、何时触发不持任何立场。任何实现了 `Agent` 并通过 `ctx.agents.register()` 完成注册的东西,都可以在完全不同的时间表上发出同一套词汇。

## 值得记住的已知局限

包 README 明确记录了几个缺口,对任何要在这个接口之上构建东西的人都很重要:

- 发起方作用域严格限定在进程内部;worker、子进程、HTTP、持久化队列和进程重启都必须显式物化所需的身份,而不能依赖 ALS 跨越这些边界。
- `agent/session-start` 是一个同步、不可 veto 的通知——它不能为启动设置门禁。必须在发布*之前*完成的异步组合,应该放进工厂的 `setup(agentCtx)` 事务里。
- 目前仍然没有只取消某个步骤、同时让正在进行的*轮次*继续运行的能力;`cancel(cause, { keepInbox: true })` 会中止整个轮次,但会保留排队和 steering 中的工作,这已经是当前能做到的最细粒度了。
