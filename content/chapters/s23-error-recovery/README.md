---
id: s23
slug: s23-error-recovery
title: Error Recovery and Defensive Patterns
summary: How the agent loop cancels turns and tool calls cooperatively rather than
  killing them, how agent/request-error drives transparent retry, and the hard-won
  defensive rules — illustrated with three real postmortems — that keep this codebase's
  failures loud instead of silent.
seamKind: non-seam
module: orchestration-and-capstone
order: 23
---

## Two failure modes, two different fixes

This chapter is about what happens when something in a running agent goes wrong — not a bug in application code, but a live failure: a user wants to stop a turn, a tool call needs to be interrupted mid-flight, a model request comes back as a transport error. DeepSeek Harness treats these as two distinct problems with two distinct mechanisms:

:::concept{term="Cancellation"}
Deliberate: someone or something (a user, a parent agent, a hook, disposal) decides a turn or a tool call should stop. The loop cooperates with that decision instead of forcibly killing work.
:::

:::concept{term="Retry"}
Automatic: a model request fails in a way that might succeed on a second attempt, and a plugin decides whether to retry it transparently, without the model or the user ever seeing the failure.
:::

Both mechanisms share one design commitment that shows up throughout this codebase: **never abandon work you can't prove has stopped.** A cancelled turn does not return "cancelled" until the work it interrupted has actually reached quiescence. A retried request does not silently duplicate a tool call. This is the same commitment [`docs/defensive-patterns.md`](../../../../deepseek-harness/docs/defensive-patterns.md) states as a general rule — "dispose must reach quiescence, not just request it" — applied specifically to the turn/step driver.

The second half of this chapter turns to a different question: given that failures happen, how does this codebase learn from the ones that actually shipped? Three real postmortems show what "defensive engineering" looks like in practice here — not abstract caution, but rules written in direct response to a specific incident.

## Explicit turn cancellation

### One turn, one owner, one signal

Every agent turn (see [Chapter 4](../s04-agent-loop/README.md) for the full turn/step mechanics) runs under exactly one `AbortController`, privately owned by the loop and installed before `agent/status = running` is published. That controller's signal threads through every stage the turn touches: inbox claim, `agent/pre-step`, prompt assembly, every step's model request and tool execution, and `agent/turn-stopping`. The loop clears the holder immediately before publishing `turn/end`, so terminal-event observers and the following durability flush cannot cancel work that has already committed, even though the driver's public status may not flip back to `idle` until that flush settles.

`Agent.cancel()` is the one entry point:

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

The cause is a closed, TypeScript-enforced union — not a free-form string. That is a deliberate choice: a string reason invites spelling drift and prevents exhaustive `switch` handling, while the runtime needs to classify exactly who requested a stop (`user`, an initiating `parent` agent, a `hook` with its own reason text, or agent `disposed`). `cancel()` defaults its cause to `user` when called with no argument. `CancelOptions.keepInbox` lets a caller abort the active turn while preserving queued and steering inbox items for a later turn — ordinary cancellation instead discards them.

Calling `cancel()` on an idle agent is a no-op: there is no active holder to abort, and cancellation does not arm later work. Calling it while a turn is running aborts that turn's controller — first caller wins for the active holder, though a later call can still clear newly queued pending work. The active cause is copied into the controller's `AbortSignal.reason`, frozen; a signal grants no classification authority to whatever code observes it later, only the fact that it fired.

### What gets durably recorded — and what doesn't

:::decision
An interrupted live turn closes with the coarse durable outcome `{ kind: 'aborted' }` in its `turn/end` event. That record deliberately does **not** carry which of the four causes triggered it.

:::decision
The [explicit-turn-cancellation Agent Note](../../../../deepseek-harness/.agents/notes/implemented/architecture/2026-07-16-explicit-turn-cancellation.md) states the reasoning directly:

> No production replay, UI, ACP, telemetry, or workflow consumer distinguishes `user` from `parent`. Copying the request source into the terminal result would conflate two facts and add Session-specific validation without a consumer.
:::

