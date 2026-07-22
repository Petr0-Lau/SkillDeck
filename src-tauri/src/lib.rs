mod agents;
mod config;
mod models;
mod skills;

use std::path::PathBuf;

use models::{
    AgentDetectionResult, AppError, AppSettings, AppSnapshot, Bundle, ManagedLink, MountRequest,
    MountResult, ScanResult,
};
use tauri::AppHandle;

#[tauri::command]
fn get_snapshot(app: AppHandle) -> Result<AppSnapshot, AppError> {
    let settings = config::load_settings(&app)?;
    let (scan, effective_library_paths) = match settings.library_mode.as_str() {
        "external" => match settings.library_path.as_ref() {
            Some(path) => {
                let root = skills::validate_library_path(PathBuf::from(path).as_path())?;
                (
                    Some(skills::scan_library(&root)?),
                    vec![root.to_string_lossy().into_owned()],
                )
            }
            None => (None, Vec::new()),
        },
        "agent" => match agents::scan_agent(&settings, &settings.active_agent_id) {
            Ok((result, paths)) => (Some(result), paths),
            Err(error) if error.code == "skills_directory_missing" => (None, Vec::new()),
            Err(error) => return Err(error),
        },
        _ => {
            return Err(AppError::new(
                "library_mode_invalid",
                "libraryMode 只能是 agent 或 external",
            ))
        }
    };
    let mut agent_statuses = agents::all_agent_statuses(&settings)?;
    let active_index = agent_statuses
        .iter()
        .position(|agent| agent.agent_id == settings.active_agent_id)
        .ok_or_else(|| AppError::new("agent_id_invalid", "不支持的 Agent"))?;
    agent_statuses[active_index].skill_count =
        scan.as_ref().map(|result| result.skills.len()).unwrap_or(0);
    let active_agent = agent_statuses[active_index].clone();
    Ok(AppSnapshot {
        settings,
        scan,
        effective_library_paths,
        agents: agent_statuses,
        active_agent,
    })
}

#[tauri::command]
fn scan_library(path: String) -> Result<ScanResult, AppError> {
    let result = skills::scan_library(PathBuf::from(&path).as_path());
    match &result {
        Ok(scan) => log::info!(
            "operation=scan_library skills={} warnings={}",
            scan.skills.len(),
            scan.warnings.len()
        ),
        Err(error) => log::warn!("operation=scan_library code={}", error.code),
    }
    result
}

#[tauri::command]
fn scan_agent_skills(app: AppHandle, agent_id: String) -> Result<ScanResult, AppError> {
    let settings = config::load_settings(&app)?;
    let result = agents::scan_agent(&settings, &agent_id).map(|(scan, _)| scan);
    match &result {
        Ok(scan) => log::info!(
            "operation=scan_agent_skills skills={} warnings={}",
            scan.skills.len(),
            scan.warnings.len()
        ),
        Err(error) => log::warn!("operation=scan_agent_skills code={}", error.code),
    }
    result
}

#[tauri::command]
fn save_settings(app: AppHandle, mut settings: AppSettings) -> Result<AppSettings, AppError> {
    if settings.library_mode != "agent" && settings.library_mode != "external" {
        return Err(AppError::new(
            "library_mode_invalid",
            "libraryMode 只能是 agent 或 external",
        ));
    }
    if !matches!(settings.locale.as_str(), "system" | "zh-CN" | "en") {
        return Err(AppError::new(
            "locale_invalid",
            "locale 只能是 system、zh-CN 或 en",
        ));
    }
    if !agents::supported_agent(&settings.active_agent_id) {
        return Err(AppError::new("agent_id_invalid", "不支持的 Agent"));
    }
    for (agent_id, path) in &mut settings.agent_skill_directories {
        if !agents::supported_agent(agent_id) {
            return Err(AppError::new("agent_id_invalid", "不支持的 Agent"));
        }
        if let Some(path) = path.as_mut() {
            if !path.trim().is_empty() {
                let canonical =
                    skills::validate_agent_skills_path(PathBuf::from(path.as_str()).as_path())?;
                *path = canonical.to_string_lossy().into_owned();
            }
        }
    }
    settings.schema_version = 3;
    if settings.library_mode == "external" {
        let path = settings
            .library_path
            .as_ref()
            .ok_or_else(|| AppError::new("library_not_configured", "请先选择 Skill library"))?;
        let canonical = skills::validate_library_path(PathBuf::from(path).as_path())?;
        settings.library_path = Some(canonical.to_string_lossy().into_owned());
    }
    config::save_settings(&app, &settings)?;
    log::info!("operation=save_settings");
    Ok(settings)
}

#[tauri::command]
fn activate_codex() -> Result<(), AppError> {
    Err(AppError::new("readonly_mode", "只读模式不会激活 Agent"))
}

#[tauri::command]
fn detect_codex_target(app: AppHandle) -> Result<AgentDetectionResult, AppError> {
    let settings = config::load_settings(&app)?;
    Ok(agents::detect_codex(&settings))
}

#[tauri::command]
fn get_managed_links(app: AppHandle) -> Result<Vec<ManagedLink>, AppError> {
    config::load_managed_links(&app)
}

#[tauri::command]
fn get_bundles(app: AppHandle) -> Result<Vec<Bundle>, AppError> {
    config::load_bundles(&app)
}

#[tauri::command]
fn save_bundle(app: AppHandle, bundle: Bundle) -> Result<Bundle, AppError> {
    let result = config::save_bundle(&app, &bundle);
    match &result {
        Ok(_) => log::info!("operation=save_bundle id={}", bundle.id),
        Err(error) => log::warn!("operation=save_bundle code={}", error.code),
    }
    result
}

#[tauri::command]
fn delete_bundle(app: AppHandle, id: String) -> Result<Vec<Bundle>, AppError> {
    let result = config::delete_bundle(&app, &id);
    match &result {
        Ok(_) => log::info!("operation=delete_bundle"),
        Err(error) => log::warn!("operation=delete_bundle code={}", error.code),
    }
    result
}

#[tauri::command]
fn mount_skills(app: AppHandle, request: MountRequest) -> Result<MountResult, AppError> {
    let result = agents::mount(&app, request);
    match &result {
        Ok(mount) => log::info!(
            "operation=mount_skills mounted={} conflicts={} removed={}",
            mount.mounted.len(),
            mount.conflicts.len(),
            mount.removed.len()
        ),
        Err(error) => log::warn!("operation=mount_skills code={}", error.code),
    }
    result
}

#[tauri::command]
fn unmount_skills(app: AppHandle) -> Result<MountResult, AppError> {
    let result = agents::unmount(&app);
    match &result {
        Ok(mount) => log::info!(
            "operation=unmount_skills removed={} warnings={}",
            mount.removed.len(),
            mount.warnings.len()
        ),
        Err(error) => log::warn!("operation=unmount_skills code={}", error.code),
    }
    result
}

fn log_directory() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join("Library/Application Support/SkillDeck/logs"))
        .unwrap_or_else(|| PathBuf::from("logs"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Folder {
                        path: log_directory(),
                        file_name: Some("skilldeck.log".to_owned()),
                    }),
                ])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            scan_library,
            scan_agent_skills,
            save_settings,
            activate_codex,
            detect_codex_target,
            get_managed_links,
            get_bundles,
            save_bundle,
            delete_bundle,
            mount_skills,
            unmount_skills
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
