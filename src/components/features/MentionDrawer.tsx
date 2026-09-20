import { useState } from "react"
import { ExternalLink, Sparkles, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { PersonAvatar } from "@/components/ui/person-avatar"
import { VideoThumb } from "@/components/ui/video-thumb"
import { CommentsModal, TranscriptModal } from "@/components/features/mention-modals"
import { useAnalysisComments, useAnalysisDetail } from "@/lib/api/analyses"
import { hasSelfMeasuredScore, useVideoDetail, type VideoListItem } from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"
import { classificationChip } from "@/lib/chip"
import { formatScore } from "@/lib/score"
import { stagger } from "@/lib/motion"

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
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const analysisId = item?.analysisId ?? null
  const detail = useAnalysisDetail(open ? analysisId : null)
  const comments = useAnalysisComments(open ? analysisId : null)
  const video = useVideoDetail(open ? (item?.videoId ?? null) : null, brandId)

  if (!item) return null

  const d = detail.data
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.youtubeVideoId)}`
  const shortId = item.analysisId.replace(/-/g, "").slice(0, 6).toUpperCase()

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
          <span className="eyebrow">Menção</span>
          <span className="font-mono-zoe text-[10.5px] text-ink-muted-2">#{shortId}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-full border border-border-soft text-ink-muted hover:text-ink hover:bg-tint transition-colors"
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
              <PersonAvatar name={item.channelName} size={28} />
              <span className="font-medium">{item.channelName}</span>
            </div>
            {item.views != null && (
              <>
                <span className="w-px h-4 bg-border-soft" />
                <span className="font-mono-zoe">{compactNumber(item.views)} views</span>
              </>
            )}
            <span className="w-px h-4 bg-border-soft" />
            {/* Tempo relativo, como na lista: "há 3 dias" responde a pergunta que
                se faz aqui (isso é recente?) sem obrigar a fazer conta. */}
            <span className="text-ink-muted" title={new Date(item.publishedAt).toLocaleDateString("pt-BR")}>
              {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ptBR })}
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

          {/* Leitura Zoe: o número primeiro, e logo ao lado o que ele assume. */}
          <div className="rounded-xl border border-border-soft p-5 bg-inset">
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">Leitura Zoe</span>
              <span className="chip chip-primary inline-flex items-center gap-1 text-[10px]">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            </div>
            <div className="flex items-center gap-5">
              <ScoreRing score={hasSelfMeasuredScore(item) ? null : item.score} classificacao={item.classificacao} />
              <div className="min-w-0 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.classificacao && (
                    <span className={classificationChip(item.classificacao)}>
                      {tEnum("classification", item.classificacao)}
                    </span>
                  )}
                  {/* O mesmo selo da lista, e não um texto solto: ele carrega o
                      tooltip e a ressalva de score auto-medido (vídeo do canal da
                      própria marca), que aqui — onde o número aparece grande — é
                      justamente onde não pode faltar. */}
                  <ConfidenceBadge
                    pipelinePath={item.pipelinePath}
                    confidence={item.confidence}
                    selfMeasured={hasSelfMeasuredScore(item)}
                  />
                </div>
                <div className="text-[12.5px] text-ink-muted">
                  {item.confidence != null
                    ? <>Confiança da análise: <span className="font-mono-zoe text-ink-2">{Math.round(item.confidence * 100)}%</span></>
                    : "Sem medida de confiança para esta análise."}
                </div>
              </div>
            </div>
          </div>

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
                        <div className="flex-1 h-1.5 rounded-full bg-tint-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-500 z-grow-x"
                            style={{ width: `${Math.round(c.value * 100)}%`, ...stagger(i) }}
                          />
                        </div>
                        <span className="font-mono-zoe text-[11px] text-ink-2 w-10 text-right">
                          {formatScore(c.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Transcrição. Vem DEPOIS da composição do score de propósito: a
                  composição explica o número que está logo acima, e a transcrição é
                  a evidência crua — quem quer o detalhe desce, quem quer a leitura
                  clica. Aqui só a prévia do banco (300 caracteres); o texto inteiro
                  mora no S3 e vai pro modal. */}
              {video.data?.transcript?.text && (
                <Section
                  title="Transcrição"
                  aside={
                    <button
                      type="button"
                      onClick={() => setTranscriptOpen(true)}
                      className="text-[12px] text-teal-600 dark:text-teal-300 hover:underline cursor-pointer"
                    >
                      Ver transcrição completa →
                    </button>
                  }
                >
                  <button
                    type="button"
                    onClick={() => setTranscriptOpen(true)}
                    className="w-full text-left relative rounded-lg border border-border-soft p-3.5 bg-inset hover:border-teal-500 transition-colors cursor-pointer"
                  >
                    <p
                      className="text-[13px] leading-relaxed line-clamp-4"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {video.data.transcript.text}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-2 text-[11px] text-ink-muted">
                      <span className="chip">{tEnum("transcriptionSource", video.data.transcript.source)}</span>
                      {/* "prévia" e não uma contagem de palavras: este texto é o começo
                          da fala, e um número aqui pareceria o tamanho da transcrição. */}
                      <span>prévia — clique para ler tudo</span>
                    </span>
                  </button>
                </Section>
              )}

              {/* Comentários — os três mais curtidos, com o resto no modal. Os
                  chips de contagem vêm do agregado da análise (todos os
                  comentários), não da amostra exibida. */}
              {d.commentAggregate && d.commentAggregate.totalComments > 0 && (
                <Section
                  title={`Comentários (${d.commentAggregate.totalComments})`}
                  aside={
                    <button
                      type="button"
                      onClick={() => setCommentsOpen(true)}
                      className="text-[12px] text-teal-600 dark:text-teal-300 hover:underline cursor-pointer"
                    >
                      Ver todos →
                    </button>
                  }
                >
                  <div className="flex gap-1.5 mb-3 text-[10.5px]">
                    <span className="chip chip-pos">{d.commentAggregate.positivesCount} positivos</span>
                    <span className="chip">{d.commentAggregate.neutralsCount} neutros</span>
                    <span className="chip chip-neg">{d.commentAggregate.negativesCount} negativos</span>
                  </div>

                  {comments.data && comments.data.items.length > 0 && (
                    <div className="flex flex-col gap-3.5">
                      {comments.data.items.slice(0, 3).map((c) => (
                        <div key={c.commentId} className="flex gap-2.5 items-start">
                          <PersonAvatar name={c.author} size={26} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {/* Autor e texto: texto React puro (escape default) — input hostil do YouTube. */}
                              <span className="text-[12px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                                {c.author}
                              </span>
                              <span className={`${classificationChip(c.sentiment)} text-[9.5px] shrink-0`}>
                                {tEnum("sentiment", c.sentiment)}
                              </span>
                            </div>
                            <p className="text-[12.5px] leading-relaxed line-clamp-3" style={{ color: "var(--ink-2)" }}>
                              {c.text}
                            </p>
                          </div>
                        </div>
                      ))}
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] bg-tint"
                        style={{ color: "var(--ink-2)" }}
                        title={k.origin === "custom" ? "Keyword do seu tenant" : "Base"}
                      >
                        {k.keyword}
                        <span className="font-mono-zoe text-[10px] text-ink-muted">{formatScore(k.score)}</span>
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
            className="flex items-center justify-center gap-2 h-10 rounded-lg text-midnight text-[13.5px] font-semibold bg-teal-500 hover:brightness-110 transition-[filter]"
          >
            <ExternalLink className="w-4 h-4" /> Abrir no YouTube
          </a>
        </div>

        {/* Leitura longa fora do drawer: o Sheet continua aberto atrás. */}
        {video.data?.transcript && (
          <TranscriptModal
            videoId={item.videoId}
            brandId={brandId}
            youtubeVideoId={item.youtubeVideoId}
            title={item.title}
            preview={video.data.transcript}
            open={transcriptOpen}
            onClose={() => setTranscriptOpen(false)}
          />
        )}
        <CommentsModal
          analysisId={item.analysisId}
          title={item.title}
          aggregate={d?.commentAggregate ?? null}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

/**
 * Score em anel. O arco vai de 0 a 1 — a escala do domínio —, com o 0,5 marcado:
 * sem essa marca, um 0,52 em anel parece "metade ruim" quando é neutro.
 *
 * `score` null = owned pelo path pesado (número existe, mas não mede audiência)
 * ou análise sem score; o anel fica vazio em vez de fingir leitura.
 */
function ScoreRing({ score, classificacao }: { score: number | null; classificacao: string | null }) {
  const cor = score == null ? "var(--ink-muted-2)" : scoreColor(classificacao)
  const arc = score ?? 0
  return (
    <div className="relative w-22 h-22 shrink-0">
      <svg viewBox="0 0 88 88" className="w-22 h-22 -rotate-90">
        <circle cx="44" cy="44" r="38" fill="none" stroke="var(--tint-2)" strokeWidth="7" />
        {score != null && (
          <circle
            cx="44" cy="44" r="38" fill="none" stroke={cor} strokeWidth="7" strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${arc} 1`}
            className="z-arc"
            style={{ "--arc": arc } as React.CSSProperties}
          />
        )}
        {/* Marca do neutro (0,5): meia volta a partir do topo. */}
        <line x1="44" y1="2" x2="44" y2="10" stroke="var(--border-soft)" strokeWidth="2" transform="rotate(180 44 44)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[21px] leading-none" style={{ color: cor }}>
          {formatScore(score)}
        </span>
        <span className="font-mono-zoe text-[9px] text-ink-muted-2 mt-1">de 1,00</span>
      </div>
    </div>
  )
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="eyebrow">{title}</h4>
        {aside}
      </div>
      {children}
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-3 rounded z-skeleton" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  )
}