This is the "model-visible means logged" rule cutting the other way: the terminal event records *what happened to the turn* (it was aborted), while the *runtime* signal identifies *who* requested it — two different facts, and only the first one earns a place in durable history. Session seed/load actively rejects legacy aborted records carrying a reason field or any other extra field, which forecloses reintroducing caller-owned cancellation detail through replay. A separate process-local `agent/cancel-requested` notification does fire with the resolved cause before work is torn down, but it is not durable — it exists for live observers, not for the log.
:::

### Cooperative, not preemptive

The loop checks `signal.aborted` (via `throwIfAborted()`) before and after every awaited boundary — before building a request, after streaming each chunk, before dispatching tool calls — but it never races an in-progress Promise against the abort signal to abandon it early. Work that ignores the signal must still settle before `whenIdle()` resolves, before disposal completes, and before the loop reports quiescence.

This is a direct instance of the "async state is not synchronous state" and "dispose must reach quiescence" defensive rules: `Promise.race`-style abandonment would let the driver report `idle` while the abandoned work's side effects are still landing — for example, a tool still writing a file, or a subprocess still running. Racing the signal is available as an *option* in JavaScript, and this codebase explicitly rejects it for cancellation. The tradeoff is real: uncooperative same-process work can delay how quickly a cancel takes visible effect, but the reported quiescent state stays truthful. Hard termination of genuinely stuck work is a job for a worker or process isolation boundary — outside this control's scope.

### Where the signal reaches

Every participating method, event, and request object receives the same explicit signal for the life of one turn — a fresh one for the next. Concretely: `agent/pre-step`, `agent/request`, model streaming, `agent/request-error` recovery, tool execution, approval, `agent/turn-stopping`, and subagent/workflow requests all carry `signal: AbortSignal` in their payloads. Hook bridges accept `RunHookOptions.signal` so that cancelling a turn reaches all the way down to a bash executor's process-group kill and join. `SystemPrompt.assemble()` accepts `signal?: AbortSignal` as an ordinary optional field, because prompt assembly can also happen outside any turn (e.g. cold rendering), where there is no signal to pass.

`ctx.agents` (the [initiator scope](../s16-subagent-seam/README.md)) continues to carry only the initiating `Agent` — never a turn or a cancellation signal. That is a boundary the design note calls out explicitly: adding turn-lifetime state to a driver-lifetime ambient context would let a stale asynchronous descendant appear to retain authority over a *later* turn on the same agent. Cancellation therefore has exactly one owner and travels only through explicit parameters, never through ambient lookup.

## Cooperative tool cancellation

Turn cancellation stops the loop; tool cancellation is the matching mechanism one layer down, at the tool registry boundary described in [Chapter 6](../s06-tool-pipeline-and-prompt/README.md). The same "ask, don't kill" philosophy applies, with its own type-level guarantee.

### The signal is required, not optional

```ts type-equiv
interface ToolExecutionInput {
  readonly signal: AbortSignal
  // ...
}
```

`ToolExecutionInput.signal`, `ToolExecution.signal`, and `ToolRunContext.signal` are all required, readonly `AbortSignal` fields — not `signal?: AbortSignal`. `defineTool()` types `exec.signal` as required for every registered tool, so a tool body can observe or forward cancellation without a cast or a null check. The registry supplies no overload, no default controller, no never-abort sentinel, and no convenience call path that omits it. Every caller must supply the signal it actually owns.

This is the same "explicit > implicit" convention that runs through the whole codebase: an optional signal would let some caller silently opt out of cancellation, and the registry cannot synthesize a fallback signal that represents a lifetime it doesn't own. Making it required at the type level converts a class of "this tool never got cancelled properly" bugs into a compile error instead of a runtime surprise.

### Mutability matches the pipeline stage

