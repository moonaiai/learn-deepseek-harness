---
id: s05
slug: s05-agent-interface
title: "The Agent Interface and Registry"
summary: "The loop-independent Agent contract, the AgentRegistry factory pattern, and process-local initiator scope"
module: foundations
order: 5
sources:
  - path: packages/core/agent/README.md
    label: "dsh-agent README"
  - path: packages/core/agent/src/runtime-types.ts
    lineStart: 24
    lineEnd: 144
    label: "AgentOptions, AgentStatus, Agent interface"
  - path: packages/core/agent/src/index.ts
    lineStart: 172
    lineEnd: 214
    label: "AgentHandle, AgentFactory"
  - path: packages/core/agent/src/index.ts
    lineStart: 256
    lineEnd: 298
    label: "AgentRegistry fields and constructor"
  - path: packages/core/agent/src/index.ts
    lineStart: 300
    lineEnd: 388
    label: "currentInitiator/requireInitiator/withInitiator/withoutInitiator, setFactory"
  - path: packages/core/agent/src/index.ts
    lineStart: 405
    lineEnd: 457
    label: "create, resume, register"
  - path: packages/core/agent/src/index.ts
    lineStart: 474
    lineEnd: 577
    label: "enter/detachEntered/announce ordered publication"
  - path: packages/core/agent/src/index.ts
    lineStart: 640
    lineEnd: 670
    label: "runWithInitiator (AsyncLocalStorage boundary + drain tracking)"
  - path: packages/core/agent/src/dispatch.ts
    label: "agentEvents fused dispatcher and assembleContextFor"
  - path: packages/core/agent/src/inbox.ts
    label: "Inbox projection of agent/inbox/spliced"
  - path: packages/core/agent/src/model-selection.ts
    label: "installModelSelection"
  - path: packages/core/agent/src/consumed-work.ts
    label: "foldConsumedWork"
  - path: .agents/notes/implemented/architecture/2026-07-15-agent-initiator-scope.md
    label: "Agent Note: Initiating Agent scope over AsyncLocalStorage"
  - path: packages/core/agent-loop/src/agent.ts
    lineStart: 182
    lineEnd: 191
    label: "wakeDriver() wraps kick() in withInitiator(this, ...)"
  - path: packages/core/agent-loop/src/index.ts
    lineStart: 296
    lineEnd: 350
    label: "AgentLoop implements AgentFactory, registers via setFactory"
  - path: docs/architecture.md
    lineStart: 43
    lineEnd: 51
    label: "Core packages table: core/agent vs core/agent-loop"
---

## Why this package exists separately from the loop

The previous chapter walked through `AgentLoop` — the concrete state machine that claims inbox input, opens turns, drives model steps, and dispatches tools. `AgentLoop` is one *implementation*. `packages/core/agent` (`@deepseek-ai/dsh-agent`) is the *interface* every other plugin programs against: the `Agent` type, the `AgentRegistry` service at `ctx.agents`, and the `agent/*` event vocabulary. It has zero dependency on `agent-loop`.

That split is not incidental layering — it is the point. The [core packages table](../../../../docs/architecture.md) in the architecture doc lists them as two separate rows for a reason:

| Package | Owns | `ctx` key |
|---|---|---|
| `core/agent` | The `Agent` interface, live registry, and `agent/*` events | `ctx.agents` |
| `core/agent-loop` | The default driver implementing that interface | `ctx.agentLoop` |

A UI layer, the ACP bridge, a hook, or an orchestrator that wants to send a message, cancel a run, or watch status transitions imports `dsh-agent` and calls `ctx.agents.get(id)`. None of that code needs to know whether the agent behind that id is driven by `AgentLoop`, a test double, or some future alternative driver — as long as the alternative implements the `Agent` interface and registers through `ctx.agents.register()`. The [package README](../../../../packages/core/agent/README.md) states this directly: "Every plugin (UI, hooks, orchestrators) programs against the `Agent` handle defined here — it has zero loop dependency, so the loop is swappable."

This chapter covers four things `dsh-agent` provides that `agent-loop` builds on top of: the `Agent` interface contract, the `AgentRegistry` lifecycle (register/enter/announce, and the factory-based create/resume path), the process-local initiator scope (`withInitiator()`/`currentInitiator()`), and the `AgentHandle` ownership model.

## The `Agent` interface

