# SkillDeck 架构

## 技术栈

- Desktop shell：Tauri 2 / Rust / macOS native window
- UI：React 19 + TypeScript + Vite
- UI primitives：Tailwind CSS v4 + shadcn/ui primitives
- Icons：Phosphor Icons
- Client state：Zustand
- Local persistence：Rust `serde_json` + atomic temp-file replacement

## 模块边界

```text
React view
  -> Zustand state
    -> src/services/* (typed application service)
      -> Tauri invoke command
        -> Rust config / skills / agents modules
          -> read-only local filesystem

Prompt Builder
  -> clipboard command
    -> user manually pastes and submits in the selected Agent
```

前端不得拼接 shell 命令、直接读取 Skill 内容或把原始 Rust panic/stack trace 展示给用户。Skill 内容只由 Rust 在扫描时读取，并只返回用于详情/预览的受限文本；配置、Bundle 和日志不保存完整 Skill 内容、Task 文本或环境变量。

## 当前目录

```text
src/
  components/       # Library、Prompt、Bundles、Active、Settings 与详情抽屉
  data/              # 浏览器预览的 sample data
  services/         # Tauri bridge、Prompt Builder 与剪贴板
  stores/            # Zustand application state
  i18n.ts            # 无依赖的中英文集中式字典
  types.ts           # 与 Rust camelCase JSON 对齐的类型
src-tauri/src/
  models.rs          # v3 DTO、设置、扫描、错误与 legacy command DTO
  config.rs          # Application Support 配置、Bundle 和原子写入
  skills.rs          # 只读扫描、frontmatter 解析和路径校验
  agents.rs          # 四 Agent 目录解析、合并扫描和只读 legacy mount guard
  lib.rs             # typed commands 与插件注册
```

## 核心数据流

1. `get_snapshot` 读取 v3 settings，并返回 `agents`、`activeAgent`、`scan` 和 `effectiveLibraryPaths`。
2. Agent 模式由 Rust 根据 Agent ID 解析标准目录与一个自定义目录；缺失目录不阻塞其它根，非法实际路径返回结构化错误。
3. External 模式只验证 `<library>/skills` 并扫描该目录；它不再创建或删除链接。
4. Rust 使用 `WalkDir::follow_links(false)`，忽略隐藏目录、`.git`、`node_modules`，解析 `SKILL.md` 并返回 `ScanResult`。
5. 多根 Agent 扫描用 `<agentId>:<rootType>:<relativePath>` 生成稳定 ID，并按规范化 `skill_file_path` 去重；同名不同源保留。
6. UI 只在内存中做搜索、标签筛选和选中状态。Bundle 保存 Skill ID、可选命令别名和 `defaultAgentId`，不保存 Skill 内容。
7. 复制流程重新扫描当前来源、校验当前 Skill ID、按 Agent 生成 Prompt，然后调用剪贴板 command。没有 mount、unmount、activate、Accessibility 或 submit 分支。
8. 监听设置开启时只轮询当前来源的扫描 command；扫描结果更新不会写回来源目录。

## Agent 与 command contract

```ts
type AgentId = "codex" | "claude" | "opencode" | "cursor"
type Locale = "system" | "zh-CN" | "en"

interface AgentAdapter {
  detect(): Promise<AgentDetectionResult>
  scan(): Promise<ScanResult>
  buildInvocation(skillNames: string[]): string
}

interface AppSnapshot {
  settings: AppSettings
  scan?: ScanResult | null
  effectiveLibraryPaths: string[]
  agents: AgentStatus[]
  activeAgent: AgentStatus
}
```

主要 Tauri commands 为 `get_snapshot`、`scan_agent_skills`、`scan_library`、`save_settings`、Bundle commands 和 clipboard command。`mount_skills`、`unmount_skills`、`activate_codex` 等旧 command 仍保留兼容入口，但 Rust 直接返回 `readonly_mode`，不得触碰文件系统或启动 Agent。

## 状态切换

```text
Agent source
  -> scan selected Agent roots
  -> display direct read-only state

External source
  -> validate <library>/skills
  -> scan and display read-only state

Agent change
  -> persist activeAgentId
  -> rescan
  -> remove unavailable selected IDs and aliases
  -> keep Task text
```

所有持久化只发生在 SkillDeck 自己的 Application Support 目录；来源目录永远不作为写入目标。