Not every participant in a tool call needs — or should have — the power to *change* the signal. `ToolDispatchExecution` (used only by the `tools/execute` waterfall) is the one type where `signal` is mutable; every other stage — pre-policy, post-policy, result observers, and the tool implementation itself — receives a readonly view. An around-dispatch wrapper may temporarily *replace* `exec.signal` for its own delegated lifetime (for example, to add a deadline), but it cannot delete it or set it to `undefined`; the registry fuses every wrapper replacement with the original caller signal immediately before the tool body runs, and restores the upstream signal unconditionally once the wrapper's scope ends. This lets deadline-style composition exist without ever leaving a tool body running with no cancellation path at all.

### Two cancellation codes, because "it might have run" matters

A tool call can be cancelled at several different points: before any policy check, during approval, inside an around-dispatch wait, after the tool body has already started, or while post-policy is still waiting on a completed body. One undifferentiated "aborted" result cannot tell a durable consumer whether the tool's side effects might have already happened. `dsh-tools` therefore exports two distinct codes:

- **`TOOL_ABORTED_BEFORE_DISPATCH`** — cancellation prevented the tool body from ever being invoked. Model text: `Error: tool call aborted before dispatch`.
- **`TOOL_ABORTED`** — cancellation happened only after the body was already invoked (for example, while an around-wrapper or post-policy listener was waiting on an already-running call). Model text: `Error: tool call aborted`.

The registry marks the exact instant it invokes `ToolDefinition.execute()`, so this distinction is precise, not a guess. A denial, wrapper failure, or tool-level failure remains more specific than either generic cancellation code, and a timeout owned by timeout policy remains its own `TOOL_TIMEOUT` — cancellation codes never paper over a more specific failure.

This distinction is exactly why the agent loop's `appendSkippedToolCall()` (in `packages/core/agent-loop/src/tool-calls.ts`) writes `'Error: tool call aborted before dispatch'` for every sibling tool call abandoned when a turn is cancelled mid-batch — those calls, by construction, never reached the tool body:

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

Note the shape: every abandoned call still gets a durable `tool/call` + `tool/result` pair, never a silent gap. If a model message requested five tool calls, the log always shows five paired results — whether they ran, were skipped by cancellation, or failed outright. This is what keeps replay deterministic: a consumer reconstructing history from the log never has to guess whether a missing result means "still pending" or "lost."

### Once a body starts, the registry waits for it

Exactly like turn cancellation, once a tool's `execute()` has actually been invoked, the registry awaits it to completion rather than racing it against the abort signal. A cooperative tool implementation observes its `exec.signal` and stops (or forwards cancellation to whatever subprocess or capability it called into) and then settles; an uncooperative implementation that ignores the signal simply keeps the registry — and by extension the whole turn — pending. This is the same "quiescent disposal" defensive rule again, applied at a different layer: the [cooperative-tool-cancellation Agent Note](../../../../deepseek-harness/.agents/notes/implemented/architecture/2026-07-19-cooperative-tool-cancellation.md) rejects racing the promise explicitly, citing this exact rule.

## Retry: agent/request-error

Cancellation is about stopping work deliberately. `agent/request-error` is about the opposite case: a model request fails on its own, and something decides whether to try again.

### The waterfall

