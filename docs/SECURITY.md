# SkillDeck 安全设计

## 信任边界

Skill 来源内容是不可信输入。SkillDeck 只读取 Markdown/frontmatter 和有限预览，不执行 `SKILL.md`、脚本、命令或引用资源。Agent 桌面应用、外部仓库和本地配置均属于本机边界；网络、云同步、账号和遥测不在范围内。

## 来源与路径

- 标准来源由 Rust 基于当前用户 `$HOME` 解析：Codex `~/.codex/skills`/`~/.agents/skills`、Claude `~/.claude/skills`、OpenCode `~/.config/opencode/skills`/兼容目录、Cursor `~/.cursor/skills`/`~/.agents/skills`。
- 用户配置的每个 Agent 自定义目录和 External library 必须由 Rust 重新校验。
- External library 必须 canonicalize 成功，且真实的 `skills/` 子目录存在；Agent 根目录必须是真实目录，根目录软链接或文件直接返回结构化错误。
- 所有扫描使用 `WalkDir::follow_links(false)`；软链接、损坏链接、隐藏目录、`.git` 和 `node_modules` 均跳过，不产生递归软链接循环。
- Skill ID 只能表达根目录内的相对路径。名称拒绝路径分隔符、`..` 和非法命令字符；前端传入的 ID 在 Rust 重新验证。
- 多个兼容目录通过规范化文件路径去重；同名但不同源的 Skill 不覆盖，保留并携带来源标记。

## 只读保证

- Agent 目录和 External library 永远只读。SkillDeck 不创建、删除、更新或重命名其中任何文件。
- 旧版本留下的 SkillDeck 托管链接只读取并展示；不会自动清理、卸载或覆盖未知文件/软链接。
- `mount_skills` 与 `unmount_skills` 为兼容旧 UI 保留，但 Rust 统一返回 `readonly_mode`，调用前后都不得进行文件系统修改。
- `activate_codex` 为兼容旧调用保留，但返回 `readonly_mode`，不会调用 `open -b`，不会打开、激活或控制任何 Agent。
- 复制流程只写系统剪贴板。不会读取或写入 Agent WebView，不申请 Accessibility 权限，不发送 Enter，不自动提交任务。

## 配置和日志

配置、Bundle 和日志写入 `~/Library/Application Support/SkillDeck/`，配置使用 schema version 和临时文件原子替换；保存失败时保留旧文件。不会写回任何 Skill 来源目录。

日志只记录操作名、数量、错误码和必要的路径摘要，不记录完整 Skill 内容、Task 文本、Prompt、凭据、环境变量或原始堆栈。结构化错误只向 UI 暴露稳定的 `code`、用户可理解的 `message` 和必要的非敏感细节。

## 变更风险

当前代码仍保留 legacy mount DTO 和 command 名称，以避免旧前端调用直接崩溃；后端 guard 是实际安全边界。未来删除兼容 command 前，必须先确认没有旧版本 UI 或本地脚本依赖它们。
