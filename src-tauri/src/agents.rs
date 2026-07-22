use std::{collections::HashSet, fs, path::PathBuf};

use tauri::AppHandle;

use crate::{
    models::{AgentDetectionResult, AppError, AppSettings, MountRequest, MountResult},
    skills,
};

const CODEX_ID: &str = "codex";
const AGENT_IDS: &[&str] = &["codex", "claude", "opencode", "cursor"];

/// The adapter boundary is intentionally read-only. Agent-specific delivery is outside scope.
pub trait AgentAdapter {
    fn detect(&self, settings: &AppSettings) -> AgentDetectionResult;
}

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn detect(&self, settings: &AppSettings) -> AgentDetectionResult {
        agent_status(settings, CODEX_ID).unwrap_or_else(|_| empty_status(CODEX_ID))
    }
}

fn empty_status(agent_id: &str) -> AgentDetectionResult {
    AgentDetectionResult {
        agent_id: agent_id.to_owned(),
        display_name: display_name(agent_id).to_owned(),
        installed: false,
        app_path: None,
        skill_directories: Vec::new(),
        skill_count: 0,
        target_directory: None,
        target_exists: false,
        message: Some(format!(
            "{} Skill directory is not available",
            display_name(agent_id)
        )),
    }
}

pub fn supported_agent(agent_id: &str) -> bool {
    AGENT_IDS.contains(&agent_id)
}

pub fn agent_ids() -> &'static [&'static str] {
    AGENT_IDS
}

pub fn display_name(agent_id: &str) -> &'static str {
    match agent_id {
        "codex" => "Codex",
        "claude" => "Claude Code",
        "opencode" => "OpenCode",
        "cursor" => "Cursor",
        _ => "Agent",
    }
}

fn home_dir() -> Result<PathBuf, AppError> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| AppError::new("home_unavailable", "无法确定当前用户目录"))
}

pub fn agent_roots(
    settings: &AppSettings,
    agent_id: &str,
) -> Result<Vec<(String, PathBuf)>, AppError> {
    if !supported_agent(agent_id) {
        return Err(AppError::new("agent_id_invalid", "不支持的 Agent"));
    }
    let home = home_dir()?;
    let mut roots: Vec<(String, PathBuf)> = match agent_id {
        "codex" => vec![
            ("codex".to_owned(), home.join(".codex/skills")),
            ("agents".to_owned(), home.join(".agents/skills")),
        ],
        "claude" => vec![("claude".to_owned(), home.join(".claude/skills"))],
        "opencode" => vec![
            ("opencode".to_owned(), home.join(".config/opencode/skills")),
            ("claude".to_owned(), home.join(".claude/skills")),
            ("agents".to_owned(), home.join(".agents/skills")),
        ],
        "cursor" => vec![
            ("cursor".to_owned(), home.join(".cursor/skills")),
            ("agents".to_owned(), home.join(".agents/skills")),
        ],
        _ => Vec::new(),
    };
    if let Some(Some(custom)) = settings.agent_skill_directories.get(agent_id) {
        if !custom.trim().is_empty() {
            roots.push(("custom".to_owned(), PathBuf::from(custom)));
        }
    }
    Ok(roots)
}