`Agent` (defined in `packages/core/agent/src/runtime-types.ts:64-144`) is a plain object contract — no class, no loop coupling:

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

A few things stand out about what is — and is not — here:

- **`id` is shared with `session.id`.** An agent and its session are the same identity; there is exactly one live session per agent and vice versa. `AgentRegistry.enter()` (`index.ts:474-478`) enforces this at insertion time by throwing if `agent.id !== agent.session.id`.
- **`status` is binary: `'idle' | 'running'`.** Disposal is not a third status — an agent that's been torn down is simply absent from the registry.
- **`ctx` is the agent's own scoped Cordis context.** Anything registered through `agent.ctx` — tools, prompt sections, listeners — is agent-local and unwinds automatically when the agent disposes. This is the same `dsh-scope` mechanism the previous chapter's loop discussion assumed; `dsh-agent` is one of its two consumers (the other being `system-prompt`).
- **Four ways to feed input**, each with different wake/queue semantics: `send()` is the general primitive (explicit `target` and `wakeup`), `followup()` and `steer()` are fixed-preset aliases (`next-turn`/wake, `next-step`/wake), and `inject()` queues non-waking `next-step` context — useful for injecting model-facing material that should ride along on whatever step happens next, without forcing one to start.
- **`cancel()` and `whenIdle()` describe whole-agent activity**, not a single message's fate. `followup()` returns no completion handle — the message id you get back identifies inbox insertion, claim, and discard facts in the session log, not a later `turn/end`. If you need to know what became of consumed input, that's a separate read (see `foldConsumedWork` below).

Nothing about `cancel`, `whenIdle`, `send`, or the rest names a turn/step machine, a specific model call flow, or `AgentLoop` at all. Any object satisfying this interface — including a hand-rolled test double — is a legitimate `Agent`.

## `AgentRegistry` (`ctx.agents`)

`AgentRegistry extends Service` (`index.ts:256`) is the live directory of every `Agent` currently running in the process, plus the home of the initiator-scope machinery covered below. Its lookup surface is small and synchronous:

- `get(id: SessionId): Agent | undefined`
- `list(): Agent[]` — all live agents, registration order
- `roots(): Agent[]` — live agents with no owning agent context (a resumed forked session can still be a runtime root; ownership here is a live relation, not durable session lineage)
- `isOwnedBy(id, owner): boolean` — whether the *exact live entry* for `id` was created through `owner`'s scoped context

### Two ways to get an agent into the registry

**`register(agent)`** (`index.ts:450-457`) is the plain path: hand it an already-constructed `Agent` and it records it, emits `agent/created` once, and disposes (emitting `agent/disposed`) when the calling fiber unloads. This is what a custom driver — anything that isn't `AgentLoop` — uses directly.

**`enter()` + `announce()`** (`index.ts:474-509`, `549-576`) is the advanced ordered-lifecycle primitive `register()` itself is built from, and it's what the async creation factory (below) uses because creation needs to do work — await `setup()` — *before* the agent becomes visible to anyone. `enter()` performs the authoritative id-collision check and inserts the entry without announcing it; `announce()` emits `agent/created` exactly once, later. Splitting them matters because a listener on `agent/created` might synchronously request disposal (a "detach") — the registry defers that detach until the `announce()` dispatch has fully unwound (the `entry.announcing` / `entry.detachRequested` dance at `index.ts:494-506` and `559-575`), so every listener reached by that one dispatch observes the same stable entry, and a stale detach closure can never delete a *later* entry that happens to reuse the same id.

### The factory pattern: creation lives outside the interface

`AgentRegistry` does not know how to build an `Agent` — it only knows how to register one. Construction is delegated to whatever plugin implements `AgentFactory`:

```ts
// packages/core/agent/src/index.ts:183-214
export interface AgentFactory {
  createAgent(ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle>
  resume(ownerCtx: Context, options: ResumeAgentOptions): Promise<AgentHandle>
}
```

`AgentLoop` is the one concrete implementer today (`packages/core/agent-loop/src/index.ts:296`, `class AgentLoop extends Service implements AgentFactory`), and it registers itself with `ctx.effect(() => ctx.agents.setFactory(this), 'agentLoop.setFactory()')` (`index.ts:350`). `setFactory()` (`packages/core/agent/src/index.ts:372-388`) throws if a second factory tries to register — there is one factory per process — and clears the slot on disposal.

