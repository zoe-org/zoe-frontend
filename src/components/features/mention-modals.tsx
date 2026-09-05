import { useMemo, useState } from "react"
import { Dialog } from "radix-ui"
import { Download, Loader2, Search, ThumbsUp, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PersonAvatar } from "@/components/ui/person-avatar"
import { TabPill } from "@/components/ui/tab-pill"
import { useAnalysisComments, type CommentAggregate } from "@/lib/api/analyses"
import { useVideoTranscript, type TranscriptPreview } from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"
import { classificationChip } from "@/lib/chip"

/**
 * Modais de leitura longa do detalhe da menção (`src/mention-modals.jsx`):
 * transcrição completa e todos os comentários.
 *
 * Existem porque o drawer é uma coluna de 580px — cabe o resumo, não a leitura.
 * Empurrar transcrição inteira e 200 comentários pra dentro dele transformaria o
 * painel de análise num scroll infinito onde o score, que é a resposta, fica
 * fora da tela.
 *
 * ## Onde diverge do design
 *
 * | Design | Aqui |
 * |---|---|
 * | Sentimento por linha da transcrição | Não existe: o pipeline pontua o texto inteiro, não frase a frase. Os timestamps são reais (vêm do Whisper) e cada linha abre o YouTube no ponto |
 * | "Ver todos" sobre a contagem total | Top 200 por likes (teto do `GET /comments`); o rodapé diz quantos de quantos |
 */

// ── Transcrição ────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Quebra o texto em parágrafos legíveis — fallback pra quando a transcrição não
 * tem segmentos com timestamp (legenda, ou arquivo antigo do Transcribe). O texto
 * vem como bloco único; sem isto o modal é uma parede. Só agrupa frases.
 */
function toParagraphs(text: string): string[] {
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  if (lines.length > 1) return lines
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < sentences.length; i += 3) out.push(sentences.slice(i, i + 3).join(" "))
  return out.length > 0 ? out : [text]
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"))
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded px-0.5" style={{ background: "var(--teal-bg)", color: "var(--ink)" }}>
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

/** Nome de arquivo seguro a partir do título do vídeo (input hostil do YouTube). */
function slugify(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .toLowerCase() || "transcricao"
  )
}

