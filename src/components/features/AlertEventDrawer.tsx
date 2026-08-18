import { Check, ExternalLink, X } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  SEVERITY_COLOR, SEVERITY_LABEL, alertEventOrigin, alertEventVideoTitle,
  describeAlertEvent, describeChannels, parseAlertSnapshot,
} from "@/lib/alerts"
import { tEnum } from "@/i18n/enums"
import type { AlertEvent } from "@/lib/api/alerts"

/**
 * Detalhe do disparo (o `HistoryDrawer` do design). A linha do histórico mostra
 * o resumo; aqui fica o que o `snapshot` guardou e que hoje só existia no CSV —
 * score, classificação, views e caminho do pipeline no instante em que a regra
 * bateu.
 *
 * **A linha do tempo do design ficou de fora**: ela pressupõe "reconhecido pela
 * equipe" e "marcado como resolvido", e o domínio tem um booleano por usuário
 * (ADR-036), não um fluxo de tratativa. Desenhar três etapas sobre um booleano
 * seria inventar processo que ninguém executa.
 */
export function AlertEventDrawer({
  event, open, onClose, onMarkRead, isMarking,
}: {
  event: AlertEvent | null
  open: boolean
  onClose: () => void
  onMarkRead: (id: string) => void
  isMarking: boolean
}) {
  if (!event) return null

  const snapshot = parseAlertSnapshot(event.snapshot)
  const videoTitle = alertEventVideoTitle(event)
  const origin = alertEventOrigin(event)
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(event.youtubeVideoId)}`
  const shortId = event.id.replace(/-/g, "").slice(0, 6).toUpperCase()

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ width: 520, maxWidth: "94vw" }}
        className="p-0 overflow-y-auto gap-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhe do disparo: {event.ruleName}</SheetTitle>
        </SheetHeader>

        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b border-border-soft"
          style={{ background: "var(--surface)" }}
        >
          <span className="eyebrow">Detalhe do disparo</span>
          <span className="font-mono-zoe text-[10.5px] text-ink-muted-2">#{shortId}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto p-1.5 -mr-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: SEVERITY_COLOR[event.severity] }}
              aria-hidden
            />
            <span className={`${event.isRead ? "chip" : "chip chip-primary"} text-[10.5px]`}>
              {event.isRead ? "Lido" : "Novo"}
            </span>
            <span className="font-mono-zoe text-[11.5px] text-ink-muted">
              {new Date(event.triggeredAt).toLocaleString("pt-BR")}
            </span>
          </div>

          <h2 className="text-[20px] font-semibold leading-snug m-0" style={{ color: "var(--ink)" }}>
            {describeAlertEvent(event)}
          </h2>

          {videoTitle && (
            <p className="text-[13.5px] leading-relaxed m-0" style={{ color: "var(--ink-2)" }}>
              {videoTitle}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Fact label="Regra" value={event.ruleName} />
            <Fact label="Marca" value={event.brandName} />
            <Fact label="Gravidade" value={SEVERITY_LABEL[event.severity]} />
            {/* `null` = disparo anterior a 09/08, sem o campo no snapshot.
                Rotular errado é pior que não rotular (ADR-035 / D6). */}
            {origin && <Fact label="Origem" value={origin === "owned" ? "Canal próprio" : "Terceiro"} />}
          </div>

          {snapshot && (
            <div>
              <div className="eyebrow mb-2.5">O que a regra viu</div>
              <div className="rounded-lg border border-border-soft divide-y divide-border-soft">
                {snapshot.score != null && (
                  <SnapshotRow label="Score da análise" value={snapshot.score.toFixed(2)} />
                )}
                {snapshot.classification && (
                  <SnapshotRow label="Classificação" value={tEnum("classification", snapshot.classification)} />
                )}
                {snapshot.views != null && (
                  <SnapshotRow label="Views no disparo" value={snapshot.views.toLocaleString("pt-BR")} />
                )}
                {snapshot.pipelinePath && (
                  <SnapshotRow label="Cobertura" value={tEnum("pipelinePath", snapshot.pipelinePath)} />
                )}
                <SnapshotRow label="Canais notificados" value={describeChannels(["InApp"])} />
                <SnapshotRow label="E-mail" value={event.emailNotified ? "enviado" : "não enviado"} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver vídeo no YouTube
            </a>
            {!event.isRead && (
              <button
                onClick={() => onMarkRead(event.id)}
                disabled={isMarking}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Marcar como lido
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft px-4 py-3">
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  )
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[12.5px] text-ink-muted">{label}</span>
      <span className="font-mono-zoe text-[12.5px]" style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  )
}