`ctx.agents.create(options)` and `ctx.agents.resume(options)` (`index.ts:405-430`) are thin forwarders: they re-trace the registered factory through the caller's own context (so effects the factory registers attach to the *caller's* fiber, not the factory's) and call `target.createAgent(ownerCtx, options)` / `target.resume(ownerCtx, options)`. If no factory is registered, both reject with `no agent factory registered (load an agent-loop plugin)`.

This indirection is exactly the payoff of the interface/implementation split: the ACP bridge, in-process subagent backends, and any other consumer that wants to spin up an agent call `ctx.agents.create()` — they never import `dsh-agent-loop`. Swap in a different `AgentFactory` and every one of those call sites keeps working unmodified.

`CreateAgentOptions.setup(agentCtx)` and `ResumeAgentOptions.setup(agentCtx)` are the hook for composing an agent's scoped world (tools, prompt sections, listeners) *before* either the session or the agent becomes visible — everything registered through `agentCtx` exists before `agent/created`, `agent/session-start`, and the first prompt assembly. Setup is trusted, composition-only, same-process code: it must not start driving the agent, only assembling it. A rejection, a thrown synchronous commit, or owner disposal during setup rolls the whole transaction back without publishing either id.

## `AgentHandle`: a disposal capability, not a lookup result

```ts
// packages/core/agent/src/index.ts:172-175
export interface AgentHandle {
  agent: Agent
  dispose(): Promise<void>
}
```

The README is explicit that `dispose()` is "a **consumer capability** — no observer holding the bare registry entry can tear the agent down." `ctx.agents.get(id)` still returns a bare `Agent` to anyone who looks it up; only the caller that received the `AgentHandle` from `create()`/`resume()` holds the disposer. The caller's fiber and the registered factory provider are *structural co-owners*: normal caller-fiber unload disposes it through ordinary Cordis ownership, while factory unload must independently stop every live instance it made, because the agent's scoped dependency surface (tools, providers it resolved through the factory's context) belongs to that provider. Calling `dispose()` from either path reaches one memoized quiescence boundary: stop the loop, await its exit, unregister the agent, remove its session from the store, unwind the scoped world.

Config-created agents — the ones `AgentLoop` starts directly from its `cordis.yml` `agents:` entries — are owned by the loop fiber itself and never need a handle at all; there's no separate consumer waiting to dispose them.

## `withInitiator()` / `currentInitiator()`: identity below explicit parameters

This is the subtlest piece of the package, and it solves a real, narrow problem, documented in [the Agent Note](../../../../.agents/notes/implemented/architecture/2026-07-15-agent-initiator-scope.md).

### The problem it solves

Cordis `Context` already answers "who can see this service, and what registered it." `agent.ctx` already answers "what's scoped to this one live agent." Neither answers a third, different question: *which* `Agent`, as a value, is the subject of the asynchronous call chain currently executing? Something like a host-aware transport, a tracing helper, or a logger sitting deep inside library code — well below the loop, well below any tool call — sometimes legitimately needs to know "which agent caused this," without every intervening function signature threading an explicit `agent: Agent` parameter through purely for that purpose.

Three tempting alternatives are each wrong for a specific reason:

- **Forward `Agent` through every function anyway.** Correct at explicit boundaries (service calls, worker/process/wire messages, persistence records) — those keep doing this — but requiring *every* private helper below a driver to also carry it is repetitive forwarding with no trust benefit, since it's already same-process code.
- **A process-global mutable slot.** Concurrent agents (a parent driving a delegated subagent, say) overwrite each other across `await` boundaries; there's no serialization guarantee that would make a bare global safe.
- **Derive it from model-visible arguments.** A model must never be trusted to select its own session identity or routing.

### The mechanism

`AgentRegistry` carries the initiating `Agent` in a Node `AsyncLocalStorage<Agent | undefined>` (`index.ts:259`, field `initiators`). It stores the `Agent` value itself directly — no wrapper frame with extra fields — because turn, step, `signal`, `cwd`, sandbox, and authorization all already have their own authoritative owners; adding more fields to a carried frame would just create stale copies of state that's tracked correctly elsewhere.

Four operations (`index.ts:309-358`):

- **`currentInitiator(): Agent | undefined`** — optional read; use for logging, tracing, or host attribution that must also tolerate agentless calls.
- **`requireInitiator(): Agent`** — throws `no initiating agent is active` if nothing is inherited. For private helpers that are contractually always below a driver.
- **`withInitiator(agent, operation)`** — runs `operation` with `agent` as the ambient initiator, preserving `operation`'s exact synchronous return value or Promise identity.
- **`withoutInitiator(operation)`** — establishes a *clearing* boundary, so lazily-initialized shared infrastructure (a timer, a queue pump, a connection pool) doesn't accidentally inherit whichever agent happened to trigger its first use.

`AgentLoop` is the one production caller of `withInitiator`. `wakeDriver()` wraps the entire per-wake driver invocation:

```ts
// packages/core/agent-loop/src/agent.ts:191
this.loopCtx.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject)
```

Every package-private orchestration entry inside the loop — turn scheduling, step scheduling, tool-call dispatch — recovers the exact `Agent` via `ctx.agents.currentInitiator()`/`requireInitiator()`, derives `agent.session` once, and lets operation-local helpers close over that value instead of forwarding the concrete driver instance or a bare `Session` through shallow interfaces. Deep, cross-cutting infrastructure gets a trusted "who is this for" without every intermediate function in the call chain declaring an `agent` parameter it doesn't otherwise need.

### Why creation and setup stay *outside* the child's boundary

Concurrent drivers get independent stores: a child driver's continuations carry the child as initiator, and the moment `withInitiator()` returns, the *caller's* continuation resumes with the parent restored — this is exactly how `AsyncLocalStorage.run()` composes. But creation, persistence load, and unpublished `setup(agentCtx)` deliberately run *outside* the child's own driver boundary. If a parent agent creates a child (e.g. a subagent), the setup callback observes the *parent* as the current initiator (because setup is causally part of the parent's ongoing work), while `agentCtx.agent` inside that same callback explicitly identifies the *child* being constructed. Ambient initiator identity answers "who caused this to happen"; the explicit `agentCtx.agent` field answers "what is this scope for." Conflating them — for instance, by making the setup callback see itself as its own initiator — would be wrong, because setup hasn't started driving anything yet.

