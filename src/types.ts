export type AppView = "library" | "bundles" | "active" | "settings"
export type LibraryMode = "agent" | "external"
export type AgentId = "codex" | "claude" | "opencode" | "cursor"
export type Locale = "system" | "zh-CN" | "en"

export interface Skill {
  id: string
  name: string
  description: string
  directoryPath: string
  skillFilePath: string
  tags: string[]
  source: string
  isValid: boolean
  validationErrors: string[]
  modifiedAt?: string | null
  preview: string
}

export interface ScanResult {
  skills: Skill[]
  warnings: string[]
}

export interface AppSettings {
  schemaVersion: number
  locale: Locale
  activeAgentId: AgentId
  libraryMode: LibraryMode
  libraryPath?: string | null
  agentSkillDirectories: Partial<Record<AgentId, string | null>>
  showInvalid: boolean
  watchLibrary: boolean
  mountMode: string
  insertionMode: string
  appearance: string
}

export interface AgentStatus {
  agentId: AgentId
  displayName: string
  installed: boolean
  appPath?: string | null
  skillDirectories: string[]
  skillCount: number
  targetDirectory?: string | null
  targetExists: boolean
  message?: string | null
}

export interface ManagedLink {
  agentId: string
  skillId: string
  mountName: string
  linkPath: string
  sourcePath: string
  state: string
  createdAt: string
}

export interface Bundle {
  id: string
  name: string
  description: string
  skillIds: string[]
  defaultAgentId?: string | null
  commandNames: Record<string, string>
}

export interface AgentDetectionResult {
  agentId: string
  installed: boolean
  targetDirectory?: string | null
  targetExists: boolean
  message?: string | null
}

export interface MountConflict {
  skillId: string
  mountName: string
  linkPath: string
  reason: string
}

export interface MountRequest {
  skillIds: string[]
  mode: string
  aliases?: Record<string, string>
  conflictPolicy?: string
}

export interface MountResult {
  agentId: string
  mode: string
  targetDirectory: string
  mounted: ManagedLink[]
  managedLinks: ManagedLink[]
  removed: string[]
  conflicts: MountConflict[]
  warnings: string[]
}

export interface AppSnapshot {
  settings: AppSettings
  scan?: ScanResult | null
  effectiveLibraryPaths: string[]
  agents: AgentStatus[]
  activeAgent: AgentStatus
}

export interface AppError {
  code: string
  message: string
  detail?: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 3,
  locale: "system",
  activeAgentId: "codex",
  libraryMode: "agent",
  libraryPath: null,
  agentSkillDirectories: {},
  showInvalid: false,
  watchLibrary: false,
  mountMode: "readonly",
  insertionMode: "prefix",
  appearance: "dark",
}

export const AGENTS: Array<{ id: AgentId; name: string }> = [
  { id: "codex", name: "Codex" },
  { id: "claude", name: "Claude Code" },
  { id: "opencode", name: "OpenCode" },
  { id: "cursor", name: "Cursor" },
]
