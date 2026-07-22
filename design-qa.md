# SkillDeck design QA

## Scope

多 Agent 只读版本与选定的 Option 1 Command Console 参考图对比。参考图为设计阶段的本地素材，不随仓库发布。

参考图比例保持约 `1487 × 1058`；浏览器预览和 Tauri 窗口均不强行拉伸视觉方向。

## Evidence

- Browser preview：`http://127.0.0.1:1420/`
- Reference-size viewport：`1487 × 1058`
- Minimum Tauri window viewport：`960 × 680`
- Native Tauri startup：当前构建成功启动并保持运行；native decorations 由 Tauri 保留。
- Browser console：最终 reload 无 error/warning。
- Library、Bundles、Active Skills、Settings 均完成参考尺寸检查。
- 四个 Agent 切换器、来源状态、只读说明和中英文设置均在 UI 中可见。
- Codex、Claude Code、Cursor、OpenCode Prompt Builder 测试覆盖了各自调用格式。
- 只读 guard 已覆盖 legacy `mount_skills`、`unmount_skills` 和 `activate_codex`，这些入口不会修改文件系统或启动 Agent。
- 真实 Skill 目录扫描使用当前用户 `$HOME`，不依赖固定用户路径；软链接 Skill 保持排除。
- 当前机器实际存在 Codex 目录；Claude、OpenCode、Cursor 的标准目录当前不存在，因此它们的缺失目录状态由 Rust 扫描测试和浏览器交互验收覆盖，不把本机未安装状态误判为实现缺陷。

## Mismatch ledger

| Area | Reference expectation | Implemented result | Decision |
| --- | --- | --- | --- |
| Shell | Dark native console with graphite surfaces and amber primary action | Same token system, native decorations enabled in Tauri config | Pass |
| Split | Approximately even library / command columns | `grid-cols-2` with a bordered divider | Pass |
| Library | Search, card-based Skill list, tags, add affordance | Search, tag filter, rescanning, tagged cards and selection state | Pass |
| Command panel | Selected skills, optional task, preview and delivery CTA | Same hierarchy; CTA copies only and never submits | Pass |
| Navigation | Library / Bundles / Active Skills / Settings footer | All four routes respond and retain the console hierarchy | Pass |
| Agent switching | Current Agent and source state should be obvious | Header switcher, count/status pill, source paths and Settings controls are explicit | Pass |
| Read-only state | No mount controls or implied activation | Active Skills and Settings state that sources are read-only; legacy links are display-only | Pass |
| Bundles | Compact command-console workflow | Saved sets, aliases and Agent compatibility fit the existing graphite/amber surface | Pass |
| Internationalization | UI copy should switch without changing Skill content | Central dictionary switches visible labels and `<html lang>`; Skill names/content remain original | Pass |
| Typography | System-like sans plus compact technical labels | macOS system font stack plus monospace Skill/command labels | Pass |
| Effects | No gradients; restrained borders and shadows | No gradient utilities; Phosphor icons; no fake CSS/SVG icons | Pass |
| Native titlebar | Reference includes macOS traffic lights | Tauri `decorations: true`; browser preview cannot render native traffic lights | Intentional platform deviation |
| Dataset size | Reference depicts a larger library | Browser preview uses sample Skills; packaged app uses real local sources | Intentional preview-only deviation |

## Interaction checks

- Search filters visible Skills and clearing the query restores the list.
- Selecting and removing Skills updates the selected count and Agent-native Prompt preview.
- Opening a Skill shows source, tags, validation state and preview without translating its content.
- Switching Codex / Claude Code / OpenCode / Cursor saves the Agent, rescans the source, clears unavailable selected IDs and keeps Task text.
- Settings can switch System / 简体中文 / English, choose External library, choose/reset an Agent custom folder and request a rescan.
- Bundle application is blocked when `defaultAgentId` does not match the active Agent and produces a localized status message.
- Copy writes only to the clipboard; it does not call mount, unmount, activate, Accessibility or submit actions.
- `⌘K` focuses the search field and `⌘↵` copies the current Prompt without auto-submitting.
- Missing Agent directories show a comprehensible empty/onboarding state with custom-folder and External fallback actions, plus a localized back button after an accidental switch.

## Final result

`final result: passed`

代码验收、浏览器交互和打包版启动均已复核；其他 Agent 的标准目录在本机不存在时显示空状态，不需要也不应为了验收而创建或修改来源目录。