### Teardown is deliberately asymmetric between "close" and "drain"

The registry's own teardown effect (`index.ts:294-297`) runs two steps: `disposeInitiators()` then `closeInitiators()`. `closeInitiators()` flips a state flag from `'active'` to `'closing'`, rejecting any *new* `withInitiator`/`withoutInitiator` call. `disposeInitiators()` (`index.ts:625-637`) then waits for every currently-active boundary's returned Promise to settle (tracked by `activeInitiatorRuns`, a plain counter incremented/decremented per boundary in `runWithInitiator` at `index.ts:640-670`) before finally calling `AsyncLocalStorage.disable()` — which Node requires before an ALS instance becomes garbage-collectable, which in turn matters for HMR replacing this service.

The one wrinkle: if an initiator boundary's own inherited async chain is what triggers the owning Cordis fiber's unload — i.e., teardown was reached *from inside* a boundary that's still technically "active" — draining would deadlock waiting on itself. `releaseReentrantInitiatorRuns()` (`index.ts:688-694`) walks the parent chain of the *currently executing* `initiatorRuns` store (tracked in a second, parallel `AsyncLocalStorage<InitiatorRun>` purely for this bookkeeping — it carries no identity, just active/parent links) and releases exactly that nested chain from the drain count, so the unload doesn't wait on itself. Any *unrelated* concurrent boundary still drains normally. This is a narrow, specific answer to "how do I let self-triggered teardown proceed without either deadlocking or accidentally skipping draining for boundaries that have nothing to do with the teardown."

### What this scope explicitly does not replace

Ambient presence is neither a liveness proof nor an authorization grant. Explicit fields remain authoritative wherever they already exist: `ToolExecution.agent`, `AssembleContext.agent`, job ownership, approval/hook subjects, `cwd` selection, cancellation, worker/process messages, persistence records, and wire identity are all still passed explicitly. A host-aware transport might derive something like an `X-Harness-Session-Id` header from `ctx.agents.requireInitiator().session.id` for deployment-owned outbound calls — but that header stays out of model-visible schema. And the scope is strictly process-local: it does not cross worker threads, child processes, HTTP, or durable queues; anything that needs identity across one of those boundaries must materialize it explicitly into a typed message.

## Supporting pieces: `dispatch.ts`, `inbox.ts`, `model-selection.ts`, `consumed-work.ts`

Four smaller modules round out the package's shared machinery, used by both `AgentLoop` and any custom driver.

