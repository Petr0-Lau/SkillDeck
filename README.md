# SkillDeck

SkillDeck is a local macOS Skill console for AI Agents. It scans Skill libraries in read-only mode, helps you search and select Skills, builds Agent-native prompts, and copies them to the clipboard.

SkillDeck does not mount, delete, execute, activate, inject into, or auto-submit to any Agent.

## Features

- Codex, Claude Code, OpenCode, and Cursor support
- Global and custom Skill directory scanning
- External library scanning with the same read-only behavior
- Search, tag filtering, Skill details, Bundles, and Agent switching
- Codex `$skill-name`, Claude/Cursor `/skill-name`, and OpenCode tool instructions
- Chinese / English UI with a System language option
- macOS clipboard delivery only; no Accessibility permission is required

## Standard directories

Directories are resolved from the current user's `$HOME`; the app does not depend on a hard-coded user path.

| Agent | Standard Skill directories |
| --- | --- |
| Codex | `~/.codex/skills`, `~/.agents/skills` |
| Claude Code | `~/.claude/skills` |
| OpenCode | `~/.config/opencode/skills`, `~/.claude/skills`, `~/.agents/skills` |
| Cursor | `~/.cursor/skills`, `~/.agents/skills` |

Only real directories are scanned. Hidden directories, `.git`, `node_modules`, Skill directories that are symbolic links, and project-local directories are ignored.

## Development

Requirements: macOS, Node.js/npm, Rust, and Xcode Command Line Tools.

```bash
npm install
npm run tauri dev
```

The browser preview uses sample data and never reads or modifies a local Skill library:

```bash
npm run dev
```

## Verification

```bash
npm run check
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

See the implementation and safety details in:

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Design QA](design-qa.md)

## 中文说明

SkillDeck 是一个面向 macOS 的本地 AI Agent Skill 控制台。它以只读方式扫描 Skill 库，支持搜索、筛选、选择 Skill，生成对应 Agent 的调用文本，并复制到剪贴板。

SkillDeck 不会挂载、删除、执行 Skill，不会自动打开 Agent、注入文本或提交任务。

### 功能

- 支持 Codex、Claude Code、OpenCode 和 Cursor
- 支持全局 Skill 目录、自定义目录和 External library
- 支持搜索、标签筛选、Skill 详情、Bundles 和 Agent 切换
- 支持各 Agent 对应的调用格式
- 支持系统语言、简体中文和 English
- 只复制到 macOS 剪贴板，不需要 Accessibility 权限

### 默认目录

应用根据当前用户的 `$HOME` 解析目录，不依赖固定的 `/Users/...` 路径。

| Agent | 默认 Skill 目录 |
| --- | --- |
| Codex | `~/.codex/skills`、`~/.agents/skills` |
| Claude Code | `~/.claude/skills` |
| OpenCode | `~/.config/opencode/skills`、`~/.claude/skills`、`~/.agents/skills` |
| Cursor | `~/.cursor/skills`、`~/.agents/skills` |

应用只读取真实目录；隐藏目录、`.git`、`node_modules`、软链接 Skill 和项目目录不会被扫描。

### 开发与验证

环境要求：macOS、Node.js/npm、Rust 和 Xcode Command Line Tools。

```bash
npm install
npm run tauri dev
```

浏览器预览使用内置样例数据，不会读取或修改本地 Skill 库：

```bash
npm run dev
```

验证命令：

```bash
npm run check
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

详细说明请查看上面的产品规格、架构、安全模型、实施计划和设计 QA 文档。
