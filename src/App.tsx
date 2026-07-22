import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Books,
  Check,
  CheckCircle,
  ClipboardText,
  Command,
  FloppyDisk,
  FolderOpen,
  FolderSimple,
  GearSix,
  Info,
  MagnifyingGlass,
  Package,
  PaperPlaneTilt,
  PencilSimple,
  Play,
  Plus,
  SlidersHorizontal,
  Stack,
  Trash,
  TrashSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react"

import { DetailSheet } from "@/components/detail-sheet"
import { SkillCard } from "@/components/skill-card"
import { SettingsView } from "@/components/settings-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useI18n, type Translate } from "@/i18n"
import { buildCommandPreview, buildPromptForAgent } from "@/services/prompt-builder"
import {
  chooseFolder,
  chooseLibrary,
  copyText,
  deleteBundle as deleteBundleService,
  getSnapshot,
  isTauri,
  saveBundle as saveBundleService,
  saveSettings,
  scanAgentSkills,
  scanLibrary,
} from "@/services/tauri"
import { useAppStore } from "@/stores/app-store"
import type { AgentId, AgentStatus, AppSettings, AppView, Bundle, Skill } from "@/types"
import "./App.css"

const navItems: Array<{ id: AppView; key: string; icon: typeof Books }> = [
  { id: "library", key: "nav.library", icon: Books },
  { id: "bundles", key: "nav.bundles", icon: Package },
  { id: "active", key: "nav.active", icon: Stack },
  { id: "settings", key: "nav.settings", icon: GearSix },
]

function errorMessage(error: unknown, t: Translate, agentName: string) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
  const knownMessages: Record<string, string> = {
    clipboard_unavailable: t("error.clipboard"),
    skills_directory_missing: t("error.directoryMissing", { agent: agentName }),
    skills_directory_invalid: t("error.directoryInvalid", { agent: agentName }),
    library_mode_invalid: t("error.libraryMode"),
    library_not_configured: t("error.libraryMissing"),
    readonly_mode: t("error.readonly"),
    agent_id_invalid: t("error.agentInvalid"),
    locale_invalid: t("error.localeInvalid"),
  }
  return knownMessages[code] ?? (typeof error === "object" && error !== null && "message" in error ? String(error.message) : t("error.generic"))
}

