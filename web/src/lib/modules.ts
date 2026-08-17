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
      zh: "Cordis 插件内核、Profile/Bundle 组合、事件溯源的会话日志。",
      en: "The Cordis plugin kernel, profile/bundle composition, and the event-sourced session log.",
    },
    color: "blue",
  },
  {
    id: "loop",
    order: 2,
    title: { zh: "核心循环", en: "Core Loop" },
    description: {
      zh: "Turn/Step 驱动、Agent 接口、工具调用管线、系统提示词、能力接缝。",
      en: "The turn/step driver, the agent interface, the tool pipeline, system prompts, and capability seams.",
    },
    color: "emerald",
  },
  {
    id: "collab",
    order: 3,
    title: { zh: "人机协作", en: "Human Collaboration" },
    description: {
      zh: "权限与审批、Hooks 桥接、todo_write 与 Plan Mode。",
      en: "Permissions and approval, hook bridges, todo_write, and plan mode.",
    },
    color: "purple",
  },
  {
    id: "memory",
    order: 4,
    title: { zh: "扩展与记忆", en: "Extension & Memory" },
    description: {
      zh: "Subagent 委派、技能加载、上下文压缩、持久化与错误恢复。",
      en: "Subagent delegation, skill loading, context compaction, persistence, and error recovery.",
    },
    color: "amber",
  },
  {
    id: "ops",
    order: 5,
    title: { zh: "自治与运维", en: "Autonomy & Operations" },
    description: {
      zh: "后台任务、Agent Preset、自我修改、MCP/SDK/ACP、综合实战。",
      en: "Background work, agent presets, self-modification, MCP/SDK/ACP, and a hands-on capstone.",
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
