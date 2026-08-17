# learn-deepseek-harness

深入 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 内部架构的双语（中/英）课程：20 章，5 个模块，从 Cordis 插件内核到 Agent Loop、工具调用管线、能力接缝、Subagent、技能加载、上下文压缩、后台任务、自我修改与 MCP/ACP 自动化层。

**在线阅读**：<https://moonaiai.github.io/learn-deepseek-harness/>

这不是对 deepseek-harness 源码的复刻，而是**精引 + 深链**式的讲解：每一章都指向真实源码文件的具体行号（锚定在固定 commit，链接永不失效），配合忠实转译自项目自身文档（`docs/*.md`、`.agents/notes/*`、`docs/postmortem/*`）的架构图与叙述。

## 课程大纲

| 模块 | 章节 |
|---|---|
| 基石 | s01 Cordis 五个核心概念 · s02 一切皆插件：Profile 与 Bundle · s03 会话日志：事件溯源 |
| 核心循环 | s04 Turn/Step：Agent Loop 剖析 · s05 Agent 接口与注册表 · s06 工具调用管线 · s07 系统提示词组装 · s08 能力接缝 |
| 人机协作 | s09 权限与审批 · s10 Hooks 桥接 · s11 todo_write 与 Plan Mode |
| 扩展与记忆 | s12 Subagent · s13 技能加载 · s14 上下文压缩 · s15 记忆与持久化 · s16 错误恢复与防御式模式 |
| 自治与运维 | s17 后台任务：Jobs/Schedule/Workflow · s18 Agent Preset 与自我修改 · s19 MCP 与 SDK/ACP · s20 综合实战 |

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

- `content/sNN-slug/README.zh.md` / `README.md`（中英文双版本，统一 frontmatter：`title`、`summary`、`module`、`order`、`sources`）。
- `web/` 是渲染基座：Next.js 16（App Router，静态导出）+ Tailwind v4 + `unified`/`remark`/`rehype` Markdown 管线 + Mermaid 图 + Minisearch 全文搜索 + 本地阅读进度追踪。

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
