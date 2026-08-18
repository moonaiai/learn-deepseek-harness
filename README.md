# learn-deepseek-harness

一个用来系统学习 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 内部架构的双语（中/英）文档库：24 章，5 个模块，不是把包逐个扫一遍，而是围绕这个项目自己最重要的组织概念——**能力接缝（capability seam）**——展开，同时如实讲清楚哪些东西**不是**接缝、为什么不是。

**在线阅读**：<https://moonaiai.github.io/learn-deepseek-harness/>

这不是对源码的复读机式罗列，而是**精引 + 深链**式的讲解：每一章都指向 deepseek-harness 真实源码文件的具体行号（锚定在固定 commit，链接永不失效），并把项目自己的设计记录（`.agents/notes/implemented/` 下的 Agent Note）提炼成每章的"深挖"内容——为什么这样设计、考虑过什么备选方案、为什么拒绝它们。

## 学什么

一个能力接缝（`docs/glossary.md`、`.agents/notes/implemented/architecture/2026-06-13-capability-seams.md`）是 Service Definition + 一或多个 Service Provider + 一或多个 Consumer 三元组——deepseek-harness 用它让能力后端可替换而不影响调用方。课程的组织方式是：先讲清楚**不是接缝的核心脊柱**，再用一整章讲透接缝模式本身，然后按接缝的性质分组做**接缝画廊**，每一组里明确标注哪些是真接缝、哪些故意不是。

| 模块 | 章节 |
|---|---|
| 基石 | s01 Cordis 五个核心概念 · s02 Profile 与 Bundle · s03 会话日志 · s04 Agent Loop · s05 Agent 接口与注册表 · s06 工具管线与提示词组装 · s07 能力接缝模式（以 shell 为例） |
| 执行世界接缝 | s08 文件系统与语言服务器 · s09 子进程与终端 · s10 沙箱 |
| 模型与人机接缝 | s11 LLM 接缝 · s12 Web 接缝 · s13 审批与问答 · s14 todo_write 与 Plan Mode · s15 Hooks 桥接 |
| 扩展与记忆接缝 | s16 Subagent 接缝 · s17 技能接缝 · s18 压缩接缝 · s19 会话持久化接缝 |
| 编排与综合实战 | s20 任务与工作流接缝 · s21 Agent Preset 与自我修改 · s22 MCP 与自动化层 · s23 错误恢复 · s24 综合实战 |

## 每一章的四个阅读层次

- **阅读** — 该章的正文讲解，直接引用真实源码。
- **图解**（旗舰章节）— 一张可分步播放的动态图，把该章的机制一步步走给你看。
- **实战**（旗舰章节）— 一次真实机制的回放，比如一次 bash 调用如何被接缝分派到 local 还是 sandbox 的 provider。
- **深挖** — 该项目自己的设计记录（Agent Note）提炼出的决策清单：为什么这样设计、考虑过什么备选方案、为什么拒绝。

`ctx.permissionPresets`、`schedule`、`mcp-client`、`todo_write`/`plan mode`、hooks 家族——这些看起来像接缝，但项目自己的生成文档（`docs/capability-seams.md`）把它们归为 `core` 或非接缝角色，甚至压根没有 `ctx` key。课程如实讲这些"为什么不需要做成接缝"的例子，而不是把所有东西都硬塞进同一个模式里。

## 本地运行

```sh
cd web
npm install
npm run dev   # http://localhost:3000
```

## 引用锚定

所有源码深链指向 `deepseek-ai/deepseek-harness` 的固定 commit：

```
47f943859bef60e4160492346772ded9b24f765a
```

如需对照最新代码，请自行替换 commit SHA 后跳转。

## 部署

推送到 `main` 分支即自动触发 GitHub Actions 构建并发布到 GitHub Pages（见 `.github/workflows/deploy.yml`）。

## License

MIT
