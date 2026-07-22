use std::{
    fs,
    path::{Path, PathBuf},
};

use walkdir::{DirEntry, WalkDir};

use crate::models::{AppError, ScanResult, Skill};

const IGNORED_DIRS: &[&str] = &[".git", "node_modules"];

fn is_hidden_or_ignored(entry: &DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();
    name.starts_with('.') || IGNORED_DIRS.contains(&name.as_ref())
}

pub fn valid_skill_name(value: &str) -> bool {
    let mut chars = value.chars();
    matches!(chars.next(), Some(first) if first.is_ascii_alphanumeric())
        && value.len() <= 128
        && chars.all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        })
}

fn first_paragraph(body: &str) -> String {
    body.lines()
        .skip_while(|line| line.trim().is_empty())
        .take_while(|line| !line.trim().is_empty())
        .map(str::trim)
        .collect::<Vec<_>>()
        .join(" ")
}

fn preview(body: &str) -> String {
    body.trim().chars().take(1200).collect()
}

fn split_frontmatter(content: &str) -> (Option<String>, String, Option<String>) {
    let lines: Vec<&str> = content.lines().collect();
    if lines.first().map(|line| line.trim()) != Some("---") {
        return (None, content.to_owned(), None);
    }
    let close_index = lines
        .iter()
        .enumerate()
        .skip(1)
        .find_map(|(index, line)| matches!(line.trim(), "---" | "...").then_some(index));
    let Some(close_index) = close_index else {
        return (
            None,
            content.to_owned(),
            Some("frontmatter 未闭合".to_owned()),
        );
    };
    let metadata = lines[1..close_index].join("\n");
    let body = lines[close_index + 1..].join("\n");
    (Some(metadata), body, None)
}

fn yaml_string(map: &serde_yaml::Mapping, key: &str) -> Option<String> {
    map.get(serde_yaml::Value::String(key.to_owned()))
        .and_then(serde_yaml::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn parse_skill(
    root: &Path,
    directory: &Path,
    skill_file: &Path,
    id_prefix: Option<&str>,
    source: &str,
) -> Result<Skill, AppError> {
    let content = fs::read_to_string(skill_file).map_err(|error| {
        AppError::new("skill_read_failed", "无法读取 SKILL.md").with_detail(error.to_string())
    })?;
    let (frontmatter, body, split_error) = split_frontmatter(&content);
    let mut validation_errors = Vec::new();
    if let Some(error) = split_error {
        validation_errors.push(error);
    }

    let folder_name = directory
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unnamed-skill".to_owned());
    let mut name = folder_name;
    let mut description = first_paragraph(&body);
    let mut tags = Vec::new();

    if let Some(frontmatter) = frontmatter {
        match serde_yaml::from_str::<serde_yaml::Value>(&frontmatter) {
            Ok(serde_yaml::Value::Mapping(map)) => {
                if let Some(value) = yaml_string(&map, "name") {
                    name = value;
                }
                if let Some(value) = yaml_string(&map, "description") {
                    description = value;
                }
                if let Some(value) = map.get(serde_yaml::Value::String("tags".to_owned())) {
                    match value {
                        serde_yaml::Value::Sequence(items) => {
                            for item in items {
                                if let Some(tag) =
                                    item.as_str().map(str::trim).filter(|tag| !tag.is_empty())
                                {
                                    tags.push(tag.to_owned());
                                } else {
                                    validation_errors.push("tags 必须是字符串数组".to_owned());
                                }
                            }
                        }
                        _ => validation_errors.push("tags 必须是字符串数组".to_owned()),
                    }
                }
            }
            Ok(_) => validation_errors.push("frontmatter 必须是 YAML 对象".to_owned()),
            Err(error) => validation_errors.push(format!("frontmatter YAML 无效: {error}")),
        }
    }

    if !valid_skill_name(&name) {
        validation_errors.push("Skill 名称包含非法字符".to_owned());
    }
    if content.trim().is_empty() {
        validation_errors.push("SKILL.md 为空".to_owned());
    }

    let relative = directory.strip_prefix(root).map_err(|error| {
        AppError::new("skill_path_invalid", "Skill 路径不在仓库内").with_detail(error.to_string())
    })?;
    let modified_at = fs::metadata(skill_file)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs().to_string());

    let relative_id = relative.to_string_lossy().replace('\\', "/");
    let id = id_prefix
        .map(|prefix| format!("{prefix}:{relative_id}"))
        .unwrap_or(relative_id);
    Ok(Skill {
        id,
        name,
        description,
        directory_path: directory.to_string_lossy().into_owned(),
        skill_file_path: skill_file.to_string_lossy().into_owned(),
        tags,
        source: source.to_owned(),
        is_valid: validation_errors.is_empty(),
        validation_errors,
        modified_at,
        preview: preview(&body),
    })
}

pub fn validate_library_path(library_path: &Path) -> Result<PathBuf, AppError> {
    let root = library_path.canonicalize().map_err(|error| {
        AppError::new("library_unreadable", "Skill 仓库不存在或无法读取")
            .with_detail(error.to_string())
    })?;
    let skills_path = root.join("skills");
    if !root.is_dir() || !skills_path.is_dir() {
        return Err(AppError::new(
            "skills_directory_missing",
            "仓库中没有 skills/ 目录",
        ));
    }
    let canonical_skills_path = skills_path.canonicalize().map_err(|error| {
        AppError::new("skills_directory_unreadable", "无法读取仓库的 skills/ 目录")
            .with_detail(error.to_string())
    })?;
    if !canonical_skills_path.starts_with(&skills_path) {
        return Err(AppError::new(
            "skills_directory_outside_library",
            "skills/ 目录不能通过软链接指向仓库外部",
        ));
    }
    Ok(root)
}

fn scan_skills_root(
    root: &Path,
    skills_root: &Path,
    id_prefix: Option<&str>,
    source: &str,
) -> Result<ScanResult, AppError> {
    let mut skills = Vec::new();
    let mut warnings = Vec::new();
    let mut iterator = WalkDir::new(&skills_root).follow_links(false).into_iter();
    while let Some(entry) = iterator.next() {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                warnings.push(format!("扫描路径失败: {error}"));
                continue;
            }
        };
        if entry.path() != skills_root && is_hidden_or_ignored(&entry) {
            if entry.file_type().is_dir() {
                iterator.skip_current_dir();
            }
            continue;
        }
        if entry.file_type().is_symlink() {
            if entry.file_type().is_dir() {
                iterator.skip_current_dir();
            }
            continue;
        }
        if entry.file_type().is_file() && entry.file_name() == "SKILL.md" {
            let directory = entry
                .path()
                .parent()
                .ok_or_else(|| AppError::new("skill_path_invalid", "无法确定 Skill 目录"))?;
            match parse_skill(&root, directory, entry.path(), id_prefix, source) {
                Ok(skill) => skills.push(skill),
                Err(error) => {
                    warnings.push(format!("{}: {}", entry.path().display(), error.message))
                }
            }
        }
    }

    skills.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(ScanResult { skills, warnings })
}

