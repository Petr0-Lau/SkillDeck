use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::AppHandle;

#[cfg(not(target_os = "macos"))]
use tauri::Manager;

use crate::{
    models::{AppError, AppSettings, Bundle, ManagedLink},
    skills,
};

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        return std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join("Library/Application Support/SkillDeck"))
            .ok_or_else(|| {
                AppError::new("app_data_unavailable", "无法确定 SkillDeck 的本地数据目录")
            });
    }

    #[cfg(not(target_os = "macos"))]
    app.path().app_data_dir().map_err(|error| {
        AppError::new("app_data_unavailable", "无法确定 SkillDeck 的本地数据目录")
            .with_detail(error.to_string())
    })
}

fn atomic_write<T: serde::Serialize + ?Sized>(path: &Path, value: &T) -> Result<(), AppError> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::new("config_path_invalid", "本地配置路径无效"))?;
    fs::create_dir_all(parent).map_err(|error| {
        AppError::new("config_directory_unwritable", "无法创建本地配置目录")
            .with_detail(error.to_string())
    })?;
    let temp_path = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name().unwrap_or_default().to_string_lossy(),
        std::process::id()
    ));
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| {
        AppError::new("config_encode_failed", "无法编码本地配置").with_detail(error.to_string())
    })?;
    fs::write(&temp_path, bytes).map_err(|error| {
        AppError::new("config_write_failed", "无法写入本地配置").with_detail(error.to_string())
    })?;
    fs::rename(&temp_path, path).map_err(|error| {
        AppError::new("config_commit_failed", "无法保存本地配置").with_detail(error.to_string())
    })
}

#[derive(Debug, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredSettings {
    schema_version: Option<u32>,
    locale: Option<String>,
    active_agent_id: Option<String>,
    library_mode: Option<String>,
    library_path: Option<String>,
    agent_skill_directories: Option<std::collections::HashMap<String, Option<String>>>,
    show_invalid: Option<bool>,
    watch_library: Option<bool>,
    mount_mode: Option<String>,
    insertion_mode: Option<String>,
    appearance: Option<String>,
    codex_skill_directory: Option<String>,
}

fn migrate_settings(bytes: &[u8]) -> Result<AppSettings, AppError> {
    let stored: StoredSettings = serde_json::from_slice(bytes).map_err(|error| {
        AppError::new("config_decode_failed", "本地配置格式无效").with_detail(error.to_string())
    })?;
    if stored.schema_version.unwrap_or(1) > 3 {
        return Err(AppError::new(
            "config_version_unsupported",
            "本地配置版本不受支持",
        ));
    }
    let library_path = stored.library_path.filter(|path| !path.trim().is_empty());
    let library_mode = match stored.library_mode.as_deref() {
        Some("agent") => "agent",
        Some("external") => "external",
        Some(_) => {
            return Err(AppError::new(
                "library_mode_invalid",
                "libraryMode 只能是 agent 或 external",
            ))
        }
        None if library_path.is_some() => "external",
        None => "agent",
    };
    let locale = stored.locale.unwrap_or_else(|| "system".to_owned());
    if !matches!(locale.as_str(), "system" | "zh-CN" | "en") {
        return Err(AppError::new(
            "locale_invalid",
            "locale 只能是 system、zh-CN 或 en",
        ));
    }
    let active_agent_id = stored.active_agent_id.unwrap_or_else(|| "codex".to_owned());
    if !matches!(
        active_agent_id.as_str(),
        "codex" | "claude" | "opencode" | "cursor"
    ) {
        return Err(AppError::new("agent_id_invalid", "不支持的 Agent"));
    }
    let mut agent_skill_directories = stored.agent_skill_directories.unwrap_or_default();
    for agent_id in agent_skill_directories.keys() {
        if !matches!(
            agent_id.as_str(),
            "codex" | "claude" | "opencode" | "cursor"
        ) {
            return Err(AppError::new("agent_id_invalid", "不支持的 Agent"));
        }
    }
    if !agent_skill_directories.contains_key("codex") {
        if let Some(path) = stored.codex_skill_directory {
            if !path.trim().is_empty() {
                agent_skill_directories.insert("codex".to_owned(), Some(path));
            }
        }
    }
    let defaults = AppSettings::default();
    Ok(AppSettings {
        schema_version: 3,
        locale,
        active_agent_id,
        library_mode: library_mode.to_owned(),
        library_path,
        agent_skill_directories,
        show_invalid: stored.show_invalid.unwrap_or(defaults.show_invalid),
        watch_library: stored.watch_library.unwrap_or(defaults.watch_library),
        mount_mode: stored.mount_mode.unwrap_or(defaults.mount_mode),
        insertion_mode: stored.insertion_mode.unwrap_or(defaults.insertion_mode),
        appearance: stored.appearance.unwrap_or(defaults.appearance),
    })
}

