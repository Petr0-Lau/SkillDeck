import { Check, Code, DotsThree, GearSix, Lightning, Palette, Plus, TerminalWindow } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Skill } from "@/types"
import type { Translate } from "@/i18n"

interface SkillCardProps {
  skill: Skill
  selected: boolean
  active: boolean
  onSelect: () => void
  onOpen: () => void
  t: Translate
}

const icons = [Palette, Code, TerminalWindow, Lightning, GearSix]

export function SkillCard({ skill, selected, active, onSelect, onOpen, t }: SkillCardProps) {
  const Icon = icons[skill.name.length % icons.length]

  return (
    <div
      className={cn(
        "group relative flex min-w-0 w-full items-center gap-4 overflow-hidden rounded-xl border px-4 py-4 text-left transition-colors",
        active ? "border-primary/35 bg-white/[0.055]" : "border-white/[0.09] bg-[#20252a] hover:border-white/20 hover:bg-[#252b30]",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-start gap-4 overflow-hidden text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        onClick={onOpen}
        aria-label={t("library.open", { name: skill.name })}
      >
        <span
          className={cn(
            "flex size-[52px] shrink-0 items-center justify-center rounded-xl border text-amber-300",
            active ? "border-primary/50 bg-primary/10" : "border-white/10 bg-[#272d32]",
          )}
        >
          <Icon size={17} weight="duotone" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-[14px] font-semibold tracking-[-0.01em] text-foreground">
              {skill.name}
            </span>
            {!skill.isValid && <span className="size-1.5 rounded-full bg-destructive" title={t("library.invalid")} />}
          </span>
          <span className="mt-1 block max-h-9 overflow-hidden text-[12px] leading-[18px] text-muted-foreground">
            {skill.description || t("library.noDescription")}
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {skill.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline" className="h-5 border-white/15 px-1.5 text-[10px] font-normal text-muted-foreground">{tag}</Badge>)}
          </span>
        </span>
      </button>

      <button
        type="button"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
          selected
            ? "border-primary/70 bg-primary text-primary-foreground"
          : "border-white/10 bg-transparent text-muted-foreground hover:border-primary/50 hover:text-primary",
        )}
        onClick={onSelect}
        aria-label={selected ? t("library.remove", { name: skill.name }) : t("library.select", { name: skill.name })}
        aria-pressed={selected}
      >
        {selected ? <Check size={15} weight="bold" /> : <Plus size={16} weight="bold" />}
      </button>

      <button
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-white/10 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onOpen}
        aria-label={t("library.open", { name: skill.name })}
      >
        <DotsThree size={18} weight="bold" />
      </button>
    </div>
  )
}
