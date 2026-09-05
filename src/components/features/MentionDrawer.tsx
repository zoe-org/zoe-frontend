import { ExternalLink, Sparkles, X } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { VideoThumb } from "@/components/ui/video-thumb"
import { useAnalysisComments, useAnalysisDetail } from "@/lib/api/analyses"
import { useVideoDetail, type VideoListItem } from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"
import { classificationChip } from "@/lib/chip"

// Rótulos das fontes de componente do score 360 (não são enums do domínio — o
// source é string livre "audio_text"/"visual"/etc.).
const SOURCE_LABEL: Record<string, string> = {
  audio_text: "Áudio",
  caption_text: "Legenda",
  visual: "Visual",
  comments: "Comentários",
}

function compactNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}


/** Cor do score grande, pelo sentimento — leitura imediata no painel. */
function scoreColor(cls: string | null): string {
  if (cls === "Positive") return "var(--color-pos)"
  if (cls === "Negative") return "var(--color-neg)"
  return "var(--ink-muted)"
}

/** Borda + fundo do bloco de citação, por sentimento do comentário. */
function quoteStyle(sentiment: string): { border: string; bg: string } {
  if (sentiment === "Positive") return { border: "var(--color-pos)", bg: "var(--pos-bg)" }
  if (sentiment === "Negative") return { border: "var(--color-neg)", bg: "var(--neg-bg)" }
  // Translúcido pra ler bem no claro E no escuro (mesmo truque dos *-bg do dark).
  return { border: "#9AA1AE", bg: "rgba(148,161,174,0.10)" }
}

/** Gradiente estável por canal para o avatar — evita o mesmo verde pra todos. */
function avatarGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `linear-gradient(135deg, hsl(${hue} 62% 62%), hsl(${(hue + 40) % 360} 58% 45%))`
}