function BundlesView({ bundles, skills, selectedIds, activeAgentId, isDemo, t, onApply, onSave, onDelete }: {
  bundles: Bundle[]
  skills: Skill[]
  selectedIds: string[]
  activeAgentId: AgentId
  isDemo: boolean
  t: Translate
  onApply: (bundle: Bundle) => void
  onSave: (bundle: Bundle) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftSkillIds, setDraftSkillIds] = useState<string[] | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [commandNames, setCommandNames] = useState<Record<string, string>>({})
  const selectedSkills = (draftSkillIds ?? selectedIds).map((id) => skills.find((skill) => skill.id === id)).filter((skill): skill is Skill => Boolean(skill))
  const startEdit = (bundle: Bundle) => {
    setEditingId(bundle.id)
    setDraftSkillIds(bundle.skillIds)
    setName(bundle.name)
    setDescription(bundle.description)
    setCommandNames(bundle.commandNames)
  }
  const resetForm = () => {
    setEditingId(null)
    setDraftSkillIds(null)
    setName("")
    setDescription("")
    setCommandNames({})
  }
  const save = async () => {
    if (selectedSkills.length === 0) return
    const selectedSkillIds = new Set(selectedSkills.map((skill) => skill.id))
    const aliases = Object.fromEntries(Object.entries(commandNames).filter(([id, value]) => selectedSkillIds.has(id) && value.trim()))
    try {
      await onSave({
        id: editingId ?? crypto.randomUUID(),
        name: name.trim() || t("bundles.untitled"),
        description: description.trim(),
        skillIds: selectedSkills.map((skill) => skill.id),
        defaultAgentId: activeAgentId,
        commandNames: aliases,
      })
      resetForm()
    } catch {
      // Keep the form open so the user can correct the invalid input.
    }
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-7 flex items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{t("bundles.kicker")}</p><h1 className="text-2xl font-semibold tracking-tight">{t("bundles.title")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("bundles.description")}</p></div><Badge variant="outline" className="border-primary/30 text-primary">{isDemo ? t("bundles.preview") : t("bundles.saved", { count: bundles.length })}</Badge></div>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-2">
            {bundles.length ? bundles.map((bundle) => {
              const compatible = !bundle.defaultAgentId || bundle.defaultAgentId === activeAgentId
              return <div key={bundle.id} className="rounded-xl border border-white/10 bg-card/70 p-4"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package size={17} weight="duotone" /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-medium">{bundle.name}</h2><p className="mt-1 text-xs text-muted-foreground">{bundle.description || t("bundles.noDescription")}</p><p className="mt-2 font-mono text-[10px] text-muted-foreground">{t("bundles.meta", { skills: bundle.skillIds.length, aliases: Object.keys(bundle.commandNames).length })}</p></div><div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon-sm" aria-label={t("bundles.apply", { name: bundle.name })} disabled={!compatible} onClick={() => onApply(bundle)}><Play size={14} weight="fill" /></Button><Button variant="ghost" size="icon-sm" aria-label={t("bundles.edit", { name: bundle.name })} onClick={() => startEdit(bundle)}><PencilSimple size={14} /></Button><Button variant="ghost" size="icon-sm" aria-label={t("bundles.delete", { name: bundle.name })} onClick={() => { if (window.confirm(t("confirm.deleteBundle", { name: bundle.name }))) void onDelete(bundle.id) }}><TrashSimple size={14} /></Button></div></div></div>
            }) : <div className="rounded-xl border border-dashed border-white/15 px-6 py-16 text-center"><Package size={28} className="mx-auto mb-3 text-muted-foreground" /><h2 className="text-sm font-medium">{t("bundles.none")}</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{t("bundles.noneDescription")}</p></div>}
          </section>
          <section className="rounded-xl border border-white/10 bg-card/70 p-5"><div className="mb-5 flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><FloppyDisk size={16} /></span><div><h2 className="text-sm font-medium">{editingId ? t("bundles.edit") : t("bundles.saveCurrent")}</h2><p className="text-xs text-muted-foreground">{selectedSkills.length ? t("bundles.selected", { count: selectedSkills.length }) : t("bundles.selectFirst")}</p></div></div><div className="space-y-3"><input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder={t("bundles.name")} aria-label={t("bundles.name")} className="h-9 w-full rounded-lg border border-white/10 bg-[#171b1f] px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60" /><textarea value={description} onChange={(event) => setDescription(event.currentTarget.value)} placeholder={t("bundles.descriptionPlaceholder")} aria-label={t("bundles.descriptionPlaceholder")} className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-[#171b1f] px-3 py-2 text-xs leading-5 text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60" />{selectedSkills.length > 0 && <div className="space-y-2 rounded-lg border border-white/10 bg-[#171b1f] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("bundles.aliases")}</p>{selectedSkills.map((skill) => <label key={skill.id} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">{skill.name}</span><input value={commandNames[skill.id] ?? ""} onChange={(event) => { const value = event.currentTarget.value; setCommandNames((current) => ({ ...current, [skill.id]: value })) }} placeholder={t("bundles.default")} aria-label={`${t("bundles.aliases")} ${skill.name}`} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" className="h-7 w-36 rounded-md border border-white/10 bg-[#20252a] px-2 text-[10px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/60" /></label>)}</div>}<div className="flex gap-2"><Button className="flex-1" disabled={!selectedSkills.length} onClick={() => void save()}><FloppyDisk size={14} /> {editingId ? t("bundles.update") : t("bundles.save")}</Button>{editingId && <Button variant="outline" onClick={resetForm}>{t("bundles.cancel")}</Button>}</div></div></section>
        </div>
      </div>
    </div>
  )
}

function ActiveSkillsView({ links, activeAgent, effectiveLibraryPaths, isDemo, t }: { links: Array<{ linkPath: string }>; activeAgent: AgentStatus; effectiveLibraryPaths: string[]; isDemo: boolean; t: Translate }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="mb-7 flex items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{t("active.kicker")}</p><h1 className="text-2xl font-semibold tracking-tight">{t("active.title")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("active.description", { agent: activeAgent.displayName })}</p></div><Badge variant="outline" className="border-primary/30 text-primary">{isDemo ? t("bundles.preview") : t("library.readOnly")}</Badge></div>
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-card/70 px-4 py-3"><FolderSimple size={18} className="text-primary" /><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{t("active.source")}</p><p className="truncate font-mono text-[11px] text-foreground/85">{effectiveLibraryPaths.length ? effectiveLibraryPaths.join(" · ") : t("settings.notAvailable")}</p></div>{activeAgent.targetExists ? <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle size={14} /> {t("active.ready")}</span> : <span className="inline-flex items-center gap-1.5 text-xs text-amber-200"><WarningCircle size={14} /> {t("active.unavailable")}</span>}</div>
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-xs text-primary"><CheckCircle size={16} /><span>{t("active.direct", { agent: activeAgent.displayName })}</span></div>
        {links.length > 0 && <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.05] px-4 py-3 text-xs text-amber-100"><WarningCircle size={16} /><span>{t("active.legacy", { count: links.length })}</span></div>}
        {activeAgent.skillCount === 0 ? <div className="rounded-xl border border-dashed border-white/15 px-6 py-16 text-center"><Stack size={28} className="mx-auto mb-3 text-muted-foreground" /><h2 className="text-sm font-medium">{t("active.empty")}</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{t("active.emptyDescription")}</p></div> : <div className="rounded-xl border border-white/10 bg-card/60 px-5 py-6"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Stack size={18} /></span><div><p className="text-sm font-medium">{t("active.found", { count: activeAgent.skillCount })}</p><p className="mt-1 text-xs text-muted-foreground">{t("library.readOnly")}</p></div></div></div>}
      </div>
    </div>
  )
}

