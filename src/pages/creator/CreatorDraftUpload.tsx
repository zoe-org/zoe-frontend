import { useRef, useState } from "react"
import {
  Loader2, Upload, Check, AlertCircle, RotateCcw, Clock, FileVideo,
} from "lucide-react"
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
  const [arrastando, setArrastando] = useState(false)
  const [progresso, setProgresso] = useState(0)

  const draft = engagement.draft
  const changesRequested = draft?.status === "ChangesRequested"
  const awaiting = draft?.status === "AwaitingReview"
  const approved = draft?.status === "Approved"

  const send = async () => {
    if (!file) return
    try {
      setProgresso(0)
      await upload.mutateAsync({
        contractId: engagement.contractId,
        file,
        notes,
        onProgress: setProgresso,
      })
      setFile(null)
      setNotes("")
      setProgresso(0)
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
              {/* O input nativo ficava a' mostra com `file:text-white` e SEM cor de fundo:
                  botao branco sobre branco. So' se via "Nenhum arquivo escolhido", sem
                  nada indicando onde clicar. Agora ele fica escondido e a area inteira e'
                  o alvo — que e' o gesto esperado para video, incluindo arrastar. */}
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />

              {!file ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
                  onDragLeave={() => setArrastando(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setArrastando(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) setFile(f)
                  }}
                  className="rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors"
                  style={{
                    borderColor: arrastando ? "var(--color-teal-500)" : "var(--border-soft)",
                    background: arrastando ? "#00A79908" : undefined,
                  }}
                >
                  <Upload
                    className="w-5 h-5 mx-auto mb-2"
                    style={{ color: arrastando ? "var(--color-teal-500)" : "var(--ink-muted)" }}
                  />
                  <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    Arraste o vídeo aqui ou clique para escolher
                  </div>
                  <div className="text-[11.5px] text-ink-muted mt-1">
                    MP4, MOV, MKV ou WebM
                  </div>
                </button>
              ) : (
                <div
                  className="rounded-lg border border-border-soft px-3.5 py-3 flex items-center gap-3"
                  style={{ background: "var(--surface-2, #FAFBFC)" }}
                >
                  <FileVideo className="w-4 h-4 shrink-0" style={{ color: "var(--color-teal-500)" }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] truncate" style={{ color: "var(--ink)" }}>
                      {file.name}
                    </div>
                    <div className="text-[11px] text-ink-muted font-mono-zoe">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  {!upload.isPending && (
                    <button
                      onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = "" }}
                      className="text-[11.5px] text-ink-muted hover:text-[#DC2626] shrink-0"
                    >
                      trocar
                    </button>
                  )}
                </div>
              )}

              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quer dizer algo sobre este corte? (opcional)"
              />

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

              {/* Barra de progresso REAL, nao um girador. Video sobe por minutos numa
                  conexao domestica, e um botao parado em "enviando" e' indistinguivel de
                  travado — a pessoa cancela e recomeça, que e' o pior desfecho. */}
              {upload.isPending && (
                <div className="flex flex-col gap-1.5">
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--border-soft)" }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-200"
                      style={{
                        width: `${Math.round(progresso * 100)}%`,
                        background: "var(--color-teal-500)",
                      }}
                    />
                  </div>
                  <p className="text-[11.5px] text-ink-muted m-0">
                    {progresso >= 1
                      ? "Finalizando…"
                      : `${Math.round(progresso * 100)}% enviado — não feche esta aba.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