/** Segundos → mm:ss (ou h:mm:ss em vídeo longo). */
function timecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`
}

export function TranscriptModal({
  videoId,
  brandId,
  youtubeVideoId,
  title,
  preview,
  open,
  onClose,
}: {
  videoId: string
  brandId: string | null
  youtubeVideoId: string
  title: string
  /** Prévia do banco — o que já está na tela enquanto o S3 responde. */
  preview: TranscriptPreview
  open: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const full = useVideoTranscript(open ? videoId : null, brandId)

  const source = full.data?.source ?? preview.source
  const language = full.data?.language ?? preview.language
  const text = full.data?.text ?? preview.text
  const segments = full.data?.segments ?? []

  const paragraphs = useMemo(() => toParagraphs(text), [text])
  const matches = useMemo(() => {
    const q = query.trim()
    if (!q) return 0
    return text.match(new RegExp(escapeRegExp(q), "gi"))?.length ?? 0
  }, [query, text])

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${slugify(title)}-transcricao.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      width={680}
      eyebrow="Transcrição completa"
      title={title}
    >
      <div className="px-6 py-3.5 border-b border-border-soft flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar na transcrição…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border-soft text-[13px] outline-none focus:border-teal-500"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          />
        </div>
        {query.trim() && (
          <span className="font-mono-zoe text-[11.5px] text-ink-muted shrink-0">
            {matches} {matches === 1 ? "ocorrência" : "ocorrências"}
          </span>
        )}
        <button
          type="button"
          onClick={download}
          title="Baixar como .txt"
          aria-label="Baixar transcrição"
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border-soft text-[12.5px] text-ink-muted hover:text-ink hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-6 py-5 overflow-y-auto flex-1">
        <div className="flex items-center gap-2 mb-4">
          <span className="chip">Origem: {tEnum("transcriptionSource", source)}</span>
          <span className="font-mono-zoe text-[11px] text-ink-muted-2 uppercase">{language}</span>
          {full.isLoading && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <Loader2 className="w-3 h-3 animate-spin" /> carregando o texto completo…
            </span>
          )}
        </div>

        {segments.length > 0 ? (
          // Com timestamp por frase: cada linha vira um marcador clicável que abre
          // o YouTube no ponto exato — é o "trecho relevante" do design, com a
          // vantagem de sair da fonte em vez de ser inventado.
          <div className="flex flex-col">
            {segments.map((seg, i) => (
              <a
                key={i}
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}&t=${Math.floor(seg.startSeconds)}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3.5 px-2.5 py-2 -mx-2.5 rounded-lg hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
              >
                <span
                  className="font-mono-zoe text-[11px] shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                  style={{ background: "var(--teal-bg)", color: "var(--color-teal-600)" }}
                >
                  {timecode(seg.startSeconds)}
                </span>
                <span className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                  <Highlight text={seg.text} query={query} />
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-3.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {paragraphs.map((p, i) => (
              <p key={i}>
                <Highlight text={p} query={query} />
              </p>
            ))}
          </div>
        )}

        {/* Honestidade sobre o que está na tela. `complete: false` = o arquivo do
            pipeline não pôde ser lido e isto aqui é a prévia de 300 caracteres. */}
        {!full.isLoading && full.data?.complete === false && (
          <p className="mt-5 pt-4 border-t border-border-soft text-[12px] italic text-ink-muted">
            Só a prévia está disponível — o arquivo com a transcrição completa não pôde ser lido.
          </p>
        )}
        {full.isError && (
          <p className="mt-5 pt-4 border-t border-border-soft text-[12px] italic text-ink-muted">
            Falha ao buscar a transcrição completa; o texto acima é a prévia guardada na análise.
          </p>
        )}
        {full.data?.truncated && (
          <p className="mt-5 pt-4 border-t border-border-soft text-[12px] italic text-ink-muted">
            Transcrição muito longa: exibindo o trecho inicial do vídeo.
          </p>
        )}
      </div>
    </ModalShell>
  )
}

// ── Comentários ────────────────────────────────────────────────────────

/** Teto do `GET /api/analyses/{id}/comments`. Ordenados por likes desc. */
const COMMENTS_LIMIT = 200

// Ordem de exibição das abas. `Mixed` existe no domínio e só aparece se vier na
// resposta — aba vazia é ruído.
const SENTIMENT_TABS: { key: string; label: string }[] = [
  { key: "Positive", label: "Positivos" },
  { key: "Neutral", label: "Neutros" },
  { key: "Negative", label: "Negativos" },
  { key: "Mixed", label: "Mistos" },
]

function compactNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

export function CommentsModal({
  analysisId,
  title,
  aggregate,
  open,
  onClose,
}: {
  analysisId: string
  title: string
  aggregate: CommentAggregate | null
  open: boolean
  onClose: () => void
}) {
  const [filter, setFilter] = useState<string>("all")
  // Uma busca só, filtro no cliente: refetch por aba faria a contagem da aba e a
  // lista virem de respostas diferentes (top-200 por sentimento ≠ recorte do top-200).
  const comments = useAnalysisComments(open ? analysisId : null, { limit: COMMENTS_LIMIT })

  const items = useMemo(() => comments.data?.items ?? [], [comments.data])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const it of items) c[it.sentiment] = (c[it.sentiment] ?? 0) + 1
    return c
  }, [items])

  const filtered = filter === "all" ? items : items.filter((c) => c.sentiment === filter)

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      width={640}
      eyebrow={`Comentários analisados${aggregate ? ` · ${aggregate.totalComments}` : ""}`}
      title={title}
    >
      <div className="px-6 py-3 border-b border-border-soft flex items-center gap-1 flex-wrap">
        <TabPill active={filter === "all"} onClick={() => setFilter("all")} label="Todos" count={items.length} />
        {SENTIMENT_TABS.filter((t) => (counts[t.key] ?? 0) > 0).map((t) => (
          <TabPill
            key={t.key}
            active={filter === t.key}
            onClick={() => setFilter(t.key)}
            label={t.label}
            count={counts[t.key]}
          />
        ))}
      </div>

      <div className="px-6 py-5 overflow-y-auto flex-1">
        {comments.isLoading && <CommentsSkeleton />}
        {comments.isError && <p className="text-[13px] text-neg">Não foi possível carregar os comentários.</p>}
        {!comments.isLoading && filtered.length === 0 && (
          <p className="text-[13px] text-ink-muted">Nenhum comentário neste recorte.</p>
        )}

        <div className="flex flex-col gap-4">
          {filtered.map((c) => (
            <div key={c.commentId} className="flex gap-3 items-start">
              <PersonAvatar name={c.author} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {/* Autor e texto são texto React puro (escape default): input hostil. */}
                  <span className="text-[12.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                    {c.author}
                  </span>
                  <span className="font-mono-zoe text-[10.5px] text-ink-muted-2">
                    {formatDistanceToNow(new Date(c.publishedAt), { addSuffix: true, locale: ptBR })}
                  </span>
                  <span className={`${classificationChip(c.sentiment)} text-[9.5px]`}>
                    {tEnum("sentiment", c.sentiment)}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                  {c.text}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[11.5px] text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> {compactNumber(c.likesCount)}
                  </span>
                  <span className="font-mono-zoe">score {c.score.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {aggregate && items.length > 0 && aggregate.totalComments > items.length && (
          <p className="mt-5 pt-4 border-t border-border-soft text-[12px] italic text-ink-muted">
            Mostrando os {items.length} comentários mais curtidos de {aggregate.totalComments} analisados.
          </p>
        )}
      </div>
    </ModalShell>
  )
}

function CommentsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] dark:bg-[#1A1D2D] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-32 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
            <div className="h-2.5 w-full rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
            <div className="h-2.5 w-4/5 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Casca comum ────────────────────────────────────────────────────────

/**
 * Diálogo centralizado que abre POR CIMA do drawer (que é um Sheet, z-50) — daí
 * o z-60/z-70. Radix empilha os layers: Esc e clique fora fecham só o de cima.
 */
function ModalShell({
  open,
  onClose,
  width,
  eyebrow,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  width: number
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/45 data-open:animate-in data-open:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-70 -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border-soft shadow-2xl outline-none flex flex-col overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
          style={{
            width: `min(${width}px, calc(100vw - 2rem))`,
            maxHeight: "85vh",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        >
          <div className="px-6 py-4 border-b border-border-soft flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow mb-1.5">{eyebrow}</div>
              <Dialog.Title className="m-0 text-[14px] font-semibold leading-snug line-clamp-2" style={{ color: "var(--ink)" }}>
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="p-1.5 -mr-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