**`agentEvents(ctx, agent)`** (`dispatch.ts:107-149`) is the fused dispatcher for every `agent/*` event whose payload carries an `agent: Agent` field and whose handler declares `this: Scoped<Agent>`. It couples the scope-carrier (the `dsh-scope` key, which is the agent itself) to the injected payload subject so they structurally cannot diverge — a caller cannot dispatch scoped to one agent while claiming a different one is the subject. It exposes `emit` (fire-and-forget, contains both synchronous throws and rejected-promise rejections per listener so one bad listener can't starve the rest), `serial` (awaited, in-order, Cordis `serial`), and `waterfall` (around-middleware, Cordis `waterfall`). `agentCarrier(agent)` builds the reusable stateless carrier once so a hot-path repeat dispatcher — the loop driver — doesn't reallocate it per call.

**`Inbox`** (`inbox.ts:25-220`) is the agent-owned, replay-once projection of the durable `agent/inbox/spliced` session events into two in-memory lists (`nextTurn`, `nextStep`). It rebuilds itself from the session's event log on construction (`inbox.ts:32-40`) — the durable log is authoritative; the in-memory lists are a read cache. `claim()` (`inbox.ts:71-78`) is the loop's own step-boundary read: it's a pure-deletion splice with no re-insertion, called only by the driver, not exposed as a general plugin extension point. `append`/`prepend`/`replace`/`remove`/`clear`/`splice` are the plugin-facing mutation surface; each durably logs an `agent/inbox/spliced` event *before* mutating the in-memory projection (`inbox.ts:186-191`), so a synchronous `session/event` observer sees the pre-splice state and can reconstruct exactly what was removed.

**`installModelSelection(agentCtx, selection)`** (`model-selection.ts:39-75`) couples a mutable `ModelSelectionRef` to two agent-scoped listeners: one on `system-prompt/assemble` that snapshots the currently-selected provider/model into prompt variables, one on `agent/request` that applies the complete selection (provider, model, and reasoning effort) to the frozen request config for that step. An absent selected effort explicitly clears any *inherited* effort rather than leaving it — so switching models mid-session falls back to that model's own adapter/provider default rather than carrying over a setting that doesn't apply to it.

**`foldConsumedWork(events)`** (`consumed-work.ts:68-108`) answers a question the turn/step vocabulary alone cannot: what became of the work a log actually consumed? A turn that claims inbox input and then gets rejected before reaching a step produces a `turn/end` shaped identically to a turn that took nothing and closed cleanly — reading turn boundaries in isolation can't distinguish "cut short after claiming work" from "did nothing." The fold walks the event stream once, tracking which turns stepped versus merely claimed, and returns the latest turn that accounts for consumed work plus whether accepted work was later cancelled out of the inbox before ever running. Because every input is the log itself, a cancellation issued by any owner — the agent's own teardown, an ancestor's interrupt, an unloading plugin — reads back identically.

## What lives in `agent-loop` instead

Everything this chapter covered is loop-independent. What `agent-loop` adds on top (covered in the previous chapter) is the actual state machine: turn/step orchestration, the `agent/pre-step` → `step/start` → `agent/request` → tool dispatch → `agent/turn-stopping` → `turn/end` sequence, and the phase machine (`idle`/`running`) that decides when `wakeDriver()` fires. `dsh-agent` declares the `agent/*` event *vocabulary* those phases emit through — `agent/created`, `agent/disposed`, `agent/status`, the inbox events, `agent/pre-step`, `agent/request`, `agent/request-error`, `agent/turn-stopping`, `agent/error` — but declares no opinion about how or when they fire. Anything implementing `Agent` and registering via `ctx.agents.register()` could emit that same vocabulary on a completely different schedule.

## Known limitations worth carrying forward

A few gaps the package README documents explicitly, because they matter for anyone building on this interface:

- Initiator scope is strictly process-local; workers, child processes, HTTP, durable queues, and process restarts must materialize any needed identity explicitly rather than relying on ALS to cross that boundary.
- `agent/session-start` is a synchronous, veto-less notification — it cannot gate startup. Asynchronous composition that must complete *before* publication belongs in the factory's `setup(agentCtx)` transaction instead.
- There's still no step-only cancellation that keeps an in-flight *turn* running while stopping just the current step; `cancel(cause, { keepInbox: true })` aborts the turn but preserves queued/steering work, which is as fine-grained as it gets today.