pub fn scan_library(library_path: &Path) -> Result<ScanResult, AppError> {
    let root = validate_library_path(library_path)?;
    scan_skills_root(&root, &root.join("skills"), None, "external")
}

pub fn validate_agent_skills_path(path: &Path) -> Result<PathBuf, AppError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        AppError::new(
            "skills_directory_missing",
            "Codex Skill 目录不存在或无法读取",
        )
        .with_detail(error.to_string())
    })?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_dir() {
        return Err(AppError::new(
            "skills_directory_invalid",
            "Codex Skill 目录必须是实际目录，不能是软链接或文件",
        ));
    }
    path.canonicalize().map_err(|error| {
        AppError::new("skills_directory_unreadable", "无法读取 Codex Skill 目录")
            .with_detail(error.to_string())
    })
}

#[cfg(test)]
fn scan_agent_skills(path: &Path) -> Result<ScanResult, AppError> {
    let root = validate_agent_skills_path(path)?;
    scan_skills_root(&root, &root, None, "agent")
}

pub fn scan_agent_root(path: &Path, id_prefix: &str, source: &str) -> Result<ScanResult, AppError> {
    let root = validate_agent_skills_path(path)?;
    scan_skills_root(&root, &root, Some(id_prefix), source)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{
        scan_agent_root, scan_agent_skills, scan_library, validate_agent_skills_path,
        validate_library_path,
    };

    fn fixture() -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("skills/frontend-design")).expect("skills dir");
        fs::write(
            dir.path().join("skills/frontend-design/SKILL.md"),
            "---\nname: frontend-design\ndescription: Build polished UI.\ntags: [frontend, design]\n---\n\n# Frontend Design\n\nUse this skill for visual work.\n",
        )
        .expect("skill file");
        dir
    }

    #[test]
    fn parses_frontmatter_and_body() {
        let result = scan_library(fixture().path()).expect("scan");
        assert_eq!(result.skills.len(), 1);
        assert_eq!(result.skills[0].name, "frontend-design");
        assert_eq!(result.skills[0].tags, vec!["frontend", "design"]);
        assert!(result.skills[0].description.contains("Build polished"));
        assert!(result.skills[0].is_valid);
    }

    #[test]
    fn falls_back_without_frontmatter() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("skills/plain")).expect("skills dir");
        fs::write(
            dir.path().join("skills/plain/SKILL.md"),
            "Plain skill description.\n\nMore text.",
        )
        .expect("skill file");
        let result = scan_library(dir.path()).expect("scan");
        assert_eq!(result.skills[0].name, "plain");
        assert_eq!(result.skills[0].description, "Plain skill description.");
    }

    #[test]
    fn ignores_hidden_directories_and_symlinks() {
        let dir = fixture();
        fs::create_dir_all(dir.path().join("skills/.hidden")).expect("hidden dir");
        fs::write(dir.path().join("skills/.hidden/SKILL.md"), "hidden").expect("hidden file");
        #[cfg(unix)]
        std::os::unix::fs::symlink(
            dir.path().join("skills/frontend-design"),
            dir.path().join("skills/linked"),
        )
        .expect("symlink");
        let result = scan_library(dir.path()).expect("scan");
        assert_eq!(result.skills.len(), 1);
    }

    #[test]
    fn keeps_invalid_metadata_visible_for_review() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("skills/invalid")).expect("skills dir");
        fs::write(
            dir.path().join("skills/invalid/SKILL.md"),
            "---\nname: bad/name\ntags: not-a-list\n---\n\nInvalid metadata.",
        )
        .expect("skill file");
        let result = scan_library(dir.path()).expect("scan");
        assert_eq!(result.skills.len(), 1);
        assert!(!result.skills[0].is_valid);
        assert!(result.skills[0].validation_errors.len() >= 2);
    }

    #[test]
    fn reports_empty_and_non_utf8_skill_files() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("skills/empty")).expect("skills dir");
        fs::create_dir_all(dir.path().join("skills/binary")).expect("skills dir");
        fs::write(dir.path().join("skills/empty/SKILL.md"), "").expect("empty skill");
        fs::write(dir.path().join("skills/binary/SKILL.md"), [0xff, 0xfe]).expect("binary skill");
        let result = scan_library(dir.path()).expect("scan");
        assert_eq!(result.skills.len(), 1);
        assert!(!result.skills[0].is_valid);
        assert_eq!(result.warnings.len(), 1);
    }

    #[test]
    fn preserves_nested_duplicate_display_names_with_distinct_ids() {
        let dir = tempfile::tempdir().expect("tempdir");
        for path in ["skills/team-a/shared", "skills/team-b/shared"] {
            fs::create_dir_all(dir.path().join(path)).expect("nested skill dir");
            fs::write(
                dir.path().join(path).join("SKILL.md"),
                "---\nname: shared\n---\n\nSame display name.",
            )
            .expect("skill file");
        }
        let result = scan_library(dir.path()).expect("scan");
        assert_eq!(result.skills.len(), 2);
        assert_ne!(result.skills[0].id, result.skills[1].id);
        assert!(result.skills.iter().all(|skill| skill.name == "shared"));
    }

    #[test]
    fn rejects_a_library_without_skills_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        let error = validate_library_path(dir.path()).expect_err("missing skills");
        assert_eq!(error.code, "skills_directory_missing");
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_skills_directory_linked_outside_the_library() {
        let dir = tempfile::tempdir().expect("tempdir");
        let outside = tempfile::tempdir().expect("outside");
        fs::create_dir_all(dir.path().join("skills")).expect("skills dir");
        fs::remove_dir(dir.path().join("skills")).expect("remove skills dir");
        std::os::unix::fs::symlink(outside.path(), dir.path().join("skills")).expect("symlink");
        let error = validate_library_path(dir.path()).expect_err("outside skills");
        assert_eq!(error.code, "skills_directory_outside_library");
    }

    #[test]
    fn scans_agent_skills_with_ids_relative_to_the_agent_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("frontend-design")).expect("skill dir");
        fs::write(
            dir.path().join("frontend-design/SKILL.md"),
            "Agent skill description.",
        )
        .expect("skill file");
        let result = scan_agent_skills(dir.path()).expect("scan");
        assert_eq!(result.skills[0].id, "frontend-design");
    }

    #[test]
    fn prefixes_merged_agent_skill_ids_and_marks_the_source() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("frontend-design")).expect("skill dir");
        fs::write(
            dir.path().join("frontend-design/SKILL.md"),
            "Agent skill description.",
        )
        .expect("skill file");
        let result = scan_agent_root(dir.path(), "codex:agents", "Codex · agents").expect("scan");
        assert_eq!(result.skills[0].id, "codex:agents:frontend-design");
        assert_eq!(result.skills[0].source, "Codex · agents");
    }

    #[test]
    fn agent_scan_rejects_a_file_or_symlink_root() {
        let dir = tempfile::tempdir().expect("tempdir");
        let file = dir.path().join("skills");
        fs::write(&file, "not a directory").expect("file");
        assert_eq!(
            validate_agent_skills_path(&file)
                .expect_err("file root must fail")
                .code,
            "skills_directory_invalid"
        );
    }

    #[cfg(unix)]
    #[test]
    fn agent_scan_ignores_hidden_and_symlinked_skill_directories() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("visible")).expect("visible");
        fs::write(dir.path().join("visible/SKILL.md"), "visible").expect("visible file");
        fs::create_dir_all(dir.path().join(".hidden")).expect("hidden");
        fs::write(dir.path().join(".hidden/SKILL.md"), "hidden").expect("hidden file");
        let external = tempfile::tempdir().expect("external");
        fs::write(external.path().join("SKILL.md"), "linked").expect("linked file");
        std::os::unix::fs::symlink(external.path(), dir.path().join("linked")).expect("symlink");
        let result = scan_agent_skills(dir.path()).expect("scan");
        assert_eq!(result.skills.len(), 1);
        assert_eq!(result.skills[0].id, "visible");
    }
}
