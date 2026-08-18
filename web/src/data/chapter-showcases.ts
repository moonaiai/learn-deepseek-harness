import type { StepDiagramData } from "@/components/diagram/step-diagram";
import type { SeamScenario } from "@/hooks/use-seam-simulator";

/**
 * Per-chapter showcase registry: a fixed set of "flagship" chapters get a
 * {@link StepDiagramData} and/or {@link SeamScenario} rendered above their
 * prose body. Every other chapter renders through the plain Markdown+Mermaid
 * baseline — this is intentionally NOT a blanket replacement of every
 * chapter's diagrams, only the handful where a stepped walkthrough earns its
 * complexity. Keyed by chapter slug (see `content/chapters/*`).
 *
 * Every node label, event name, and provider name here must be traceable to
 * the corresponding chapter's own `sources` citations — this file is
 * illustrative UI data, not a place to invent facts not established in the
 * prose.
 */
export interface ChapterShowcase {
  diagram?: StepDiagramData;
  simulator?: SeamScenario;
}

export const CHAPTER_SHOWCASES: Record<string, ChapterShowcase> = {
  "s04-agent-loop": {
    diagram: {
      width: 460,
      height: 360,
      nodes: [
        { id: "turn_start", label: "turn/start", x: 230, y: 24, width: 140, height: 32 },
        { id: "claim", label: "claim input", x: 230, y: 76, width: 140, height: 32 },
        { id: "pre_step", label: "agent/pre-step", x: 230, y: 128, width: 150, height: 32, shape: "diamond" },
        { id: "step_start", label: "step/start", x: 100, y: 188, width: 120, height: 32 },
        { id: "request", label: "agent/request → llm/stream", x: 100, y: 240, width: 170, height: 36 },
        { id: "tool_calls", label: "tool/call* dispatch", x: 100, y: 292, width: 150, height: 32 },
        { id: "step_end", label: "step/end", x: 100, y: 336, width: 110, height: 28 },
        { id: "turn_stopping", label: "agent/turn-stopping", x: 360, y: 188, width: 160, height: 32 },
        { id: "turn_end", label: "turn/end", x: 360, y: 240, width: 110, height: 28 },
      ],
      edges: [
        { from: "turn_start", to: "claim" },
        { from: "claim", to: "pre_step" },
        { from: "pre_step", to: "step_start", label: "enter" },
        { from: "step_start", to: "request" },
        { from: "request", to: "tool_calls" },
        { from: "tool_calls", to: "step_end" },
        { from: "step_end", to: "pre_step", label: "loop" },
        { from: "pre_step", to: "turn_stopping", label: "reject / nothing owed" },
        { from: "turn_stopping", to: "turn_end" },
      ],
      steps: [
        {
          activeNodeIds: ["turn_start"],
          activeEdgeIds: [],
          title: "turn/start",
          desc: "A turn opens before any input is claimed.",
        },
        {
          activeNodeIds: ["claim"],
          activeEdgeIds: ["turn_start->claim"],
          title: "claim input",
          desc: "The driver claims the next-step input plus one queued message.",
        },
        {
          activeNodeIds: ["pre_step"],
          activeEdgeIds: ["claim->pre_step"],
          title: "agent/pre-step waterfall",
          desc: "Listeners may reject the proposed step or let it enter.",
        },
        {
          activeNodeIds: ["step_start", "request"],
          activeEdgeIds: ["pre_step->step_start", "step_start->request"],
          title: "step/start → agent/request",
          desc: "Prompt and tool schemas assemble; the model streams a response.",
        },
        {
          activeNodeIds: ["tool_calls", "step_end"],
          activeEdgeIds: ["request->tool_calls", "tool_calls->step_end"],
          title: "tool/call* → step/end",
          desc: "Tool calls dispatch through the guarded pipeline; the step closes.",
        },
        {
          activeNodeIds: ["pre_step"],
          activeEdgeIds: ["step_end->pre_step"],
          title: "loop back",
          desc: "If more is owed, pre-step runs again for the next step.",
        },
        {
          activeNodeIds: ["turn_stopping", "turn_end"],
          activeEdgeIds: ["pre_step->turn_stopping", "turn_stopping->turn_end"],
          title: "turn/end",
          desc: "Once nothing is owed, the turn closes.",
        },
      ],
    },
    simulator: {
      title: "One turn, traced as a replay",
      description: "A simplified single-step turn: one model request, one tool call, one result.",
      steps: [
        {
          type: "request",
          content: "user/message: \"list the files in src/\"",
          annotation: "Claimed as this turn's first input.",
        },
        {
          type: "dispatch",
          content: "agent/pre-step -> enter(messages)",
          annotation: "No listener rejects; the step is admitted.",
        },
        {
          type: "provider_selected",
          content: "assemble prompt sections + tool schemas",
          annotation: "system-prompt/assemble waterfall runs before the request.",
          providerName: "ctx.systemPrompt",
        },
        {
          type: "provider_execute",
          content: "tool/call: bash({ command: \"ls src/\" })",
          annotation: "The model's tool call enters the guarded execution pipeline.",
        },
        {
          type: "result",
          content: "tool/result: \"agent-loop.ts\\ntool-calls.ts\\n...\"",
          annotation: "step/end, then turn/end since nothing more is owed.",
        },
      ],
    },
  },

  "s07-capability-seams-primer": {
    diagram: {
      width: 420,
      height: 260,
      nodes: [
        { id: "definition", label: "ShellExecutor\n(Service Definition)", x: 210, y: 40, width: 200, height: 44 },
        { id: "provider_local", label: "dsh-bash-local", x: 110, y: 130, width: 140, height: 40 },
        { id: "provider_sandbox", label: "dsh-bash-sandbox", x: 310, y: 130, width: 150, height: 40 },
        { id: "consumer", label: "dsh-tool-bash\n(Consumer)", x: 210, y: 220, width: 160, height: 44 },
      ],
      edges: [
        { from: "definition", to: "provider_local", label: "implements" },
        { from: "definition", to: "provider_sandbox", label: "implements" },
        { from: "provider_local", to: "consumer" },
        { from: "provider_sandbox", to: "consumer" },
      ],
      steps: [
        {
          activeNodeIds: ["definition"],
          activeEdgeIds: [],
          title: "Service Definition",
          desc: "ShellExecutor owns ctx.shell and the vocabulary — never a bare interface.",
        },
        {
          activeNodeIds: ["provider_local"],
          activeEdgeIds: ["definition->provider_local"],
          title: "Provider: local",
          desc: "dsh-bash-local runs bash through real subprocesses.",
        },
        {
          activeNodeIds: ["provider_sandbox"],
          activeEdgeIds: ["definition->provider_sandbox"],
          title: "Provider: sandboxed",
          desc: "dsh-bash-sandbox wraps the same argv through ctx.sandbox.",
        },
        {
          activeNodeIds: ["consumer"],
          activeEdgeIds: ["provider_local->consumer", "provider_sandbox->consumer"],
          title: "Consumer",
          desc: "dsh-tool-bash injects ctx.shell by key — never a provider-specific type.",
        },
      ],
    },
    simulator: {
      title: "One bash call, two possible providers",
      description: "The same tool call dispatched through whichever provider is mounted — the consumer never changes.",
      steps: [
        {
          type: "request",
          content: "tool/call: bash({ command: \"npm test\" })",
          annotation: "dsh-tool-bash injects ctx.shell by key, not by provider type.",
        },
        {
          type: "dispatch",
          content: "ctx.shell.run(request)",
          annotation: "The registry doesn't know or care which provider is mounted.",
        },
        {
          type: "provider_selected",
          content: "resolved provider: dsh-bash-sandbox",
          annotation: "Whichever provider this deployment mounted at boot.",
          providerName: "dsh-bash-sandbox",
        },
        {
          type: "provider_execute",
          content: "spawn through ctx.subprocess, confined via ctx.sandbox",
          annotation: "The exact same argv a local executor would run, now fenced.",
          providerName: "dsh-bash-sandbox",
        },
        {
          type: "result",
          content: "tool/result: exit 0, stdout captured",
          annotation: "dsh-tool-bash's own source never changed for this swap.",
        },
      ],
    },
  },

  "s16-subagent-seam": {
    diagram: {
      width: 460,
      height: 260,
      nodes: [
        { id: "registry", label: "SubagentRuntime\n(ctx.subagents)", x: 230, y: 36, width: 220, height: 44 },
        { id: "spawn", label: "spawn", x: 60, y: 130, width: 90, height: 36 },
        { id: "fork", label: "fork", x: 160, y: 130, width: 90, height: 36 },
        { id: "acp", label: "acp", x: 260, y: 130, width: 90, height: 36 },
        { id: "claude_code", label: "claude-code", x: 370, y: 130, width: 110, height: 36 },
        { id: "consumer", label: "dsh-tool-subagent", x: 230, y: 220, width: 180, height: 40 },
      ],
      edges: [
        { from: "registry", to: "spawn" },
        { from: "registry", to: "fork" },
        { from: "registry", to: "acp" },
        { from: "registry", to: "claude_code" },
        { from: "spawn", to: "consumer" },
        { from: "fork", to: "consumer" },
        { from: "acp", to: "consumer" },
        { from: "claude_code", to: "consumer" },
      ],
      steps: [
        {
          activeNodeIds: ["registry"],
          activeEdgeIds: [],
          title: "Named-provider registry",
          desc: "registerProvider(name, provider) — a duplicate name fails loud.",
        },
        {
          activeNodeIds: ["spawn", "fork"],
          activeEdgeIds: ["registry->spawn", "registry->fork"],
          title: "In-process: spawn vs. fork",
          desc: "Two providers, not one flag — fork alone inherits parent history.",
        },
        {
          activeNodeIds: ["acp", "claude_code"],
          activeEdgeIds: ["registry->acp", "registry->claude_code"],
          title: "Out-of-process providers",
          desc: "acp / codex / claude-code spawn a real separate product's runtime.",
        },
        {
          activeNodeIds: ["consumer"],
          activeEdgeIds: ["spawn->consumer", "fork->consumer", "acp->consumer", "claude_code->consumer"],
          title: "One tool, one bound provider",
          desc: "Each dsh-tool-subagent instance binds to exactly one provider name.",
        },
      ],
    },
  },
};

export function getChapterShowcase(slug: string): ChapterShowcase | undefined {
  return CHAPTER_SHOWCASES[slug];
}
