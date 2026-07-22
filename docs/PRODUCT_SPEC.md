# SkillDeck 产品规格

## 产品定位

SkillDeck 是一个本地 macOS Skill 控制台。它按当前用户选择的 Agent 读取全局 Skill 目录，也支持选择一个外部 Skill library；用户可以搜索、筛选、组合 Skill，生成该 Agent 对应的调用文本并复制到剪贴板。

SkillDeck 是只读浏览器和 Prompt Builder：不安装、不编辑、不执行 Skill，不打开 Agent，不注入输入框，不提交任务，也不创建或删除软链接。

## 内置 Agent 与默认来源

首批内置 Agent 为 Codex、Claude Code、OpenCode 和 Cursor。所有路径都基于当前用户的 `$HOME` 解析，不依赖开发者机器上的绝对路径。

| Agent | 默认全局目录 | 调用格式 |
| --- | --- | --- |
| Codex | `~/.codex/skills`、`~/.agents/skills` | `$skill-name` |
| Claude Code | `~/.claude/skills` | `/skill-name` |
| OpenCode | `~/.config/opencode/skills`、`~/.claude/skills`、`~/.agents/skills` | `Use the OpenCode skill tool to load: skill-name` |
| Cursor | `~/.cursor/skills`、`~/.agents/skills` | `/skill-name` |

用户可以为每个 Agent 配置一个自定义目录。自定义目录采用 `custom-root/skill-name/SKILL.md` 结构；不自动扫描项目目录，也不因为 Agent 桌面应用未安装而阻止读取 Skill。

## 不可破坏的边界

- Agent 目录和 External library 均为只读来源；SkillDeck 只写自己的配置、Bundle 和日志到 `~/Library/Application Support/SkillDeck/`。
- 扫描不跟随软链接，忽略隐藏目录、`.git` 和 `node_modules`，不执行 `SKILL.md` 或附属脚本。
- 根目录必须是真实目录。缺失的标准目录会显示为空状态；存在但不是实际目录时返回结构化错误。
- 多个兼容目录中同一 `SKILL.md` 只保留一份；同名但不同源的 Skill 保留显示，并标明来源。
- Agent Skill ID 使用稳定虚拟前缀 `<agentId>:<rootType>:<relativePath>`；External ID 继续使用相对 `<library>/skills` 根目录的路径。
- React 只调用 typed Tauri commands/application services；所有路径和配置合法性由 Rust 重新校验。
- 复制成功只代表文本进入剪贴板，不代表 Agent 已打开或任务已提交。

## v3 默认值

| 设置 | 默认值 |
| --- | --- |
| `schemaVersion` | `3` |
| `locale` | `system`（中文系统为简体中文，其它系统为英文） |
| `activeAgentId` | `codex` |
| `libraryMode` | `agent` |
| `insertionMode` | `prefix` |
| 发送方式 | 剪贴板 |
| 文件监听 | 关闭 |
| 外观 | 深色 |
| 来源可写操作 | 禁止 |

## 主要流程

1. 读取并迁移本地 v1/v2 配置到 v3。旧配置有 `libraryPath` 时迁移为 External，没有时迁移为 Agent。
2. 根据保存的 `activeAgentId` 由 Rust 解析标准目录和该 Agent 的自定义目录。
3. 只读扫描并合并 Skill，去重后返回 Skill、来源、预览和警告。
4. UI 在内存中完成搜索、标签筛选、选择和详情展示。
5. Prompt Builder 重新验证当前选择，按 Agent 生成调用文本，应用前缀/后缀插入位置后写入剪贴板。
6. Agent 切换会保存设置、重新扫描、清理失效选择并保留 Task 文本；误切换到无目录 Agent 时可返回上一个 Agent，不必被迫选择 Skill 库。

## 产品范围

包含四个内置 Agent、全局/自定义目录扫描、External library 浏览、搜索、标签筛选、详情抽屉、Agent-native Prompt Builder、Bundles、本地 JSON 设置、快捷键、监听轮询、错误/空状态和中英文 UI。

不包含 Skill 编辑器、安装器、在线市场、云同步、账号、遥测、执行脚本、软链接挂载、Accessibility 注入、Agent 自动控制或自动提交任务。
