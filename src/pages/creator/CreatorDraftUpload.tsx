import { useRef, useState } from "react"
import { Loader2, Upload, Check, AlertCircle, RotateCcw, Clock } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { fmtDate } from "@/pages/operations/format"
import { useDraftUpload, type CreatorEngagement } from "@/lib/api/creator"

/**
 * Primeiro dos dois portões, do lado do criador: subir o corte para a marca ver **antes**
 * de publicar.
 *
 * <p>Depois de publicado, pedir correção custa republicação, alcance perdido e desgaste
 * com a audiência. Este portão existe para a reprovação acontecer antes do estrago — e a
 * tela diz isso, porque um upload "porque o sistema pede" é um upload que ninguém faz com
 * cuidado.</p>
 *
 * <p>O arquivo vai direto para o storage, fora da API. Três passos: autorizar, subir,
 * confirmar.</p>
 */
export function CreatorDraftUpload({ engagement }: { engagement: CreatorEngagement }) {
  const upload = useDraftUpload()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")

  const draft = engagement.draft
  const changesRequested = draft?.status === "ChangesRequested"
  const awaiting = draft?.status === "AwaitingReview"
  const approved = draft?.status === "Approved"

  const send = async () => {
    if (!file) return
    try {
      await upload.mutateAsync({ contractId: engagement.contractId, file, notes })
      setFile(null)
      setNotes("")
      if (inputRef.current) inputRef.current.value = ""
      toast.success("Corte enviado. A marca vai revisar antes de você publicar.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o corte.")
    }
  }

  // Contrato sem exigência de corte — ao vivo, por exemplo. Não há portão a mostrar.
  if (!engagement.requiresDraftApproval) return null

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: "var(--surface)",
        borderColor: approved ? "var(--color-teal-500)" : "var(--border-soft)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
          style={{
            background: approved ? "#00A79915" : changesRequested ? "#DC262615" : "#D9770615",
          }}
        >
          {approved ? <Check className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />
            : changesRequested ? <RotateCcw className="w-4 h-4" style={{ color: "#DC2626" }} />
            : awaiting ? <Clock className="w-4 h-4" style={{ color: "#D97706" }} />
            : <Upload className="w-4 h-4" style={{ color: "#D97706" }} />}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-[13.5px] font-medium mb-1"
            style={{
              color: approved ? "var(--color-teal-500)"
                : changesRequested ? "#DC2626" : "#D97706",
            }}
          >
            {approved ? "Corte aprovado — pode publicar"
              : changesRequested ? `Correção pedida (revisão ${draft!.revision})`
              : awaiting ? "Corte em revisão"
              : "Envie o corte antes de publicar"}
          </div>

          {/* O texto que explica o portão. Sem ele, o upload vira burocracia. */}
          <p className="text-[12.5px] text-ink-muted m-0 leading-relaxed">
            {approved
              ? "A marca aprovou. Publique o vídeo e mande o link aqui embaixo."
              : awaiting
                ? "A marca está assistindo. Assim que aprovar, você publica e manda o link."
                : "A marca precisa ver o vídeo antes de ele ir ao ar — depois de publicado, "
                  + "corrigir custa republicação e alcance."}
          </p>

          {changesRequested && draft?.decisionNotes && (
            <div
              className="rounded-lg p-3 mt-3 text-[12.5px]"
              style={{ background: "#DC262610", color: "var(--ink-2)" }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#DC2626" }} />
                <div>
                  <div className="font-medium mb-0.5" style={{ color: "#DC2626" }}>
                    O que a marca pediu
                  </div>
                  {draft.decisionNotes}
                </div>
              </div>
            </div>
          )}

          {awaiting && draft && (
            <p className="text-[11.5px] text-ink-muted mt-2 mb-0">
              {draft.fileName ?? "Arquivo"} · enviado em {fmtDate(draft.submittedAt)}
            </p>
          )}

          {!approved && !awaiting && (
            <div className="mt-3 flex flex-col gap-2.5">
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-[12.5px] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-[12.5px] file:font-medium file:text-white file:cursor-pointer"
                style={{ color: "var(--ink-muted)" }}
              />

              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quer dizer algo sobre este corte? (opcional)"
              />

              {file && (
                <p className="text-[11.5px] text-ink-muted m-0">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              )}

              <button
                onClick={send}
                disabled={!file || upload.isPending}
                className="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-teal-500)" }}
              >
                {upload.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Upload className="w-3.5 h-3.5" />}
                {upload.isPending
                  ? "Enviando…"
                  : changesRequested ? "Enviar nova versão" : "Enviar para revisão"}
              </button>

              {upload.isPending && (
                <p className="text-[11.5px] text-ink-muted m-0">
                  Vídeo é arquivo grande — não feche esta aba.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
