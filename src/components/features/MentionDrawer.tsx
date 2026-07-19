import { ExternalLink } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { useAnalysisComments, useAnalysisDetail } from "@/lib/api/analyses"
import type { VideoListItem } from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"

// Rótulos das fontes de componente do score 360 (não são enums do domínio — o
// source é string livre "audio_text"/"visual"/etc.).
const SOURCE_LABEL: Record<string, string> = {
  audio_text: "Áudio",
  caption_text: "Legenda",
  visual: "Visual",
  comments: "Comentários",
}

function classificationClass(cls: string | null): string {
  if (cls === "Positive") return "text-[#16A34A] bg-[#F0FDF4]"
  if (cls === "Negative") return "text-[#DC2626] bg-[#FEF2F2]"
  return "text-[#6B7280] bg-[#F3F4F6]"
}

export function MentionDrawer({
  item,
  open,
  onClose,
}: {
  item: VideoListItem | null
  open: boolean
  onClose: () => void
}) {
  const analysisId = item?.analysisId ?? null
  const detail = useAnalysisDetail(open ? analysisId : null)
  const comments = useAnalysisComments(open ? analysisId : null)

  if (!item) return null

  const d = detail.data
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.youtubeVideoId)}`

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhe da análise</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Título + meta */}
          <div>
            <h3 className="font-semibold text-midnight dark:text-[#E6E8EF]">{item.title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">
              {item.channelName} · {new Date(item.publishedAt).toLocaleDateString("pt-BR")}
            </p>
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              {item.classificacao && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classificationClass(item.classificacao)}`}>
                  {tEnum("classification", item.classificacao)}
                </span>
              )}
              <ConfidenceBadge pipelinePath={item.pipelinePath} confidence={item.confidence} />
              {item.score != null && (
                <span className="font-mono-zoe text-xs text-[#6B7280]">
                  score {item.score.toFixed(2)}
                </span>
              )}
            </div>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-[13px] text-teal-600 dark:text-teal-300 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver no YouTube
            </a>
          </div>

          {detail.isLoading && <DrawerSkeleton />}
          {detail.isError && (
            <p className="text-sm text-[#DC2626]">Não foi possível carregar o detalhe.</p>
          )}

          {d && (
            <>
              {/* Composição do score */}
              {d.scoreComponents.length > 0 && (
                <Section title="Composição do score">
                  <div className="space-y-2">
                    {d.scoreComponents.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 text-[13px]">
                        <span className="w-24 shrink-0 text-[#6B7280]">
                          {SOURCE_LABEL[c.source] ?? c.source}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                          <div className="h-full bg-teal-500" style={{ width: `${Math.round(c.value * 100)}%` }} />
                        </div>
                        <span className="font-mono-zoe text-[11px] text-[#6B7280] w-10 text-right">
                          {c.value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Agregado de comentários */}
              {d.commentAggregate && d.commentAggregate.totalComments > 0 && (
                <Section title={`Comentários (${d.commentAggregate.totalComments})`}>
                  <div className="flex gap-2 text-[12px]">
                    <span className="chip chip-pos">{d.commentAggregate.positivesCount} positivos</span>
                    <span className="chip">{d.commentAggregate.neutralsCount} neutros</span>
                    <span className="chip chip-neg">{d.commentAggregate.negativesCount} negativos</span>
                  </div>
                  {comments.data && comments.data.items.length > 0 && (
                    <ul className="mt-3 space-y-3">
                      {comments.data.items.slice(0, 8).map((c) => (
                        <li key={c.commentId} className="text-[13px]">
                          <div className="flex items-center gap-2 mb-0.5">
                            {/* Autor: texto React puro (escape default) — input hostil do YouTube. */}
                            <span className="font-medium text-midnight dark:text-[#E6E8EF] truncate">{c.author}</span>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${classificationClass(c.sentiment === "Mixed" ? null : c.sentiment)}`}>
                              {tEnum("sentiment", c.sentiment)}
                            </span>
                          </div>
                          <p className="text-[#374151] dark:text-[#B9BECB]">{c.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              {/* Keyword scores */}
              {d.keywordScores.length > 0 && (
                <Section title="Palavras-chave">
                  <div className="flex flex-wrap gap-1.5">
                    {d.keywordScores.slice(0, 12).map((k, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] bg-[#F3F4F6] dark:bg-[#1A1D2D] text-[#374151] dark:text-[#B9BECB]"
                        title={k.origin === "custom" ? "Keyword do seu tenant" : "Base"}
                      >
                        {k.keyword}
                        <span className="font-mono-zoe text-[10px] text-[#6B7280]">{k.score.toFixed(2)}</span>
                        {k.origin === "custom" && <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Menções da marca */}
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
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">{title}</h4>
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
