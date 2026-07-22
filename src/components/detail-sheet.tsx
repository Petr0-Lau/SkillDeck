import { ArrowSquareOut, CheckCircle, WarningCircle } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import type { Skill } from "@/types"
import type { Translate } from "@/i18n"

interface DetailSheetProps {
  skill: Skill | null
  open: boolean
  onOpenChange: (open: boolean) => void
  t: Translate
}

export function DetailSheet({ skill, open, onOpenChange, t }: DetailSheetProps) {
  if (!skill) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(420px,92vw)] border-white/10 bg-[#20252a] p-0">
        <SheetHeader className="border-b border-white/10 px-6 py-6 pr-14">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            {skill.isValid ? <CheckCircle size={22} weight="duotone" /> : <WarningCircle size={22} weight="duotone" />}
          </div>
          <SheetTitle className="font-mono text-lg tracking-tight">{skill.name}</SheetTitle>
          <SheetDescription className="mt-2 text-[13px] leading-5 text-muted-foreground">
            {skill.description || t("library.noDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto px-6 py-6">
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("details.tags")}</p>
            <div className="flex flex-wrap gap-1.5">
              {skill.tags.length ? skill.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>) : <span className="text-xs text-muted-foreground">{t("details.noTags")}</span>}
            </div>
          </section>
          <Separator className="bg-white/10" />
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("details.location")}</p>
            <p className="break-all font-mono text-[11px] leading-5 text-foreground/80">{skill.skillFilePath}</p>
          </section>
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("details.preview")}</p>
            <p className="whitespace-pre-wrap text-[13px] leading-6 text-foreground/80">{skill.preview || t("details.empty")}</p>
          </section>
          {!skill.isValid && (
            <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-destructive"><WarningCircle size={15} /> {t("details.validation")}</div>
              <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-destructive/80">
                {skill.validationErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </section>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ArrowSquareOut size={14} /> {t("details.source")}: {skill.source}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
