# SkillDeck 分阶段实施计划

## Phase 0：环境与契约

状态：`completed`（2026-07-21）

- 已验证 Node、npm、Rust stable、Cargo 和 Xcode。
- 已搭建 Tauri 2 + React/TypeScript/Vite 工程，前端通过 typed `invoke` 调用 Rust。
- 已记录只读来源、配置边界、错误模型、日志规则和测试矩阵。
- 发送路径采用剪贴板模式，不申请 Accessibility，不依赖任何 Agent WebView 是否暴露可写控件。

## Phase 1：只读扫描基础

状态：`completed / verified`（2026-07-22）

- 读取 v1/v2 配置并迁移到 schema v3；保留旧 `libraryPath` 语义。
- 支持 External `<library>/skills` 递归扫描和 frontmatter/fallback 解析。
- 过滤隐藏目录、`.git`、`node_modules`、软链接、损坏链接和无效路径。
- 搜索、标签筛选、详情抽屉、Bundle、加载/错误/空状态和浏览器预览已接通。

## Phase 2：多 Agent 目录与状态模型

状态：`completed / verified`（2026-07-22）

- 内置 Codex、Claude Code、OpenCode、Cursor。
- 根据当前用户 `$HOME` 解析各 Agent 默认全局目录，并支持每个 Agent 一个自定义目录。
- Codex 兼容 `~/.codex/skills` 与 `~/.agents/skills`；OpenCode 兼容其官方全局目录和共享目录。
- 合并多根时按规范化 Skill 文件去重，使用 `<agentId>:<rootType>:<relativePath>` 稳定 ID；同名不同源保留。
- `get_snapshot` 返回四个 Agent 状态、当前 Agent、实际扫描路径和扫描结果。
- 缺失目录返回空状态；非法存在路径返回结构化错误；不因 Agent 应用本体未安装而阻止扫描。

## Phase 3：只读 Prompt Builder 与剪贴板

状态：`completed / verified`（2026-07-22）

- Codex 使用 `$skill-name`；Claude Code/Cursor 使用 `/skill-name`。
- OpenCode 使用明确的 `Use the OpenCode skill tool to load: skill-name` 文本，不伪造未确认的 slash syntax。
- 支持多个 Skill、去重、命令别名、Task 空白校验以及 prefix/suffix 插入。
- 复制前重新扫描并校验当前 Skill；最终只调用剪贴板，不激活、不注入、不提交。
- `mount_skills`、`unmount_skills`、`activate_codex` 兼容入口均由 Rust 返回 `readonly_mode`。

## Phase 4：Agent 切换与完整 UI

状态：`completed / verified`（2026-07-22）

- 顶部 Agent 切换器、当前目录/数量状态和只读标识。
- Settings 支持 Active Agent、每个 Agent 自定义目录、External library、重新扫描、来源状态和只读说明。
- 切换 Agent 后保存设置、重新扫描、清除失效选择/别名并保留 Task。
- 切换到没有可用目录的 Agent 时显示自定义/External 入口，并提供返回上一个 Agent 的按钮，避免误触后被迫重新选择 Skill library。
- Active Skills 页面展示直接来源和旧托管链接提示，不显示挂载操作。

## Phase 5：中英文与 Bundles

状态：`completed / verified`（2026-07-22）

- 无依赖集中式字典覆盖导航、按钮、空/错/加载状态、Settings、Bundles、Toast、aria-label 和提示。
- `system` 根据 `navigator.language` 在简体中文和英文间选择；切换即时更新 `<html lang>`。
- Bundle 绑定 `defaultAgentId`；切到不匹配 Agent 时阻止套用并给出本地化提示。

## Phase 6：测试、打包与设计 QA

状态：`completed / verified`（2026-07-22）

- Rust 单元测试覆盖 scanner、路径安全、配置迁移、只读 mount guard 和 Bundle 配置。
- 前端测试覆盖四种 Prompt 格式和核心编译/构建路径。
- 已完成格式检查、Rust 测试、TypeScript/Vite 检查、生产 Tauri 构建和打包版启动验证。
- `design-qa.md` 记录 Option 1 Command Console 的布局、间距、颜色、字体、交互和中英文状态。
- 当前构建为可运行的 ad-hoc macOS 包；没有 Apple Developer signing identity 时，正式分发签名仍需在有证书的机器/CI 执行。

## 验收命令

```text
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run check
npm run tauri build
```

## macOS 手工验收清单

1. 用真实 Codex、Claude、OpenCode、Cursor 目录启动打包版，分别切换并确认列表和来源路径；切到缺失目录时确认可返回上一个 Agent。
2. 确认标准目录、自定义目录和 External library 都只读扫描；隐藏目录、软链接 Skill 和损坏链接不会进入列表。
3. 选择 Skill 并复制，核对 Codex、Claude Code、Cursor、OpenCode 的 Prompt 格式。
4. 确认不会打开 Agent、注入输入、发送 Enter、自动提交或修改任何 Skill 目录。
5. 确认旧 SkillDeck 托管链接只展示，不被自动删除；未知文件和未知软链接不受影响。
6. 切换中英文，检查 Library、Bundles、Active Skills、Settings、空状态、错误和 Toast。
7. 使用 Option 1 参考图进行桌面布局、间距、颜色、字体、图标和键盘焦点 QA。
8. 只有 `design-qa.md` 标记 `final result: passed` 才可交付。
