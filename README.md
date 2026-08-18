# learn-deepseek-harness

深入 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 内部架构的双语（中/英）课程：24 章，5 个模块，围绕这个项目自己的核心组织概念——**能力接缝（capability seam）**——展开，而不是按子系统逐个扫一遍。

**在线阅读**：<https://moonaiai.github.io/learn-deepseek-harness/>

## 组织方式：能力接缝画廊，而非子系统清单

一个能力接缝（`docs/glossary.md`、`.agents/notes/implemented/architecture/2026-06-13-capability-seams.md`）是 Service Definition + 一或多个 Service Provider + 一或多个 Consumer 三元组——deepseek-harness 用它让能力后端可替换而不影响调用方。本课程先讲清楚**不是接缝的核心脊柱**（Cordis、Profile/Bundle、会话日志、Turn/Step 循环、工具管线与提示词组装），再用一整章讲透接缝模式本身（以 shell 接缝为范例），然后按接缝性质分组做**接缝画廊**：

| 模块 | 章节 |
|---|---|
| 基石 | s01 Cordis 五个核心概念 · s02 Profile 与 Bundle · s03 会话日志 · s04 Agent Loop · s05 Agent 接口与注册表 · s06 工具管线与提示词组装 · s07 能力接缝模式（以 shell 为例） |
| 执行世界接缝 | s08 文件系统与语言服务器 · s09 子进程与终端 · s10 沙箱 |
| 模型与人机接缝 | s11 LLM 接缝 · s12 Web 接缝 · s13 审批与问答 · s14 todo_write 与 Plan Mode · s15 Hooks 桥接 |
| 扩展与记忆接缝 | s16 Subagent 接缝 · s17 技能接缝 · s18 压缩接缝 · s19 会话持久化接缝 |
| 编排与综合实战 | s20 任务与工作流接缝 · s21 Agent Preset 与自我修改 · s22 MCP 与自动化层 · s23 错误恢复 · s24 综合实战 |

**每一章都明确标注它讲的机制是不是真接缝**：`ctx.permissionPresets`、`schedule`、`mcp-client`、todo_write/plan mode、hooks 家族——这些看起来像接缝，但项目自己的生成文档（`docs/capability-seams.md`）把它们归为 `core`/非接缝角色,或它们压根没有 `ctx` key。课程如实讲这些"为什么不需要做成接缝"的例子，而不是把所有东西都塞进同一个模式里。

这不是对 deepseek-harness 源码的复刻，而是**精引 + 深链**式的讲解：每一章都指向真实源码文件的具体行号（锚定在固定 commit，链接永不失效）。

## 渲染基座：三个可交互组件

- **StepDiagram** — 分步动态 SVG 图解，播放/暂停/单步/重置控制，节点与边随步骤高亮变色（Motion 驱动过渡动画），边的路由由通用算法自动计算（不逐图手写坐标）。用于 s04（Turn/Step 时序）、s07（Definition/Provider/Consumer 三元组结构）、s16（Subagent 委派家族）等章节。
- **SeamSimulator** — 可回放的时间线模拟器，逐条消息浮现回放一次真实机制（如一次 bash 调用如何被接缝分派到 local/sandbox provider），播放速度可调。
- **SourceViewer** — 终端风格源码摘录：macOS 红绿灯头部 + 行号 + 语法高亮。高亮渲染复用既有的 `rehype-highlight` 管线（而非手写 TS 分词器——TypeScript 语法远比原型参考项目的 Python 复杂，手搓分词器质量必然更差），只负责外观复刻。

## 本地运行

```sh
cd web
npm install
npm run dev   # http://localhost:3000
```

```sh
npm run build   # 静态导出到 web/out/
```

## 内容组织

- `content/chapters/sNN-slug/README.zh.md` / `README.md`（中英文双版本，统一 frontmatter：`title`、`summary`、`module`、`order`、`sources`）——详见 `content/README.md` 的写作纪律。
- `web/` 是渲染基座：Next.js 16（App Router，静态导出）+ Tailwind v4 + `unified`/`remark`/`rehype` Markdown 管线 + Mermaid 图 + Minisearch 全文搜索 + 本地阅读进度追踪 + 上述三个可交互组件。

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
