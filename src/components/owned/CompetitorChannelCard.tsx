import { useState } from "react"
import { Link } from "react-router-dom"
import { ExternalLink, Lock, MessageSquareOff } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { InfoHint } from "@/components/ui/info-hint"
import { useFeature } from "@/features/auth/useFeature"
import { tEnum } from "@/i18n/enums"
import { apiMessage } from "@/lib/api-error"
import { useOwnedReaction, type OwnedReactionResponse, type OwnedVideoItem } from "@/lib/api/owned"
import { startOfToday, windowFrom } from "@/lib/date-window"
import { formatScore, readSentiment } from "@/lib/sov"

const NOT_COMPARABLE =
  "Mede como o público reage aos vídeos que o próprio concorrente publicou — pelos " +
  "comentários, não pelo roteiro, que é texto da marca. Não é comparável com os números " +
  "acima, que são sobre o que terceiros falam dele: somar os dois apagaria justamente a " +
  "diferença entre conversa espontânea e conteúdo próprio."

const WEIGHTED =
  "Cada comentário pesa um: é a leitura da audiência. A média por vídeo, ao lado, trata " +
  "cada publicação como igual — é a leitura do catálogo. Quando as duas divergem, um vídeo " +
  "concentrou a reação."

/**
 * Reação nos canais oficiais de um concorrente (ADR-063). Era o painel da direita do
 * antigo drill-down competitivo, e o único pedaço dele que o Dashboard não cobria: o
 * resto (volume, sentimento, quem fala dele) já está nas seções acima.
 */
export function CompetitorChannelCard({ brandId, brandName }: { brandId: string; brandName: string }) {
  const hasSov = useFeature("sov")
  const [anchor] = useState(startOfToday)
  // Mesma janela das seções de 30 dias do Dashboard.
  const reaction = useOwnedReaction(brandId, { from: windowFrom(30, anchor) }, hasSov)

  return (
    <section className="border-t border-border-soft px-8 py-7">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <MessageSquareOff className="w-4 h-4 text-ink-muted" aria-hidden />
          <span className="eyebrow">Reação nos canais oficiais de {brandName} · 30 dias</span>
          <InfoHint text={NOT_COMPARABLE} label="Por que separado?" />
        </div>
        {/* Rótulo inequívoco: lido como "o que falam dele", a separação perde o sentido. */}
        <p className="text-[12.5px] text-ink-muted mt-1.5 mb-0 max-w-160 leading-relaxed">
          Comentários nos vídeos que {brandName} publicou. É o público dele reagindo ao
          conteúdo dele — <strong>não é comparável</strong> com as menções acima.
        </p>
      </div>

      {!hasSov ? (
        <div className="flex items-start gap-3 rounded-[12px] border border-border-soft px-4 py-3.5 bg-[#FAFBFC] dark:bg-[#151824] max-w-160">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" />
          <div className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            A reação da audiência nos canais de concorrentes faz parte do Share of Voice.{" "}
            <Link to={{ search: "?settings=addons" }} className="font-semibold text-teal-700 dark:text-teal-300 hover:underline">
              Ver add-ons
            </Link>
          </div>
        </div>
      ) : reaction.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-pulse">
          <div className="h-40 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          <div className="h-40 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        </div>
      ) : reaction.isError || !reaction.data ? (
        <EmptyBlock message={apiMessage(reaction.error, "Não foi possível carregar a reação nos canais oficiais.")} />
      ) : reaction.data.summary.videoCount === 0 ? (
        <EmptyBlock
          message="Nenhum vídeo do canal oficial nos últimos 30 dias"
          hint="Ou a marca não publicou, ou o canal oficial dela ainda não foi declarado no cadastro."
        />
      ) : (
        <ReactionBody data={reaction.data} />
      )}
    </section>
  )
}

