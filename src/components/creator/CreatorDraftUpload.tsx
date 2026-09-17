import { useRef, useState } from "react"
import {
  Loader2, Upload, Check, AlertCircle, RotateCcw, Clock, FileVideo,
} from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { Input } from "@/components/ui/input"
import { fmtDate } from "@/lib/operations-format"
import { useDraftUpload, SINGLE_PUT_LIMIT, type CreatorEngagement } from "@/lib/api/creator"

/** Teto de 5 GB, igual nos dois caminhos de envio e avisado antes de começar. */
const MAX_BYTES = 5 * 1024 ** 3

const ACCEPTED_FORMATS = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"]

function fmtRemaining(ms: number): string {
  if (ms < 60_000) return "menos de 1 min"
  return `~${Math.ceil(ms / 60_000)} min`
}

/**
 * Primeiro portão, do lado do criador: o corte sobe para a marca ver antes de publicar, direto para o storage.
 */
export function CreatorDraftUpload({ engagement }: { engagement: CreatorEngagement }) {
  const upload = useDraftUpload()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  /** Estimativa pelo ritmo até agora. Nulo no começo, quando o ritmo ainda não diz nada. */
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const startedAt = useRef(0)

  // Tamanho e formato conferidos na escolha: a recusa do servidor chegava só depois de o
  // arquivo inteiro subir.
  const chooseFile = (f: File | null) => {
    const reject = (reason: string) => {
      notifyError(null, reason)
      if (inputRef.current) inputRef.current.value = ""
    }
    if (f && f.size > MAX_BYTES) {
      reject(`O arquivo tem ${(f.size / 1024 ** 3).toFixed(1)} GB — o limite é 5 GB. Exporte com resolução ou bitrate menor.`)
      return
    }
    // Tipo vazio acontece com .mkv em alguns sistemas: passa, e o servidor decide.
    if (f && f.type && !ACCEPTED_FORMATS.includes(f.type)) {
      reject("Formato não aceito. Envie o vídeo em MP4, MOV, MKV ou WebM.")
      return
    }
    setFile(f)
  }

  const draft = engagement.draft
  const changesRequested = draft?.status === "ChangesRequested"
  const awaiting = draft?.status === "AwaitingReview"
  const approved = draft?.status === "Approved"

  const send = async () => {
    if (!file) return
    try {
      setProgress(0)
      setRemainingMs(null)
      startedAt.current = Date.now()
      await upload.mutateAsync({
        contractId: engagement.contractId,
        file,
        notes,
        onProgress: (fraction) => {
          setProgress(fraction)
          if (fraction > 0.02) setRemainingMs(((Date.now() - startedAt.current) / fraction) * (1 - fraction))
        },
      })
      setFile(null)
      setNotes("")
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ""
      notifySuccess("Corte enviado. A marca vai revisar antes de você publicar.")
    } catch (e) {
      notifyError(null, e instanceof Error ? e.message : "Não foi possível enviar o corte.")
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
              {/* Input nativo escondido: a área inteira é o alvo, inclusive para arrastar. */}
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />

              {!file ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) chooseFile(f)
                  }}
                  className="rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors"
                  style={{
                    borderColor: dragging ? "var(--color-teal-500)" : "var(--border-soft)",
                    background: dragging ? "#00A79908" : undefined,
                  }}
                >
                  <Upload
                    className="w-5 h-5 mx-auto mb-2"
                    style={{ color: dragging ? "var(--color-teal-500)" : "var(--ink-muted)" }}
                  />
                  <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    Arraste o vídeo aqui ou clique para escolher
                  </div>
                  <div className="text-[11.5px] text-ink-muted mt-1">
                    MP4, MOV, MKV ou WebM · até 5 GB
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

              {/* Barra de progresso real: upload de minutos parado em "enviando" parece travado. */}
              {upload.isPending && (
                <div className="flex flex-col gap-1.5">
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--border-soft)" }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-200"
                      style={{
                        width: `${Math.round(progress * 100)}%`,
                        background: "var(--color-teal-500)",
                      }}
                    />
                  </div>
                  <p className="text-[11.5px] text-ink-muted m-0">
                    {progress >= 1
                      ? "Finalizando…"
                      : `${Math.round(progress * 100)}% enviado${remainingMs != null ? ` · faltam ${fmtRemaining(remainingMs)}` : ""} — não feche esta aba até terminar.`}
                  </p>
                  {/* Arquivo grande sobe em partes. Dizer isso aqui muda o que a pessoa faz quando
                      a conexão cai: escolher o mesmo arquivo em vez de desistir do envio. */}
                  {file && file.size > SINGLE_PUT_LIMIT && (
                    <p className="text-[11px] text-ink-muted m-0">
                      Se a conexão cair, escolha o mesmo arquivo e envie de novo: continua de onde parou.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
