use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub directory_path: String,
    pub skill_file_path: String,
    pub tags: Vec<String>,
    pub source: String,
    pub is_valid: bool,
    pub validation_errors: Vec<String>,
    pub modified_at: Option<String>,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub skills: Vec<Skill>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bundle {
    pub id: String,
    pub name: String,
    pub description: String,
    pub skill_ids: Vec<String>,
    pub default_agent_id: Option<String>,
    pub command_names: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedLink {
    pub agent_id: String,
    pub skill_id: String,
    pub mount_name: String,
    pub link_path: String,
    pub source_path: String,
    pub state: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u32,
    pub locale: String,
    pub active_agent_id: String,
    pub library_mode: String,
    pub library_path: Option<String>,
    pub agent_skill_directories: HashMap<String, Option<String>>,
    pub show_invalid: bool,
    pub watch_library: bool,
    pub mount_mode: String,
    pub insertion_mode: String,
    pub appearance: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 3,
            locale: "system".to_owned(),
            active_agent_id: "codex".to_owned(),
            library_mode: "agent".to_owned(),
            library_path: None,
            agent_skill_directories: HashMap::new(),
            show_invalid: false,
            watch_library: false,
            mount_mode: "readonly".to_owned(),
            insertion_mode: "prefix".to_owned(),
            appearance: "dark".to_owned(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub detail: Option<String>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            detail: None,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDetectionResult {
    pub agent_id: String,
    pub display_name: String,
    pub installed: bool,
    pub app_path: Option<String>,
    pub skill_directories: Vec<String>,
    pub skill_count: usize,
    pub target_directory: Option<String>,
    pub target_exists: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MountRequest {
    pub skill_ids: Vec<String>,
    pub mode: String,
    #[serde(default)]
    pub aliases: HashMap<String, String>,
    #[serde(default = "default_conflict_policy")]
    pub conflict_policy: String,
}

fn default_conflict_policy() -> String {
    "skip".to_owned()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MountConflict {
    pub skill_id: String,
    pub mount_name: String,
    pub link_path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MountResult {
    pub agent_id: String,
    pub mode: String,
    pub target_directory: String,
    pub mounted: Vec<ManagedLink>,
    pub managed_links: Vec<ManagedLink>,
    pub removed: Vec<String>,
    pub conflicts: Vec<MountConflict>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub settings: AppSettings,
    pub scan: Option<ScanResult>,
    pub effective_library_paths: Vec<String>,
    pub agents: Vec<AgentDetectionResult>,
    pub active_agent: AgentDetectionResult,
}