function ReactionBody({ data }: { data: OwnedReactionResponse }) {
  const s = data.summary
  const total = s.positives + s.neutrals + s.negatives
  const reading = readSentiment(s.audienceSentiment)
  // O rótulo é o do servidor (mesma regra do writer); a tela só traduz.
  const label = s.audienceSentimentLabel ? tEnum("classification", s.audienceSentimentLabel) : reading.label
  const videos = [...data.videos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-x-10 gap-y-8">
      <div className="min-w-0">
        {s.audienceSentiment == null ? (
          <EmptyBlock
            message="Sem reação de audiência no período"
            hint="Nenhum vídeo teve comentários de terceiros para medir."
          />
        ) : (
          <>
            <div className="flex items-end gap-6 flex-wrap">
              <div>
                <div className="flex items-center gap-1 text-[12px] text-ink-muted mb-1">
                  Sentimento da audiência <InfoHint text={WEIGHTED} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display" style={{ fontSize: 34, lineHeight: 1, color: reading.color }}>
                    {formatScore(s.audienceSentiment)}
                  </span>
                  <span className="text-[13px]" style={{ color: reading.color }}>{label}</span>
                </div>
                <div className="text-[11px] text-ink-muted-2 mt-1">ponderado por volume de comentários</div>
              </div>
              {s.audienceSentimentPerVideo != null && (
                <div className="pb-1">
                  <div className="font-mono-zoe text-[16px]" style={{ color: "var(--ink)" }}>
                    {formatScore(s.audienceSentimentPerVideo)}
                  </div>
                  <div className="text-[11px] text-ink-muted-2">
                    média por vídeo · {s.videosWithAudienceSignal} {s.videosWithAudienceSignal === 1 ? "vídeo" : "vídeos"}
                  </div>
                </div>
              )}
            </div>
            {s.audienceIsConcentrated && (
              <p className="text-[12px] text-ink-muted mt-2.5 mb-0 leading-snug max-w-140">
                As duas médias divergem: a reação está <strong>concentrada em poucos vídeos</strong>.
              </p>
            )}
          </>
        )}

        <dl className="grid grid-cols-3 gap-4 my-6">
          <Stat label="Vídeos publicados" value={s.videoCount.toLocaleString("pt-BR")} />
          <Stat label="Comentários" value={s.totalComments.toLocaleString("pt-BR")} />
          <Stat label="Vídeos com reação" value={s.videosWithAudienceSignal.toLocaleString("pt-BR")} />
        </dl>

        {total > 0 && <CommentSentimentBar positives={s.positives} neutrals={s.neutrals} negatives={s.negatives} />}

        <SignalGaps commentsDisabled={s.videosWithCommentsDisabled} withoutSignal={s.videosWithoutAudienceSignal} />

        {data.recurringThemes.length > 0 && (
          <div className="mt-5">
            <div className="text-[12px] text-ink-muted mb-2">Temas recorrentes nesses vídeos</div>
            <div className="flex flex-wrap gap-1.5">
              {data.recurringThemes.map((t) => (
                <span key={t} className="chip text-[11px]">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="eyebrow mb-3">Publicações recentes</div>
        <ul className="flex flex-col list-none p-0 m-0">
          {videos.map((v) => <VideoRow key={v.analysisId} v={v} />)}
        </ul>
        {data.totalVideos > videos.length && (
          <div className="text-[11.5px] text-ink-muted-2 mt-3">
            Mostrando {videos.length} de {data.totalVideos} vídeos do período.
          </div>
        )}
      </div>
    </div>
  )
}

function VideoRow({ v }: { v: OwnedVideoItem }) {
  const r = readSentiment(v.audienceSentiment)
  return (
    <li className="flex items-start justify-between gap-4 py-2.5 border-t border-border-soft first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <a
          href={v.url || `https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium hover:underline inline-flex items-start gap-1.5 max-w-full"
          style={{ color: "var(--ink)" }}
        >
          <span className="line-clamp-2">{v.title}</span>
          <ExternalLink className="w-3 h-3 mt-1 shrink-0 opacity-60" aria-hidden />
        </a>
        <div className="text-[11.5px] text-ink-muted mt-0.5">
          {new Date(v.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          {v.views != null && <> · {v.views.toLocaleString("pt-BR")} visualizações</>}
        </div>
      </div>
      <div className="text-right shrink-0 text-[12px]">
        {v.commentsDisabled ? (
          <span className="chip chip-warn text-[10.5px]">comentários desativados</span>
        ) : !v.hasAudienceSignal ? (
          <span className="text-ink-muted-2">sem comentários</span>
        ) : (
          <>
            <div className="font-mono-zoe" style={{ color: r.color }}>{formatScore(v.audienceSentiment)}</div>
            <div className="text-[11px] text-ink-muted-2">
              {v.commentCount.toLocaleString("pt-BR")} {v.commentCount === 1 ? "comentário" : "comentários"}
            </div>
          </>
        )}
      </div>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dd className="m-0 font-mono-zoe text-[18px]" style={{ color: "var(--ink)" }}>{value}</dd>
      <dt className="text-[11.5px] text-ink-muted-2 mt-0.5">{label}</dt>
    </div>
  )
}

function CommentSentimentBar({ positives, neutrals, negatives }: { positives: number; neutrals: number; negatives: number }) {
  const total = positives + neutrals + negatives
  const seg = (n: number) => `${(n / total) * 100}%`
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
        <div style={{ width: seg(positives), background: "var(--color-pos)" }} />
        <div style={{ width: seg(neutrals), background: "#9CA3AF" }} />
        <div style={{ width: seg(negatives), background: "var(--color-neg)" }} />
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11.5px] text-ink-muted flex-wrap">
        <span><span className="font-mono-zoe" style={{ color: "var(--color-pos)" }}>{positives}</span> positivos</span>
        <span><span className="font-mono-zoe">{neutrals}</span> neutros</span>
        <span><span className="font-mono-zoe" style={{ color: "var(--color-neg)" }}>{negatives}</span> negativos</span>
      </div>
    </div>
  )
}

/**
 * As duas ausências não têm a mesma cara. Comentário desativado é decisão editorial da
 * marca — no canal de um concorrente, possivelmente a informação mais interessante do
 * card. "Sem comentários" é lacuna neutra.
 */
function SignalGaps({ commentsDisabled, withoutSignal }: { commentsDisabled: number; withoutSignal: number }) {
  if (commentsDisabled === 0 && withoutSignal === 0) return null
  return (
    <div className="mt-5 flex flex-col gap-2">
      {commentsDisabled > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "#FFFBEB" }}>
          <MessageSquareOff className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--color-warn)" }} aria-hidden />
          <div className="text-[12px] leading-snug" style={{ color: "#78350F" }}>
            <strong>
              {commentsDisabled} {commentsDisabled === 1 ? "vídeo" : "vídeos"} com comentários desativados
            </strong>
            <div className="opacity-80">
              Decisão editorial da marca, não falha de coleta. Desativar comentários num lançamento
              costuma ser deliberado.
            </div>
          </div>
        </div>
      )}
      {withoutSignal > 0 && (
        <p className="text-[11.5px] text-ink-muted-2 m-0">
          {withoutSignal} {withoutSignal === 1 ? "vídeo" : "vídeos"} sem comentários de audiência no período.
        </p>
      )}
    </div>
  )
}
