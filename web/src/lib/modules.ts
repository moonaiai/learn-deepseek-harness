import type { ModuleId, Locale } from "./types";

export interface ModuleMeta {
  id: ModuleId;
  order: number;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  /** Tailwind color family name; used by {@link moduleClasses} to derive every
   * color utility for this module so accent colors stay in one place. */
  color: string;
}

export const MODULES: ModuleMeta[] = [
  {
    id: "foundations",
    order: 1,
    title: { zh: "基石", en: "Foundations" },
    description: {
      zh: "不是接缝的核心脊柱：Cordis 插件内核、Profile/Bundle 组合、事件溯源的会话日志、Turn/Step 驱动、工具调用与提示词组装、以及能力接缝模式本身。",
      en: "The core spine that is deliberately not a seam: the Cordis plugin kernel, profile/bundle composition, the event-sourced session log, the turn/step driver, the tool pipeline and prompt assembly, and the capability-seam pattern itself.",
    },
    color: "blue",
  },
  {
    id: "execution-seams",
    order: 2,
    title: { zh: "执行世界接缝", en: "Execution-World Seams" },
    description: {
      zh: "文件系统与语言服务器、子进程与终端、沙箱——同一个执行世界里可替换的后端家族。",
      en: "Filesystem and language server, subprocess and terminal, sandbox — the swappable backend families sharing one execution world.",
    },
    color: "emerald",
  },
  {
    id: "world-and-collab-seams",
    order: 3,
    title: { zh: "模型与人机接缝", en: "Model & Human Seams" },
    description: {
      zh: "LLM 与 Web 搜索的厂商接缝；审批/问答/Hooks/todo 与 Plan Mode 里，哪些是真接缝、哪些故意不是。",
      en: "The vendor seams for LLM and web search; and, in approval, questions, hooks, and todo/plan mode, which are genuine seams and which are deliberately not.",
    },
    color: "purple",
  },
  {
    id: "extension-memory-seams",
    order: 4,
    title: { zh: "扩展与记忆接缝", en: "Extension & Memory Seams" },
    description: {
      zh: "Subagent、技能加载、上下文压缩、会话持久化——Provider 分叉最宽的一组接缝。",
      en: "Subagents, skill loading, context compaction, session persistence — the seams with the widest provider fan-out.",
    },
    color: "amber",
  },
  {
    id: "orchestration-and-capstone",
    order: 5,
    title: { zh: "编排与综合实战", en: "Orchestration & Capstone" },
    description: {
      zh: "后台任务与工作流接缝、Agent Preset 与自我修改、MCP 与自动化层、错误恢复、以及跑通 dsh --profile headless 的综合实战。",
      en: "Background-work and workflow seams, agent presets and self-modification, MCP and the automation layer, error recovery, and a hands-on capstone running dsh --profile headless.",
    },
    color: "rose",
  },
];

export function getModule(id: ModuleId): ModuleMeta {
  const found = MODULES.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown module id: ${id}`);
  return found;
}

interface ModuleClassSet {
  chip: string;
  border: string;
  icon: string;
  activeBg: string;
  dot: string;
}

const CLASS_TABLE: Record<string, ModuleClassSet> = {
  blue: {
    chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20",
    border: "border-blue-500/40",
    icon: "text-blue-600 dark:text-blue-400",
    activeBg: "bg-blue-500/10 dark:bg-blue-500/15",
    dot: "bg-blue-500",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20",
    border: "border-emerald-500/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    activeBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    dot: "bg-emerald-500",
  },
  purple: {
    chip: "bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/20",
    border: "border-purple-500/40",
    icon: "text-purple-600 dark:text-purple-400",
    activeBg: "bg-purple-500/10 dark:bg-purple-500/15",
    dot: "bg-purple-500",
  },
  amber: {
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20",
    border: "border-amber-500/40",
    icon: "text-amber-600 dark:text-amber-400",
    activeBg: "bg-amber-500/10 dark:bg-amber-500/15",
    dot: "bg-amber-500",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20",
    border: "border-rose-500/40",
    icon: "text-rose-600 dark:text-rose-400",
    activeBg: "bg-rose-500/10 dark:bg-rose-500/15",
    dot: "bg-rose-500",
  },
};

/** The single source of every module accent color, so no component redeclares its own palette map. */
export function moduleClasses(id: ModuleId): ModuleClassSet {
  const color = getModule(id).color;
  const set = CLASS_TABLE[color];
  if (!set) throw new Error(`No class table entry for color: ${color}`);
  return set;
}