#[derive(serde::Deserialize)]
struct VersionedList<T> {
    schema_version: u32,
    items: Vec<T>,
}

#[derive(serde::Serialize)]
struct VersionedListRef<'a, T> {
    schema_version: u32,
    items: &'a [T],
}

fn read_collection<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Vec<T>, AppError> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(path).map_err(|error| {
        AppError::new("config_read_failed", "无法读取本地配置").with_detail(error.to_string())
    })?;
    if let Ok(document) = serde_json::from_slice::<VersionedList<T>>(&bytes) {
        if document.schema_version != 1 {
            return Err(AppError::new(
                "config_version_unsupported",
                "本地配置版本不受支持",
            ));
        }
        return Ok(document.items);
    }
    serde_json::from_slice(&bytes).map_err(|error| {
        AppError::new("config_decode_failed", "本地配置格式无效").with_detail(error.to_string())
    })
}

fn write_collection<T: serde::Serialize>(path: &Path, items: &[T]) -> Result<(), AppError> {
    atomic_write(
        path,
        &VersionedListRef {
            schema_version: 1,
            items,
        },
    )
}

pub fn load_settings(app: &AppHandle) -> Result<AppSettings, AppError> {
    let path = app_data_dir(app)?.join("settings.json");
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let bytes = fs::read(&path).map_err(|error| {
        AppError::new("config_read_failed", "无法读取本地配置").with_detail(error.to_string())
    })?;
    migrate_settings(&bytes)
}

pub fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), AppError> {
    atomic_write(&app_data_dir(app)?.join("settings.json"), settings)
}

#[cfg(test)]
mod tests {
    use std::{collections::HashMap, fs, path::PathBuf};

    use serde::Serialize;

    use super::{atomic_write, migrate_settings, validate_bundle};
    use crate::models::Bundle;

    #[derive(Serialize)]
    struct Fixture {
        value: String,
    }

