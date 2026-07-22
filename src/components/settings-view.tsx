import { Check, FolderOpen, ShieldCheck, SlidersHorizontal, Translate as TranslateIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { AgentId, AgentStatus, AppSettings } from "@/types"
import type { Translate } from "@/i18n"

interface SettingsViewProps {
  settings: AppSettings
  effectiveLibraryPaths: string[]
  agents: AgentStatus[]
  activeAgent: AgentStatus
  scanWarnings: string[]
  isDemo: boolean
  t: Translate
  onChooseLibrary: () => void
  onUseAgent: () => void | Promise<void>
  onChooseAgentDirectory: (agentId: AgentId) => void
  onResetAgentDirectory: (agentId: AgentId) => void
  onChange: (settings: AppSettings) => void
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full border transition-colors ${checked ? "border-primary bg-primary" : "border-white/15 bg-white/10"}`}
    >
      <span className={`absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  )
}

export function SettingsView({ settings, effectiveLibraryPaths, agents, activeAgent, scanWarnings, isDemo, t, onChooseLibrary, onUseAgent, onChooseAgentDirectory, onResetAgentDirectory, onChange }: SettingsViewProps) {
  const update = (patch: Partial<AppSettings>) => onChange({ ...settings, ...patch })
  const automatic = settings.libraryMode === "agent"
  const customDirectory = settings.agentSkillDirectories[settings.activeAgentId] ?? null
  const sourcePath = automatic ? effectiveLibraryPaths.join(" · ") : settings.libraryPath

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-9">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{t("settings.kicker")}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("settings.description")}</p>
          </div>
          <SlidersHorizontal size={22} className="mt-1 text-muted-foreground" />
        </div>

        {isDemo && <Alert className="mb-6 border-primary/25 bg-primary/10 text-foreground"><Check size={17} className="text-primary" /><AlertTitle>{t("settings.preview")}</AlertTitle><AlertDescription className="text-muted-foreground">{t("settings.previewDescription")}</AlertDescription></Alert>}
        {scanWarnings.length > 0 && <Alert className="mb-6 border-amber-400/25 bg-amber-400/10 text-amber-100"><ShieldCheck size={17} /><AlertTitle>{t("settings.scanWarnings")}</AlertTitle><AlertDescription className="text-amber-100/75"><ul className="list-disc space-y-1 pl-4">{scanWarnings.slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert>}

        <section className="rounded-xl border border-white/10 bg-card/70">
          <div className="flex items-center gap-3 px-5 py-4"><FolderOpen size={18} className="text-primary" /><div><h2 className="text-sm font-medium">{t("settings.sources")}</h2><p className="text-xs text-muted-foreground">{t("settings.sourcesDescription")}</p></div></div>
          <Separator className="bg-white/10" />
          <div className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="text-xs text-muted-foreground">{t("settings.currentSource")}</p><p className="mt-1 text-xs text-foreground/85">{automatic ? `${activeAgent.displayName} · ${t("settings.automatic")}` : t("settings.external")}</p><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{sourcePath || t("settings.notAvailable")}</p></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={onChooseLibrary}>{t("settings.chooseExternal")}</Button>{!automatic && <Button size="sm" onClick={() => void onUseAgent()}>{t("settings.useAgent")}</Button>}</div></div>
        </section>

        <section className="mt-5 rounded-xl border border-white/10 bg-card/70">
          <div className="flex items-center gap-3 px-5 py-4"><ShieldCheck size={18} className="text-primary" /><div><h2 className="text-sm font-medium">{t("settings.agent")}</h2><p className="text-xs text-muted-foreground">{t("settings.agentDescription")}</p></div></div>
          <Separator className="bg-white/10" />
          <div className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm">{activeAgent.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{activeAgent.targetExists ? t("active.ready") : t("active.unavailable")}</p></div><select value={settings.activeAgentId} onChange={(event) => update({ activeAgentId: event.currentTarget.value as AgentId, libraryMode: "agent" })} className="rounded-lg border border-white/10 bg-[#171b1f] px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/60" aria-label={t("settings.agent")}>
            {agents.map((agent) => <option key={agent.agentId} value={agent.agentId}>{agent.displayName}</option>)}
          </select></div>
          <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4"><div className="min-w-0"><p className="text-sm">{t("settings.customDirectory")}</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{customDirectory || activeAgent.skillDirectories.join(" · ") || t("settings.notAvailable")}</p></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => onChooseAgentDirectory(settings.activeAgentId)}>{t("settings.chooseFolder")}</Button>{customDirectory && <Button variant="ghost" size="sm" onClick={() => onResetAgentDirectory(settings.activeAgentId)}>{t("settings.resetFolder")}</Button>}</div></div>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><div><p className="text-sm">{t("settings.language")}</p><p className="mt-1 text-xs text-muted-foreground">{t("settings.languageDescription")}</p></div><div className="flex items-center gap-2"><TranslateIcon size={16} className="text-muted-foreground" /><select value={settings.locale} onChange={(event) => update({ locale: event.currentTarget.value as AppSettings["locale"] })} className="rounded-lg border border-white/10 bg-[#171b1f] px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/60" aria-label={t("settings.language")}><option value="system">{t("settings.system")}</option><option value="zh-CN">{t("settings.chinese")}</option><option value="en">{t("settings.english")}</option></select></div></div>
        </section>

        <section className="mt-5 rounded-xl border border-white/10 bg-card/70">
          <div className="flex items-center gap-3 px-5 py-4"><SlidersHorizontal size={18} className="text-primary" /><div><h2 className="text-sm font-medium">{t("settings.delivery")}</h2><p className="text-xs text-muted-foreground">{t("settings.deliveryDescription")}</p></div></div>
          <Separator className="bg-white/10" />
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><div><p className="text-sm">{t("settings.watch")}</p><p className="mt-1 text-xs text-muted-foreground">{t("settings.watchDescription")}</p></div><Toggle checked={settings.watchLibrary} onChange={(value) => update({ watchLibrary: value })} label={t("settings.watch")} /></div>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><div><p className="text-sm">{t("settings.invalid")}</p><p className="mt-1 text-xs text-muted-foreground">{t("settings.invalidDescription")}</p></div><Toggle checked={settings.showInvalid} onChange={(value) => update({ showInvalid: value })} label={t("settings.invalid")} /></div>
          <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4"><div><p className="text-sm">{t("settings.insertion")}</p><p className="mt-1 text-xs text-muted-foreground">{t("settings.insertionDescription")}</p></div><select value={settings.insertionMode} onChange={(event) => update({ insertionMode: event.currentTarget.value })} className="rounded-lg border border-white/10 bg-[#171b1f] px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/60" aria-label={t("settings.insertion")}><option value="prefix">{t("settings.beginning")}</option><option value="suffix">{t("settings.end")}</option></select></div>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><div><p className="text-sm">{t("settings.delivery")}</p><p className="mt-1 text-xs text-muted-foreground">{t("settings.deliveryDescription")}</p></div><span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">{t("settings.clipboard")}</span></div>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><div><p className="text-sm">{t("settings.shortcuts")}</p><p className="mt-1 text-xs text-muted-foreground">{t("settings.shortcutsDescription")}</p></div><SlidersHorizontal size={17} className="text-muted-foreground" /></div>
        </section>
      </div>
    </div>
  )
}