Inside `ReactLoopAgent.step()`, the model request runs in an inner `while (true)` loop specifically so that a failed request can be retried without leaving the step:

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
    continue   // loop back to the top: rebuild and resend the request
  }
  // ... success path: append assistant/message, dispatch tool calls
}
```

`agent/request-error` fires once a model streaming attempt has finished as `error` or `aborted`, after the failed step has closed but before the turn itself closes — while the turn's cancellation signal is still live, so a recovery listener can still cooperate with an in-flight cancel. It is a waterfall with exactly two possible outcomes:

```ts type-equiv
type RequestErrorAction = { kind: 'retry' } | undefined
```

A listener that wants to own recovery returns `{ kind: 'retry' }` **without** calling `next()` — this short-circuits the waterfall and sends control straight back to `continue` at the top of the `while` loop, which rebuilds the request from the same durable history and resends it as a fresh provider call. A listener that doesn't want to handle this failure calls `next()` to delegate down the chain. The default terminal handler, reached when no listener intervenes, returns `undefined`, which the loop treats as terminal: it throws an `LlmError` that propagates up and closes both the step and the turn with an `error` outcome.

Every retry opens a **new step** inside the same turn — not a hidden internal loop invisible to the log. The failed attempt's `step/end` is already durable; the retried request runs as an ordinary continuation of the turn, indistinguishable in the log from any other multi-step turn once it succeeds.

### `dsh-llm-retry`: what a concrete listener looks like

The harness ships a concrete `agent/request-error` consumer, `@deepseek-ai/dsh-llm-retry`, as an ordinary function plugin — not special-cased loop logic. It reads `retryPolicy` off the adapter registration that served the failed request (captured at registration time, so a later route disposal or replacement cannot change an in-flight failure's recovery policy) and offers two modes:

- **Normal mode** (the default when a provider configures no `retryPolicy`): retries `EMPTY_RESPONSE`, `RATE_LIMIT`, `SERVER`, `TIMEOUT`, and `TRANSPORT` up to twice, with bounded exponential backoff from 500 ms to 10 seconds and 10% jitter. `EMPTY_RESPONSE` — a degenerate provider completion with no durable content — is included because repeating it is safe by construction: nothing was committed.
- **Always mode**: asks any downstream recovery listener first, then retries *every* model-request failure without an attempt limit — including permanent failures like bad authentication or an invalid request — until success, cancellation, or plugin disposal.

Before waiting out a backoff, the plugin appends a non-surface `llm/retry` event carrying the failure, the scheduled delay, and a `retryId`; when the wait completes it appends `llm/retry-started` with the same id immediately before returning `{ kind: 'retry' }` — cancellation during the backoff window writes no `started` event. This split matters because it means "a retry was scheduled" and "a retry actually started" are two separately observable durable facts, which is exactly the "report orthogonal outcomes independently" defensive rule again: a caller inspecting the log can tell a scheduled-but-cancelled retry apart from one that actually ran.

From the model's point of view, none of this exists. No retry event, delay, provider error, or failed partial output is model-visible — the retried request reconstructs the same explicit provider/model call from durable history, so a successful retry is indistinguishable, from inside the conversation, from a request that simply succeeded on the first try. This is the "model-visible means logged" boundary working as a filter in the other direction: retry machinery is real and durable, but it never crosses into what gets rendered as conversation history.

## Defensive patterns: rules that come from real bugs

`docs/defensive-patterns.md` is short by design — six rules, each one traceable to a defect that actually shipped or nearly shipped in this codebase. Read it before touching lifecycle, concurrency, subprocess, or teardown code. Two of the rules are already load-bearing in the mechanisms above:

- **Async state is not synchronous state.** `agent/status` or `whenIdle()` is never the result of one particular message: several queued follow-ups, steering, and injected work can share one `running` interval, and cancellation or disposal can discard unstarted items. A caller that genuinely needs to attribute an outcome to one message must define its own interval explicitly (for example, from that message's durable inbox receipt to the agent's next whole-agent `idle`), and describe any output it observes as interval-wide rather than caused by that specific message.
- **Dispose must reach quiescence, not just request it.** Already covered above: a teardown that issues an abort and returns before the aborted work actually stops leaves orphans. Cleanup awaits the children's exit; kill, then await `done`.

The other four are equally concrete:

- **Report orthogonal outcomes independently.** A process can time out *and* exit 0, because it trapped the signal. `timedOut`, `signal`, and `exitCode` are three independent facts; nesting one inside another's branch lets a caller misread a cut-short run as a clean success.
- **Honor public contracts on both sides.** When an implementation can receive a result in several different representations (a thrown exception, or a structured `finish {kind:'error'}` chunk), normalize before crossing the public API boundary, so a consumer never has to guess whether a caught exception came from the provider, a wrapper, or its own assembly code.
- **Contain callback exceptions in the dispatcher.** A user-supplied listener that throws must not reject the promise it runs inside, and must not starve listeners registered after it. Wrap the dispatch loop in try/catch; one bad subscriber never breaks core lifecycle.
- **Never hand untrusted output the ambient environment or predictable paths**, and **unlink link-shaped paths with `lstatSync` + `unlinkSync`, never a recursive `rmSync`.** Both are subprocess/filesystem-specific instances of the same idea: don't let one component's disposal or output channel become another component's attack surface.

## Three postmortems: what actually broke

A postmortem in this repo is not a design decision — it's a backward-looking record of a failure: what broke, the mechanism, why every safety net missed it, and the concrete guardrail added so the same class of bug fails loudly next time. Three of the four on record are especially instructive because the bug was subtle, the escape was systemic (a gap in tests or conventions, not a typo), and the fix generalizes past this one codebase.

### Postmortem 0001 — a stray `export default` silently dropped a plugin's `inject`

The ACP server crashed the instant a real editor connected: `session/new` failed with `cannot get property "agents" without inject`, despite 178 green unit tests and 100% line coverage. The plugin's source file was a normal *namespace* plugin — separate named exports for `name`, `inject`, `Config`, and `apply` — but it had one extra line no other plugin in the repo had: `export default apply`.

Cordis's Loader normalizes an imported module through `unwrapExports`, which prefers `.default` when present: `exports.default ?? exports`. With a default export in place, that resolved to the *bare `apply` function* — a function has no `inject`, no `name`, no `Config`; those lived as sibling named exports on the module namespace, and unwrapping to `.default` threw the whole namespace away. `apply` then ran in a fiber with no injected services at all, and the very first line (`const agents = ctx.agents`) threw walking a fiber tree that granted nothing.

Every test missed this because every test mounted the plugin by hand — `ctx.plugin({ name, inject, apply })` — which supplies `inject` manually and therefore can never exercise `unwrapExports`, since that function is only ever called by the real Loader, never by `ctx.plugin`. 100% line coverage was satisfied the entire time; coverage proves lines ran, not that the feature works the way it actually ships.

**Fix:** delete the stray `export default`. **Guardrail:** a no-key `session/new` end-to-end test now boots the real example as a subprocess through the real Loader and fails loudly on this exact mistake with no API key required — verified by re-introducing the bug and watching it fail. The general rule this produced is now load-bearing convention: *"service packages default-export their service class; function plugins named-export `name`/`inject`/`Config`/`apply` and have no default export. Mixing the forms makes the Loader discard the function plugin's namespace."*

### Postmortem 0002 — a literal `!!js` object permanently disabled filesystem tools

An ACP example composition wanted filesystem tools (`read`, `write`, `edit`) enabled only for certain launch modes, and wrote `disabled: !!js <expression>` on the plugin's Loader entry, expecting Cordis to evaluate the expression and gate the entry conditionally. It never did: Cordis's `!!js` tag is interpolated only inside a plugin's `config` field — `Entry._resolveConfig()` walks and evaluates that field specifically, while `Entry.disabled` reads `entry.options.disabled` directly, with no interpolation step at all. The YAML was syntactically valid, so loading produced no error or warning; every filesystem entry simply saw a truthy JavaScript expression object sitting where a boolean was expected, and stayed disabled in every mode.

Seven filesystem scenarios and a mixed workspace-edit scenario ended up calling tools absent from the registry — `ToolNotFoundError` with code `UNKNOWN_TOOL` — and the snapshot test suite passed anyway, because the *generic failed tool card* rendered deterministically and the fixture refresh simply recorded that failure as the new expected output. The suite proved deterministic replay of the regression, not correct behavior.

**Fix:** filesystem scenarios now boot an explicit, fixed full-access overlay config (`fs.cordis.yml`) instead of a runtime conditional. **Guardrails:** `verify-cordis-config` now statically parses repository Cordis YAML and rejects expression nodes anywhere in Loader entry metadata (not just `config`), and the snapshot tooling itself rejects a structured `UNKNOWN_TOOL` result from ever being committed as an expected fixture, in a fresh run or in committed session logs. The general lesson: a snapshot refresh is fixture production, not correctness review — a missing registered tool is a semantic impossibility that needs its own assertion, independent of whether the transcript replays deterministically.

### Postmortem 0004 — a shared stderr prefix let a sandboxed child's own exit code masquerade as sandbox failure

The native Landlock launcher prints exactly one benign line — `landlock-run: partial enforcement (older Landlock ABI)` — on kernels with an older Landlock ABI, then proceeds to execute the child normally. A *launcher failure*, by contrast, prints a different `landlock-run:`-prefixed line and exits 125 without ever running the child. The harness's classification logic collapsed both cases into one check: any nonzero exit code, combined with the presence of the substring `landlock-run: ` anywhere in stderr, was treated as launcher failure.

This meant a perfectly successful, fully confined child process could be misreported as a sandbox crash purely because it happened to exit nonzero for its own ordinary reasons. Ripgrep uses exit code 1 to mean "ran fine, found no matches" — a completely normal outcome — but on a partial-ABI kernel, that combined with the benign partial-enforcement notice already printed to stderr was enough to trigger `SANDBOX_UNAVAILABLE`. A second, independent bug compounded this at the time: the then-bash-backed filesystem search caught every non-aborted bash rejection and replaced it with a generic `SEARCH_FAILED`, discarding the structured `SandboxUnavailableError` a caller would have needed to actually diagnose a real sandbox failure.

Test coverage missed this because fake sandbox providers in the test suite emitted either no runner line at all or an unambiguously fatal one — never a benign runner line immediately followed by a child-controlled nonzero exit — and real-kernel tests self-skip on hosts without a usable Landlock kernel, so the exact ABI condition that triggers the bug was untested on most CI hosts.

**Fix:** the sandbox result type now expresses a real conjunction of evidence instead of a bag of substrings — a `RunnerFailureRule` carries allowed exit codes, per-line fatal signatures, and *exact* (not substring) informational-line exclusions, so a launcher failure requires both a matching exit code and an unambiguous fatal line, not just "contains this prefix." Filesystem search was also moved off the sandboxed bash path entirely, onto packaged ripgrep through the subprocess capability directly. **Guardrail:** a deterministic fake at the native boundary now specifically reproduces "informational notice, then nonzero child exit," plus an assembled snapshot composition that pins this exact scenario end-to-end, independent of real kernel availability. The general lesson: process attribution needs a conjunction of independent evidence, not a shared string prefix — and a self-skipping real-kernel test can never carry a regression alone; it needs a deterministic fake that runs on every host.

## The throughline

All three postmortems, and both cancellation mechanisms above, converge on the same handful of ideas:

- **A result is not one fact; report every independent fact separately** — an exit code and a signal, a launcher failure and a child's own exit, a scheduled retry and a started retry, an aborted-before-dispatch tool call and an aborted-after-dispatch one.
- **Coverage and passing tests prove code ran, not that the shipped behavior is correct** — the only test that would have caught postmortem 0001 or 0002 is one that exercises the *real* Loader path or asserts a *semantic* impossibility, not one that hand-builds the object under test.
- **Cooperative beats coercive for anything that owns real side effects.** Turns and tool calls are asked to stop and awaited to quiescence, never raced against and abandoned — because a caller that reports "done" while side effects are still in flight cannot be trusted for the next decision it makes.

The `docs/defensive-patterns.md` rules and this chapter's postmortems are not a checklist bolted on after the fact — they are the direct output of specific incidents, each one now enforced by a concrete test, a static check, or a type that makes the old mistake impossible to write again.