function LoadingView({ t }: { t: Translate }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground"><ArrowClockwise size={16} className="mr-2 animate-spin" /> {t("state.loading")}</div>
}

function ErrorView({ message, onRetry, t }: { message: string; onRetry: () => void; t: Translate }) {
  return <div role="alert" className="flex min-h-0 flex-1 items-center justify-center px-6"><div className="max-w-md rounded-xl border border-destructive/25 bg-destructive/10 p-6 text-center"><WarningCircle size={28} className="mx-auto mb-3 text-destructive" /><h1 className="text-sm font-medium">{t("state.errorTitle")}</h1><p className="mt-2 text-xs leading-5 text-destructive/80">{message}</p><Button variant="outline" size="sm" className="mt-5 border-destructive/30" onClick={onRetry}>{t("state.retry")}</Button></div></div>
}

function LibraryHeader({ query, tag, tags, count, isLoading, t, onQueryChange, onTagChange, onRescan }: { query: string; tag: string; tags: string[]; count: number; isLoading: boolean; t: Translate; onQueryChange: (value: string) => void; onTagChange: (value: string) => void; onRescan: () => void }) {
  return <div className="border-b border-white/[0.08] px-7 pb-5 pt-6"><div className="flex gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#171b1f] px-2.5 text-muted-foreground transition-colors focus-within:border-primary/60 focus-within:text-primary"><MagnifyingGlass size={15} /><input data-search-input value={query} onChange={(event) => onQueryChange(event.currentTarget.value)} placeholder={t("library.search")} className="h-8 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70" aria-label={t("library.search")} />{!query && <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">⌘K</kbd>}{query && <button type="button" onClick={() => onQueryChange("")} className="rounded p-0.5 hover:bg-white/10" aria-label={t("library.search")}><X size={13} /></button>}</label><label className="flex w-[118px] shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-[#171b1f] px-2.5 text-muted-foreground"><SlidersHorizontal size={14} /><select value={tag} onChange={(event) => onTagChange(event.currentTarget.value)} className="w-full bg-transparent text-xs text-foreground outline-none" aria-label={t("library.filter")}><option value="all">{t("library.allTags")}</option>{tags.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><Button variant="outline" size="icon" onClick={onRescan} disabled={isLoading} aria-label={t("library.rescan")} className="size-9 border-white/10 bg-white/[0.025] text-muted-foreground"><ArrowClockwise size={15} className={isLoading ? "animate-spin" : ""} /></Button></div><div className="mt-5 flex items-baseline justify-between"><h1 className="text-[18px] font-semibold tracking-tight">{t("library.allSkills")}</h1><span className="font-mono text-[11px] text-muted-foreground">{t("library.count", { count })}</span></div></div>
}

function SelectedSkillRow({ skill, onRemove, onOpen, t }: { skill: Skill; onRemove: () => void; onOpen: () => void; t: Translate }) {
  return <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#242a2f] px-3 py-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Check size={13} weight="bold" /></span><button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left"><span className="block truncate font-mono text-[11px] font-medium text-foreground">{skill.name}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{skill.description}</span></button><button type="button" onClick={onRemove} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground" aria-label={t("library.remove", { name: skill.name })}><X size={14} /></button></div>
}

function LibraryView({ skills, selectedIds, activeSkillId, query, tag, tags, isLoading, t, onQueryChange, onTagChange, onRescan, onSelect, onOpen }: { skills: Skill[]; selectedIds: string[]; activeSkillId: string | null; query: string; tag: string; tags: string[]; isLoading: boolean; t: Translate; onQueryChange: (value: string) => void; onTagChange: (value: string) => void; onRescan: () => void; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  return <div className="grid min-h-0 flex-1 grid-cols-2"><section className="flex min-h-0 min-w-0 flex-col border-r border-white/[0.08]"><LibraryHeader query={query} tag={tag} tags={tags} count={skills.length} isLoading={isLoading} t={t} onQueryChange={onQueryChange} onTagChange={onTagChange} onRescan={onRescan} /><ScrollArea className="min-h-0 flex-1"><div className="space-y-2 px-5 py-3">{skills.length ? skills.map((skill) => <SkillCard key={skill.id} skill={skill} selected={selectedIds.includes(skill.id)} active={activeSkillId === skill.id} onSelect={() => onSelect(skill.id)} onOpen={() => onOpen(skill.id)} t={t} />) : <div className="px-6 py-16 text-center"><MagnifyingGlass size={25} className="mx-auto mb-3 text-muted-foreground/70" /><p className="text-sm text-muted-foreground">{t("library.noMatch")}</p></div>}</div></ScrollArea></section><PromptPanel onOpenSkill={onOpen} t={t} /></div>
}

function PromptPanel({ onOpenSkill, t }: { onOpenSkill: (id: string) => void; t: Translate }) {
  const { skills, selectedIds, commandNames, task, settings, activeAgent, isDemo, setTask, toggleSelection, clearSelection, setStatus } = useAppStore()
  const selectedSkills = selectedIds.map((id) => skills.find((skill) => skill.id === id)).filter((skill): skill is Skill => Boolean(skill))
  const prompt = buildPromptForAgent(settings.activeAgentId, selectedSkills, task, settings.insertionMode, commandNames)
  const preview = buildCommandPreview(selectedSkills, task, settings.insertionMode, commandNames, settings.activeAgentId, t("prompt.emptyPreview", { agent: activeAgent.displayName }))
  const invalidSelected = selectedSkills.some((skill) => !skill.isValid || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(skill.name))
  const copyPrompt = async () => {
    if (!prompt) {
      setStatus(t("prompt.empty"))
      return
    }
    try {
      await copyText(prompt)
      setStatus(t("status.copied", { agent: activeAgent.displayName }))
    } catch (error) {
      setStatus(errorMessage(error, t, activeAgent.displayName))
    }
  }
  return <aside className="flex min-h-0 min-w-0 flex-col bg-[#1c2024]"><ScrollArea className="min-h-0 flex-1"><div className="space-y-7 px-6 py-7"><section><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2.5"><h2 className="text-[17px] font-semibold tracking-tight">{t("prompt.selected")}</h2><Badge variant="secondary" className="h-6 min-w-6 justify-center rounded-full px-1.5 font-mono text-[11px]">{selectedSkills.length}</Badge></div>{selectedSkills.length > 0 && <Button variant="ghost" size="sm" className="gap-1.5 text-[11px] text-muted-foreground" onClick={clearSelection}><Trash size={14} /> {t("prompt.clear")}</Button>}</div><div className="space-y-2">{selectedSkills.length ? selectedSkills.map((skill) => <SelectedSkillRow key={skill.id} skill={skill} onRemove={() => toggleSelection(skill.id)} onOpen={() => onOpenSkill(skill.id)} t={t} />) : <div className="rounded-lg border border-dashed border-white/15 px-4 py-6 text-center"><Plus size={20} className="mx-auto mb-2 text-muted-foreground" /><p className="text-xs text-muted-foreground">{t("prompt.add")}</p></div>}</div></section><section><div className="mb-3 flex items-center justify-between"><h2 className="text-[17px] font-semibold tracking-tight">{t("prompt.task")} <span className="font-normal text-muted-foreground">({t("prompt.optional")})</span></h2><span className="font-mono text-[10px] text-muted-foreground">{task.length}/2000</span></div><Textarea value={task} onChange={(event) => setTask(event.currentTarget.value.slice(0, 2000))} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void copyPrompt() } }} placeholder={t("prompt.taskPlaceholder")} aria-keyshortcuts="Meta+Enter" className="min-h-[116px] resize-none border-white/10 bg-[#171b1f] text-[13px] leading-5 placeholder:text-muted-foreground/60" /></section><section><div className="mb-3 flex items-center justify-between"><h2 className="text-[17px] font-semibold tracking-tight">{t("prompt.preview")}</h2><Button variant="outline" size="sm" className="border-white/10 text-[11px] text-muted-foreground" onClick={() => void copyPrompt()} disabled={!prompt}><ClipboardText size={14} /> {t("prompt.copy")}</Button></div><div className="overflow-hidden rounded-lg border border-white/10 bg-[#14181b] p-3.5"><pre className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-foreground/75">{preview}</pre></div><div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-primary/35 bg-primary/[0.06] px-3 py-2.5 text-[11px] leading-4 text-primary/90"><Info size={15} className="shrink-0" /> {isDemo ? t("prompt.browserNote") : t("prompt.copyNote")}</div>{invalidSelected && <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.05] px-3 py-2.5 text-[11px] leading-4 text-amber-100"><WarningCircle size={15} className="shrink-0" /> {t("prompt.invalid")}</div>}</section></div></ScrollArea><div className="border-t border-white/[0.09] p-5"><Button className="h-10 w-full gap-2 text-[13px] font-semibold" onClick={() => void copyPrompt()} disabled={!prompt}><PaperPlaneTilt size={16} weight="fill" /> {t("prompt.copyFor", { agent: activeAgent.displayName })} <ArrowRight size={15} /></Button><p className="mt-2 text-center text-[10px] text-muted-foreground">{t("prompt.copyNote")}</p></div></aside>
}

function App() {
  const { view, skills, selectedIds, activeSkillId, query, tag, settings, effectiveLibraryPaths, agents, activeAgent, scanWarnings, isLoading, isDemo, managedLinks, bundles, error, statusMessage, setView, setQuery, setTag, setActiveSkill, toggleSelection, clearSelection, setLibrary, setScanResult, setSettings, setAgents, setBundles, applyBundle, setStatus, hydrate } = useAppStore()
  const { t } = useI18n(settings.locale)
  const [detailOpen, setDetailOpen] = useState(false)
  const previousAgentSettings = useRef<AppSettings | null>(null)

  useEffect(() => { void hydrate() }, [hydrate])
  useEffect(() => { if (!statusMessage) return; const timer = window.setTimeout(() => setStatus(null), 4200); return () => window.clearTimeout(timer) }, [statusMessage, setStatus])
  useEffect(() => {
  const handleShortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector<HTMLInputElement>('input[data-search-input]')?.focus() } }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])
  useEffect(() => {
    if (!isTauri() || isDemo || !settings.watchLibrary) return
    let cancelled = false
    const refresh = async () => {
      try {
        const result = settings.libraryMode === "agent" ? await scanAgentSkills(settings.activeAgentId) : settings.libraryPath ? await scanLibrary(settings.libraryPath) : null
        if (!cancelled && result) setScanResult(result.skills, result.warnings)
      } catch (watchError) { if (!cancelled) setStatus(errorMessage(watchError, t, activeAgent.displayName)) }
    }
    // ponytail: polling avoids another filesystem dependency; replace when event-level precision matters.
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [activeAgent.displayName, isDemo, setScanResult, setStatus, settings.activeAgentId, settings.libraryMode, settings.libraryPath, settings.watchLibrary, t])

  const tags = useMemo(() => [...new Set(skills.flatMap((skill) => skill.tags))].sort(), [skills])
  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return skills.filter((skill) => {
      if (!settings.showInvalid && !skill.isValid) return false
      if (tag !== "all" && !skill.tags.includes(tag)) return false
      if (!normalizedQuery) return true
      return [skill.name, skill.description, ...skill.tags].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [query, settings.showInvalid, skills, tag])
  const activeSkill = skills.find((skill) => skill.id === activeSkillId) ?? null

  const refreshSnapshot = async (saved: AppSettings, clearOldSelection: boolean) => {
    const snapshot = await getSnapshot()
    setLibrary(saved, snapshot.scan?.skills ?? [], snapshot.scan?.warnings ?? [], snapshot.effectiveLibraryPaths)
    setAgents(snapshot.agents, snapshot.activeAgent)
    if (clearOldSelection) clearSelection()
  }
  const rescan = async () => {
    try {
      const result = settings.libraryMode === "agent" ? await scanAgentSkills(settings.activeAgentId) : settings.libraryPath ? await scanLibrary(settings.libraryPath) : null
      if (!result) { setStatus(settings.libraryMode === "agent" ? t("status.agentChoose") : t("status.libraryChoose")); return }
      setScanResult(result.skills, result.warnings)
      setStatus(t("status.scanned", { count: result.skills.length }))
    } catch (scanError) { setStatus(errorMessage(scanError, t, activeAgent.displayName)) }
  }
  const selectLibrary = async () => {
    if (!isTauri()) { setStatus(t("status.folderAppOnly")); return }
    try {
      const path = await chooseLibrary(t("settings.chooseExternal"))
      if (!path) return
      const nextSettings = { ...settings, libraryMode: "external" as const, libraryPath: path }
      const saved = await saveSettings(nextSettings)
      await refreshSnapshot(saved, true)
      setStatus(t("status.libraryConnected", { count: useAppStore.getState().skills.length }))
    } catch (selectionError) { setStatus(errorMessage(selectionError, t, activeAgent.displayName)) }
  }
  const changeSettings = async (nextSettings: AppSettings, rememberAgent = true) => {
    const previous = settings
    const agentChanged = nextSettings.activeAgentId !== previous.activeAgentId
    if (rememberAgent) previousAgentSettings.current = agentChanged ? previous : null
    setSettings(nextSettings)
    if (!isTauri()) {
      const nextAgent = agents.find((agent) => agent.agentId === nextSettings.activeAgentId) ?? activeAgent
      setAgents(agents.map((agent) => agent.agentId === nextAgent.agentId ? { ...agent, skillCount: skills.length } : agent), nextAgent)
      if (agentChanged) clearSelection()
      setStatus(agentChanged ? t("status.switchAgent", { agent: nextAgent.displayName }) : t("status.saved"))
      return
    }
    try {
      const saved = await saveSettings(nextSettings)
      await refreshSnapshot(saved, agentChanged)
      const savedAgent = useAppStore.getState().activeAgent
      setStatus(agentChanged ? t("status.switchAgent", { agent: savedAgent.displayName }) : t("status.saved"))
    } catch (settingsError) { setSettings(previous); setStatus(errorMessage(settingsError, t, activeAgent.displayName)) }
  }
  const restorePreviousAgent = async () => {
    const previous = previousAgentSettings.current
    if (!previous) return
    await changeSettings(previous, false)
    if (useAppStore.getState().settings.activeAgentId === previous.activeAgentId && useAppStore.getState().settings.libraryMode === previous.libraryMode) previousAgentSettings.current = null
  }
  const chooseAgentDirectory = async (agentId: AgentId) => {
    if (!isTauri()) { setStatus(t("status.folderAppOnly")); return }
    try {
      const path = await chooseFolder(t("settings.chooseFolder"))
      if (!path) return
      await changeSettings({ ...settings, activeAgentId: agentId, libraryMode: "agent", agentSkillDirectories: { ...settings.agentSkillDirectories, [agentId]: path } })
    } catch (selectionError) { setStatus(errorMessage(selectionError, t, activeAgent.displayName)) }
  }
  const resetAgentDirectory = async (agentId: AgentId) => {
    if (!window.confirm(t("confirm.resetFolder", { agent: agents.find((item) => item.agentId === agentId)?.displayName ?? agentId }))) return
    const directories = { ...settings.agentSkillDirectories }
    delete directories[agentId]
    await changeSettings({ ...settings, agentSkillDirectories: directories })
  }
  const useAgentSkills = async () => { await changeSettings({ ...settings, libraryMode: "agent" }) }
  const saveBundle = async (bundle: Bundle) => {
    try { const saved = isTauri() ? await saveBundleService(bundle) : bundle; setBundles([...bundles.filter((item) => item.id !== saved.id), saved]); setStatus(t("status.bundleSaved", { name: saved.name })) } catch (bundleError) { setStatus(errorMessage(bundleError, t, activeAgent.displayName)); throw bundleError }
  }
  const deleteBundle = async (id: string) => {
    try { const next = isTauri() ? await deleteBundleService(id) : bundles.filter((bundle) => bundle.id !== id); setBundles(next); setStatus(t("status.bundleDeleted")) } catch (bundleError) { setStatus(errorMessage(bundleError, t, activeAgent.displayName)) }
  }
  const openDetails = (id: string) => { setActiveSkill(id); setDetailOpen(true) }
  const renderContent = () => {
    if (isLoading && !isDemo) return <LoadingView t={t} />
    if (error && !isDemo) return <ErrorView message={errorMessage(error, t, activeAgent.displayName)} onRetry={() => void hydrate()} t={t} />
    if (view === "settings") return <SettingsView settings={settings} effectiveLibraryPaths={effectiveLibraryPaths} agents={agents} activeAgent={activeAgent} scanWarnings={scanWarnings} isDemo={isDemo} t={t} onChooseLibrary={selectLibrary} onUseAgent={useAgentSkills} onChooseAgentDirectory={chooseAgentDirectory} onResetAgentDirectory={resetAgentDirectory} onChange={changeSettings} />
    if (view === "bundles") return <BundlesView bundles={bundles} skills={skills} selectedIds={selectedIds} activeAgentId={settings.activeAgentId} isDemo={isDemo} t={t} onApply={(bundle) => { if (bundle.defaultAgentId && bundle.defaultAgentId !== settings.activeAgentId) return; applyBundle(bundle); setStatus(t("bundles.applied", { name: bundle.name })) }} onSave={saveBundle} onDelete={deleteBundle} />
    if (view === "active") return <ActiveSkillsView links={managedLinks} activeAgent={activeAgent} effectiveLibraryPaths={effectiveLibraryPaths} isDemo={isDemo} t={t} />
    return <LibraryView skills={filteredSkills} selectedIds={selectedIds} activeSkillId={activeSkillId} query={query} tag={tag} tags={tags} isLoading={isLoading} t={t} onQueryChange={setQuery} onTagChange={setTag} onRescan={() => void rescan()} onSelect={toggleSelection} onOpen={openDetails} />
  }

  const needsOnboarding = isTauri() && !isDemo && !isLoading && !error && (settings.libraryMode === "agent" ? effectiveLibraryPaths.length === 0 : !settings.libraryPath)
  const previousAgent = previousAgentSettings.current ? agents.find((agent) => agent.agentId === previousAgentSettings.current?.activeAgentId) : null
  return <main className="app-shell flex h-screen min-h-[560px] min-w-[840px] flex-col overflow-hidden bg-background text-foreground"><header className="relative flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#181c20] px-5" data-tauri-drag-region><div className="flex items-center gap-2.5" data-tauri-drag-region><span className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><Command size={17} weight="bold" /></span><span className="text-[13px] font-semibold tracking-wide">SkillDeck</span></div><span className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">{t("header.console")}</span><div className="flex items-center gap-2"><select value={settings.activeAgentId} onChange={(event) => void changeSettings({ ...settings, activeAgentId: event.currentTarget.value as AgentId, libraryMode: "agent" })} className="max-w-[140px] rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-foreground outline-none" aria-label={t("settings.agent")}><option value="codex">Codex</option><option value="claude">Claude Code</option><option value="opencode">OpenCode</option><option value="cursor">Cursor</option></select><div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1.5"><span className={`size-1.5 rounded-full ${activeAgent.targetExists ? "bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.65)]" : "bg-destructive"}`} /><span className="text-[11px] text-muted-foreground">{activeAgent.targetExists ? t("header.ready", { agent: activeAgent.displayName, count: activeAgent.skillCount }) : t("header.unavailable", { agent: activeAgent.displayName })}</span></div></div></header>{scanWarnings.length > 0 && view === "library" && <div className="border-b border-amber-400/20 bg-amber-400/[0.06] px-5 py-2 text-xs text-amber-200/80"><span className="inline-flex items-center gap-2"><Info size={14} /> {t("settings.scanWarnings")} · {scanWarnings.length}</span></div>}{renderContent()}<footer className="flex h-[52px] shrink-0 items-center border-t border-white/[0.08] bg-[#171a1e] px-3"><nav className="flex items-center gap-1" aria-label={t("nav.library")}>{navItems.map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} type="button" onClick={() => setView(item.id)} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] transition-colors ${active ? "bg-white/[0.09] text-foreground" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`} aria-current={active ? "page" : undefined}><Icon size={15} weight={active ? "fill" : "regular"} /><span>{t(item.key)}</span></button> })}</nav><div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground"><span className="hidden sm:inline">{t("library.readOnly")}</span><span className="size-1 rounded-full bg-primary" /><span>v0.1.0</span></div></footer><DetailSheet skill={activeSkill} open={detailOpen} onOpenChange={setDetailOpen} t={t} />{statusMessage && <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-[68px] left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/25 bg-[#29251d] px-4 py-2 text-xs text-primary shadow-2xl">{statusMessage}</div>}{needsOnboarding && <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#191d21]/95 px-6"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#23282d] p-7 shadow-2xl"><div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"><Command size={25} weight="bold" /></div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{t("onboarding.unavailable", { agent: activeAgent.displayName })}</p><h1 className="text-2xl font-semibold tracking-tight">{t("onboarding.title")}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{t("onboarding.description", { agent: activeAgent.displayName })}</p><div className="mt-6 grid gap-2">{previousAgent && <Button variant="ghost" className="h-10 w-full" onClick={() => void restorePreviousAgent()}><ArrowLeft size={16} /> {t("onboarding.back", { agent: previousAgent.displayName })}</Button>}<Button className="h-10 w-full" onClick={() => void chooseAgentDirectory(settings.activeAgentId)}><FolderOpen size={16} /> {t("onboarding.custom")}</Button><Button variant="outline" className="h-10 w-full" onClick={() => void selectLibrary()}><Plus size={16} weight="bold" /> {t("onboarding.external")}</Button></div><p className="mt-3 text-center text-[10px] text-muted-foreground">{t("onboarding.settings")}</p></div></div>}</main>
}

export default App
