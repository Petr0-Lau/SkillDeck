import { invoke } from "@tauri-apps/api/core"
import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { open } from "@tauri-apps/plugin-dialog"

import type {
  AppSettings,
  AppSnapshot,
  AgentId,
  Bundle,
  ManagedLink,
  MountRequest,
  MountResult,
  ScanResult,
} from "@/types"

export const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

export async function getSnapshot() {
  return invoke<AppSnapshot>("get_snapshot")
}

export async function scanLibrary(path: string) {
  return invoke<ScanResult>("scan_library", { path })
}

export async function scanAgentSkills(agentId: AgentId) {
  return invoke<ScanResult>("scan_agent_skills", { agentId })
}

export async function saveSettings(settings: AppSettings) {
  return invoke<AppSettings>("save_settings", { settings })
}

export async function chooseLibrary(title = "Choose a Skill library") {
  return chooseFolder(title)
}

export async function chooseFolder(title: string) {
  const selected = await open({
    directory: true,
    multiple: false,
    title,
  })
  return typeof selected === "string" ? selected : null
}

export async function getManagedLinks() {
  return invoke<ManagedLink[]>("get_managed_links")
}

export async function getBundles() {
  return invoke<Bundle[]>("get_bundles")
}

export async function saveBundle(bundle: Bundle) {
  return invoke<Bundle>("save_bundle", { bundle })
}

export async function deleteBundle(id: string) {
  return invoke<Bundle[]>("delete_bundle", { id })
}

export async function mountSkills(request: MountRequest) {
  return invoke<MountResult>("mount_skills", { request })
}

export async function unmountSkills() {
  return invoke<MountResult>("unmount_skills")
}

export async function copyText(value: string) {
  if (isTauri()) {
    await writeText(value)
    return
  }

  if (!navigator.clipboard) {
    throw { code: "clipboard_unavailable", message: "Clipboard is unavailable" }
  }
  await navigator.clipboard.writeText(value)
}
