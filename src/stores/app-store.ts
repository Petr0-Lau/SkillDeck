import { create } from "zustand"

import { sampleSkills } from "@/data/sample-skills"
import {
  DEFAULT_SETTINGS,
  type AgentStatus,
  type AppError,
  type AppSettings,
  type AppView,
  type Bundle,
  type ManagedLink,
  type Skill,
} from "@/types"
import { getBundles, getManagedLinks, getSnapshot, isTauri } from "@/services/tauri"

const demoAgent = (agentId: AgentStatus["agentId"], displayName: string, count: number): AgentStatus => ({
  agentId,
  displayName,
  installed: true,
  appPath: null,
  skillDirectories: [`~/.${agentId}/skills`],
  skillCount: count,
  targetDirectory: `~/.${agentId}/skills`,
  targetExists: true,
  message: null,
})

interface AppState {
  view: AppView
  skills: Skill[]
  selectedIds: string[]
  activeSkillId: string | null
  query: string
  tag: string
  task: string
  settings: AppSettings
  effectiveLibraryPaths: string[]
  agents: AgentStatus[]
  activeAgent: AgentStatus
  managedLinks: ManagedLink[]
  bundles: Bundle[]
  commandNames: Record<string, string>
  scanWarnings: string[]
  isLoading: boolean
  isDemo: boolean
  error: AppError | null
  statusMessage: string | null
  setView: (view: AppView) => void
  setQuery: (query: string) => void
  setTag: (tag: string) => void
  setTask: (task: string) => void
  setActiveSkill: (id: string | null) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  setLibrary: (settings: AppSettings, skills: Skill[], warnings: string[], effectiveLibraryPaths?: string[]) => void
  setScanResult: (skills: Skill[], warnings: string[]) => void
  setSettings: (settings: AppSettings) => void
  setAgents: (agents: AgentStatus[], activeAgent: AgentStatus) => void
  setManagedLinks: (managedLinks: ManagedLink[]) => void
  setBundles: (bundles: Bundle[]) => void
  applyBundle: (bundle: Bundle) => void
  setStatus: (statusMessage: string | null) => void
  hydrate: () => Promise<void>
}

const demoAgents = [
  demoAgent("codex", "Codex", sampleSkills.length),
  demoAgent("claude", "Claude Code", sampleSkills.length),
  demoAgent("opencode", "OpenCode", sampleSkills.length),
  demoAgent("cursor", "Cursor", sampleSkills.length),
]

export const useAppStore = create<AppState>((set) => ({
  view: "library",
  skills: [],
  selectedIds: [],
  activeSkillId: null,
  query: "",
  tag: "all",
  task: "",
  settings: DEFAULT_SETTINGS,
  effectiveLibraryPaths: [],
  agents: demoAgents,
  activeAgent: demoAgents[0],
  managedLinks: [],
  bundles: [],
  commandNames: {},
  scanWarnings: [],
  isLoading: true,
  isDemo: false,
  error: null,
  statusMessage: null,
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
  setTag: (tag) => set({ tag }),
  setTask: (task) => set({ task }),
  setActiveSkill: (activeSkillId) => set({ activeSkillId }),
  toggleSelection: (id) =>
    set((state) => {
      if (state.selectedIds.includes(id)) {
        const commandNames = { ...state.commandNames }
        delete commandNames[id]
        return { selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id), commandNames }
      }
      return { selectedIds: [...state.selectedIds, id] }
    }),
  clearSelection: () => set({ selectedIds: [], commandNames: {} }),
  setLibrary: (settings, skills, scanWarnings, effectiveLibraryPaths = []) =>
    set({ settings, skills, scanWarnings, effectiveLibraryPaths, isLoading: false, error: null, isDemo: false }),
  setScanResult: (skills, scanWarnings) => set({ skills, scanWarnings, isLoading: false, error: null }),
  setSettings: (settings) => set({ settings }),
  setAgents: (agents, activeAgent) => set({ agents, activeAgent }),
  setManagedLinks: (managedLinks) => set({ managedLinks }),
  setBundles: (bundles) => set({ bundles }),
  applyBundle: (bundle) => set({ selectedIds: bundle.skillIds, commandNames: bundle.commandNames, view: "library" }),
  setStatus: (statusMessage) => set({ statusMessage }),
  hydrate: async () => {
    if (!isTauri()) {
      const settings = { ...DEFAULT_SETTINGS, activeAgentId: "codex" as const }
      set({
        settings,
        skills: sampleSkills,
        effectiveLibraryPaths: [],
        agents: demoAgents,
        activeAgent: demoAgents[0],
        selectedIds: sampleSkills.slice(0, 3).map((skill) => skill.id),
        commandNames: {},
        bundles: [{
          id: "frontend-command-console",
          name: "Frontend Command Console",
          description: "The default UI build set.",
          skillIds: sampleSkills.slice(0, 3).map((skill) => skill.id),
          defaultAgentId: "codex",
          commandNames: {},
        }],
        activeSkillId: sampleSkills[0]?.id ?? null,
        isLoading: false,
        isDemo: true,
        error: null,
      })
      return
    }

    try {
      const [snapshot, managedLinks, bundles] = await Promise.all([
        getSnapshot(),
        getManagedLinks(),
        getBundles(),
      ])
      set({
        settings: snapshot.settings,
        skills: snapshot.scan?.skills ?? [],
        effectiveLibraryPaths: snapshot.effectiveLibraryPaths,
        agents: snapshot.agents,
        activeAgent: snapshot.activeAgent,
        scanWarnings: snapshot.scan?.warnings ?? [],
        managedLinks,
        bundles,
        commandNames: {},
        selectedIds: [],
        activeSkillId: snapshot.scan?.skills[0]?.id ?? null,
        isLoading: false,
        isDemo: false,
        error: null,
      })
    } catch (error) {
      const appError = (typeof error === "object" && error !== null && "code" in error
        ? error
        : { code: "snapshot_failed", message: "无法加载 SkillDeck 配置" }) as AppError
      set({ isLoading: false, error: appError, isDemo: false })
    }
  },
}))