    #[test]
    fn atomic_write_replaces_previous_json_without_temp_file() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("settings.json");
        atomic_write(
            &path,
            &Fixture {
                value: "next".to_owned(),
            },
        )
        .expect("write");
        let bytes = fs::read_to_string(&path).expect("read");
        assert!(bytes.contains("next"));
        let temp_path =
            PathBuf::from(dir.path()).join(format!(".settings.json.{}.tmp", std::process::id()));
        assert!(!temp_path.exists());
    }

    #[test]
    fn bundle_validation_rejects_an_unsafe_command_alias() {
        let error = validate_bundle(&Bundle {
            id: "demo".to_owned(),
            name: "Demo".to_owned(),
            description: String::new(),
            skill_ids: vec!["skills/demo".to_owned()],
            default_agent_id: Some("codex".to_owned()),
            command_names: HashMap::from([(String::from("skills/demo"), String::from("bad/name"))]),
        })
        .expect_err("unsafe alias must be rejected");
        assert_eq!(error.code, "bundle_command_invalid");
    }

    #[test]
    fn migrates_v1_without_library_to_agent_mode() {
        let settings =
            migrate_settings(br#"{"schemaVersion":1,"libraryPath":null,"showInvalid":true}"#)
                .expect("migrate");
        assert_eq!(settings.schema_version, 3);
        assert_eq!(settings.library_mode, "agent");
        assert!(settings.show_invalid);
    }

    #[test]
    fn migrates_v1_with_library_to_external_mode() {
        let settings = migrate_settings(br#"{"schemaVersion":1,"libraryPath":"/tmp/library"}"#)
            .expect("migrate");
        assert_eq!(settings.library_mode, "external");
        assert_eq!(settings.library_path.as_deref(), Some("/tmp/library"));
    }

    #[test]
    fn rejects_an_unknown_library_mode() {
        let error = migrate_settings(br#"{"schemaVersion":2,"libraryMode":"other"}"#)
            .expect_err("unknown mode must fail");
        assert_eq!(error.code, "library_mode_invalid");
    }

    #[test]
    fn migrates_codex_directory_and_defaults_locale_and_agent() {
        let settings =
            migrate_settings(br#"{"schemaVersion":2,"codexSkillDirectory":"/tmp/codex"}"#)
                .expect("migrate");
        assert_eq!(settings.locale, "system");
        assert_eq!(settings.active_agent_id, "codex");
        assert_eq!(
            settings
                .agent_skill_directories
                .get("codex")
                .and_then(Option::as_deref),
            Some("/tmp/codex")
        );
    }

    #[test]
    fn rejects_an_unknown_agent_or_locale() {
        assert_eq!(
            migrate_settings(br#"{"schemaVersion":3,"activeAgentId":"other"}"#)
                .expect_err("unknown agent")
                .code,
            "agent_id_invalid"
        );
        assert_eq!(
            migrate_settings(br#"{"schemaVersion":3,"locale":"fr"}"#)
                .expect_err("unknown locale")
                .code,
            "locale_invalid"
        );
    }
}

pub fn load_bundles(app: &AppHandle) -> Result<Vec<Bundle>, AppError> {
    read_collection(&app_data_dir(app)?.join("bundles.json"))
}

pub fn save_bundles(app: &AppHandle, bundles: &[Bundle]) -> Result<(), AppError> {
    write_collection(&app_data_dir(app)?.join("bundles.json"), bundles)
}

fn validate_bundle(bundle: &Bundle) -> Result<(), AppError> {
    if bundle.id.is_empty()
        || bundle.id.len() > 128
        || !bundle.id.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        })
    {
        return Err(AppError::new("bundle_id_invalid", "Bundle ID 无效"));
    }
    if bundle.name.trim().is_empty() || bundle.name.chars().count() > 120 {
        return Err(AppError::new(
            "bundle_name_invalid",
            "Bundle 名称不能为空或过长",
        ));
    }
    if bundle.description.chars().count() > 1000 {
        return Err(AppError::new(
            "bundle_description_invalid",
            "Bundle 描述过长",
        ));
    }
    if bundle.skill_ids.is_empty() {
        return Err(AppError::new("bundle_empty", "Bundle 至少需要一个 Skill"));
    }
    for (skill_id, command_name) in &bundle.command_names {
        if !bundle.skill_ids.iter().any(|id| id == skill_id) {
            return Err(AppError::new(
                "bundle_command_unknown",
                "Bundle 命令别名不属于所选 Skill",
            ));
        }
        if !skills::valid_skill_name(command_name) {
            return Err(AppError::new(
                "bundle_command_invalid",
                "Bundle 命令别名包含非法字符",
            ));
        }
    }
    Ok(())
}

pub fn save_bundle(app: &AppHandle, bundle: &Bundle) -> Result<Bundle, AppError> {
    validate_bundle(bundle)?;
    let mut bundles = load_bundles(app)?;
    if let Some(existing) = bundles.iter_mut().find(|existing| existing.id == bundle.id) {
        *existing = bundle.clone();
    } else {
        bundles.push(bundle.clone());
    }
    save_bundles(app, &bundles)?;
    Ok(bundle.clone())
}

pub fn delete_bundle(app: &AppHandle, id: &str) -> Result<Vec<Bundle>, AppError> {
    let mut bundles = load_bundles(app)?;
    bundles.retain(|bundle| bundle.id != id);
    save_bundles(app, &bundles)?;
    Ok(bundles)
}

pub fn load_managed_links(app: &AppHandle) -> Result<Vec<ManagedLink>, AppError> {
    read_collection(&app_data_dir(app)?.join("managed-links.json"))
}