pub fn agent_status(
    settings: &AppSettings,
    agent_id: &str,
) -> Result<AgentDetectionResult, AppError> {
    let roots = agent_roots(settings, agent_id)?;
    let directories = roots
        .iter()
        .map(|(_, path)| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    let target = roots.iter().find(|(_, path)| {
        fs::symlink_metadata(path)
            .map(|metadata| metadata.file_type().is_dir())
            .unwrap_or(false)
    });
    let target_exists = target.is_some();
    Ok(AgentDetectionResult {
        agent_id: agent_id.to_owned(),
        display_name: display_name(agent_id).to_owned(),
        installed: target_exists,
        app_path: None,
        skill_directories: directories,
        skill_count: 0,
        target_directory: target.map(|(_, path)| path.to_string_lossy().into_owned()),
        target_exists,
        message: (!target_exists).then(|| {
            format!(
                "{} Skill directory is not available",
                display_name(agent_id)
            )
        }),
    })
}

pub fn all_agent_statuses(settings: &AppSettings) -> Result<Vec<AgentDetectionResult>, AppError> {
    agent_ids()
        .iter()
        .map(|agent_id| agent_status(settings, agent_id))
        .collect()
}

pub fn scan_agent(
    settings: &AppSettings,
    agent_id: &str,
) -> Result<(crate::models::ScanResult, Vec<String>), AppError> {
    let roots = agent_roots(settings, agent_id)?;
    let mut scan = crate::models::ScanResult {
        skills: Vec::new(),
        warnings: Vec::new(),
    };
    let mut paths = Vec::new();
    let mut seen_roots = HashSet::new();
    let mut seen_files = HashSet::new();

    for (root_id, path) in roots {
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(AppError::new(
                    "skills_directory_unreadable",
                    "无法读取 Agent Skill 目录",
                )
                .with_detail(error.to_string()))
            }
        };
        if metadata.file_type().is_symlink() || !metadata.file_type().is_dir() {
            return Err(AppError::new(
                "skills_directory_invalid",
                "Agent Skill 目录必须是实际目录，不能是软链接或文件",
            ));
        }
        let canonical = path.canonicalize().map_err(|error| {
            AppError::new("skills_directory_unreadable", "无法读取 Agent Skill 目录")
                .with_detail(error.to_string())
        })?;
        if !seen_roots.insert(canonical.clone()) {
            continue;
        }
        paths.push(canonical.to_string_lossy().into_owned());
        let partial = skills::scan_agent_root(
            &canonical,
            &format!("{agent_id}:{root_id}"),
            &format!("{agent_id} · {root_id}"),
        )?;
        for skill in partial.skills {
            if seen_files.insert(skill.skill_file_path.clone()) {
                scan.skills.push(skill);
            }
        }
        scan.warnings.extend(partial.warnings);
    }

    scan.skills
        .sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok((scan, paths))
}

fn readonly_mode_error(action: &str) -> AppError {
    AppError::new(
        "readonly_mode",
        format!("只读模式不会{action} Skill 软链接"),
    )
}

/// Compatibility guard for clients from the pre-read-only release.
pub fn mount(app: &AppHandle, request: MountRequest) -> Result<MountResult, AppError> {
    let _ = (app, request);
    Err(readonly_mode_error("创建"))
}

/// Compatibility guard for clients from the pre-read-only release.
pub fn unmount(app: &AppHandle) -> Result<MountResult, AppError> {
    let _ = app;
    Err(readonly_mode_error("删除"))
}

pub fn detect_codex(settings: &AppSettings) -> AgentDetectionResult {
    CodexAdapter.detect(settings)
}

#[cfg(test)]
mod tests {
    use super::{agent_roots, display_name, readonly_mode_error, supported_agent};
    use crate::models::AppSettings;

    #[test]
    fn exposes_the_four_supported_agents() {
        for agent_id in ["codex", "claude", "opencode", "cursor"] {
            assert!(supported_agent(agent_id));
        }
        assert_eq!(display_name("claude"), "Claude Code");
        assert!(!supported_agent("unknown"));
    }

    #[test]
    fn builds_standard_roots_and_custom_root() {
        let mut settings = AppSettings::default();
        settings.agent_skill_directories.insert(
            "cursor".to_owned(),
            Some("/tmp/custom-cursor-skills".to_owned()),
        );
        let roots = agent_roots(&settings, "cursor").expect("cursor roots");
        assert_eq!(roots[0].0, "cursor");
        assert_eq!(roots[1].0, "agents");
        assert_eq!(roots[2].0, "custom");
        assert!(roots[0].1.ends_with(".cursor/skills"));
        assert!(roots[1].1.ends_with(".agents/skills"));
    }

    #[test]
    fn legacy_write_commands_have_a_readonly_guard() {
        let error = readonly_mode_error("创建");
        assert_eq!(error.code, "readonly_mode");
        assert!(error.message.contains("只读模式"));
    }
}