export function MentionDrawer({
  item,
  brandId,
  open,
  onClose,
}: {
  item: VideoListItem | null
  /** Necessário pra buscar a transcrição (GET /api/videos/{id}?brandId=). */
  brandId: string | null
  open: boolean
  onClose: () => void
}) {
  const analysisId = item?.analysisId ?? null
  const detail = useAnalysisDetail(open ? analysisId : null)
  const comments = useAnalysisComments(open ? analysisId : null)
  const video = useVideoDetail(open ? (item?.videoId ?? null) : null, brandId)

  if (!item) return null

  const d = detail.data
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.youtubeVideoId)}`
  const shortId = item.analysisId.replace(/-/g, "").slice(0, 6).toUpperCase()
  const initial = (item.channelName || "?").trim().charAt(0).toUpperCase()
  const coverageLabel = tEnum("pipelinePath", item.pipelinePath)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        // X embutido desligado: ele é posicionado em absolute e ficava sob o
        // cabeçalho fixo (z-10). Renderizamos o nosso dentro do header.
        showCloseButton={false}
        // Largura via style inline: o SheetContent do shadcn embute
        // `data-[side=right]:sm:max-w-sm`, que tem especificidade maior que
        // classes utilitárias e vencia o `max-w-*`. Inline sempre ganha.
        style={{ width: 580, maxWidth: "94vw" }}
        className="p-0 overflow-y-auto gap-0"
      >
        {/* Título acessível (leitor de tela) — o cabeçalho visual é custom. */}
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhe da menção: {item.title}</SheetTitle>
        </SheetHeader>

        {/* Cabeçalho fixo */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b border-border-soft"
          style={{ background: "var(--surface)" }}
        >
          <span className="eyebrow">Detalhe da menção</span>
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

        <div className="p-6 space-y-6">
          {/* Thumbnail — clicável para o YouTube */}
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="block">
            <VideoThumb
              youtubeVideoId={item.youtubeVideoId}
              durationSeconds={item.durationSeconds}
              className="w-full aspect-video rounded-xl"
              playSize={40}
            />
          </a>

          {/* Título */}
          <h2 className="text-[20px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
            {item.title}
          </h2>

          {/* Meta: canal + views + tempo */}
          <div className="flex items-center gap-3 flex-wrap text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
                style={{ background: avatarGradient(item.channelName) }}
              >
                {initial}
              </div>
              <span className="font-medium">{item.channelName}</span>
            </div>
            {item.views != null && (
              <>
                <span className="w-px h-4 bg-border-soft" />
                <span className="font-mono-zoe">{compactNumber(item.views)} views</span>
              </>
            )}
            <span className="w-px h-4 bg-border-soft" />
            <span className="text-ink-muted">
              {new Date(item.publishedAt).toLocaleDateString("pt-BR")}
            </span>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-300 hover:underline ml-auto"
            >
              <ExternalLink className="w-3.5 h-3.5" /> YouTube
            </a>
          </div>

          {/* Painel de análise Zoe */}
          <div className="rounded-xl border border-border-soft p-5 bg-[#FAFBFC] dark:bg-[#181B28]">
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">Análise Zoe</span>
              <span className="chip chip-primary inline-flex items-center gap-1 text-[10px]">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            </div>
            <div className="grid grid-cols-3 gap-5">
              <PanelCell label="Sentimento">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[26px] leading-none" style={{ color: scoreColor(item.classificacao) }}>
                    {item.score != null ? item.score.toFixed(2) : "—"}
                  </span>
                </div>
                {item.classificacao && (
                  <span className={`mt-1.5 ${classificationChip(item.classificacao)}`}>
                    {tEnum("classification", item.classificacao)}
                  </span>
                )}
              </PanelCell>
              <PanelCell label="Confiança">
                <span className="font-display text-[26px] leading-none" style={{ color: "var(--ink)" }}>
                  {item.confidence != null ? Math.round(item.confidence * 100) : "—"}
                  {item.confidence != null && <span className="text-[14px] text-ink-muted">%</span>}
                </span>
              </PanelCell>
              <PanelCell label="Cobertura">
                <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[11px] font-medium bg-[#F3F4F6] dark:bg-[#1A1D2D] text-ink-2">
                  {coverageLabel}
                </span>
              </PanelCell>
            </div>
          </div>

          {/* Transcrição — texto real do Whisper/legenda (já truncado no
              backend). Fora do gate do detalhe (`d`): depende só da query do
              vídeo. Não temos trechos com timestamp+sentimento como o mock, então
              exibimos o texto; as palavras-chave fazem o papel de "sinais". */}
          {video.data?.transcript?.text && (
            <Section
              title="Transcrição"
              aside={
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-teal-600 dark:text-teal-300 hover:underline"
                >
                  Ver no YouTube →
                </a>
              }
            >
              <div
                className="max-h-56 overflow-y-auto rounded-lg border border-border-soft p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap bg-[#FAFBFC] dark:bg-[#181B28]"
                style={{ color: "var(--ink-2)" }}
              >
                {video.data.transcript.text}
                {video.data.transcript.truncated && (
                  <span className="block mt-2 text-[11.5px] italic text-ink-muted">
                    Transcrição resumida — trecho inicial do vídeo.
                  </span>
                )}
              </div>
            </Section>
          )}

          {detail.isLoading && <DrawerSkeleton />}
          {detail.isError && (
            <p className="text-sm text-neg">Não foi possível carregar o detalhe.</p>
          )}

          {d && (
            <>
              {/* Composição do score 360 */}
              {d.scoreComponents.length > 0 && (
                <Section title="Composição do score">
                  <div className="space-y-2">
                    {d.scoreComponents.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 text-[13px]">
                        <span className="w-24 shrink-0 text-ink-muted">
                          {SOURCE_LABEL[c.source] ?? c.source}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#F3F4F6] dark:bg-[#1A1D2D] overflow-hidden">
                          <div className="h-full bg-teal-500" style={{ width: `${Math.round(c.value * 100)}%` }} />
                        </div>
                        <span className="font-mono-zoe text-[11px] text-ink-muted w-10 text-right">
                          {c.value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Comentários em destaque (blocos de citação, estilo do design) */}
              {d.commentAggregate && d.commentAggregate.totalComments > 0 && (
                <Section
                  title={`Comentários (${d.commentAggregate.totalComments})`}
                  aside={
                    <div className="flex gap-1.5 text-[11px]">
                      <span className="chip chip-pos">{d.commentAggregate.positivesCount}</span>
                      <span className="chip">{d.commentAggregate.neutralsCount}</span>
                      <span className="chip chip-neg">{d.commentAggregate.negativesCount}</span>
                    </div>
                  }
                >
                  {comments.data && comments.data.items.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      {comments.data.items.slice(0, 6).map((c) => {
                        const qs = quoteStyle(c.sentiment)
                        return (
                          <div
                            key={c.commentId}
                            className="px-3.5 py-3 rounded-r-lg"
                            style={{ borderLeft: `3px solid ${qs.border}`, background: qs.bg }}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              {/* Autor: texto React puro (escape default) — input hostil do YouTube. */}
                              <span className="text-[11.5px] font-medium truncate" style={{ color: "var(--ink-2)" }}>
                                {c.author}
                              </span>
                              <span className="font-mono-zoe text-[10.5px] text-ink-muted shrink-0">
                                {c.score.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-[13px] italic leading-relaxed" style={{ color: "var(--ink-2)" }}>
                              "{c.text}"
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Section>
              )}

              {/* Palavras-chave detectadas */}
              {d.keywordScores.length > 0 && (
                <Section title="Palavras-chave">
                  <div className="flex flex-wrap gap-1.5">
                    {d.keywordScores.slice(0, 14).map((k, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] bg-[#F3F4F6] dark:bg-[#1A1D2D]"
                        style={{ color: "var(--ink-2)" }}
                        title={k.origin === "custom" ? "Keyword do seu tenant" : "Base"}
                      >
                        {k.keyword}
                        <span className="font-mono-zoe text-[10px] text-ink-muted">{k.score.toFixed(2)}</span>
                        {k.origin === "custom" && <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Menções da marca detectadas */}
              {d.mentions.length > 0 && (
                <Section title="Menções detectadas">
                  <div className="flex flex-wrap gap-1.5">
                    {d.mentions.map((m) => (
                      <span key={m.id} className={`chip ${m.isCanonical ? "chip-primary" : ""}`}>{m.mentionText}</span>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>

        {/* Rodapé fixo */}
        <div
          className="sticky bottom-0 px-6 py-4 border-t border-border-soft"
          style={{ background: "var(--surface)" }}
        >
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-10 rounded-lg text-white text-[13.5px] font-medium bg-teal-500 hover:bg-teal-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Abrir no YouTube
          </a>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PanelCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-ink-muted mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{title}</h4>
        {aside}
      </div>
      {children}
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-3 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  )
}
