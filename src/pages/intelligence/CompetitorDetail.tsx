import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ExternalLink, Lock, MessageSquareOff, Users } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import { ApiError } from "@/lib/api"
import { startOfToday, windowFrom } from "@/lib/date-window"
import {
  useCompetitorDetail,
  type CompetitorEarnedBlock,
  type CompetitorOwnedBlock,
} from "@/lib/api/owned"

/**
 * Drill-down competitivo (ADR-035, D6). Destino do clique no concorrente dentro
 * do Share of Voice — o SoV em si mantém o número limpo.
 *
 * ## Dois painéis, nunca fundidos
 *
 * `earned` responde "o que terceiros falam dele" e é comparável ao próprio earned
 * do cliente. `owned` responde "como a audiência dele reage nos canais dele".
 * Perguntas diferentes; somá-las num score único recria exatamente a distorção
 * que a ADR-035 existe pra corrigir, só que dentro de uma tela nova.
 *
 * ## Por que não há ConfidenceBadge nem score_360 no painel owned
 *
 * O corpus owned mistura vídeos analisados pelo pipeline pesado (score
 * contaminado pelo roteiro da própria marca) com a rota leve (limpo). A API não
 * devolve `score_360` nem `pipeline_path` aqui de propósito — o que vem é o
 * componente de comentários, path-invariante. Ver doc 05 §4/§5.
 */

const PERIOD_OPTIONS = [
  { key: "", label: "Todo o período" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "90", label: "Últimos 90 dias" },
] as const

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function scoreText(v: number | null): string {
  return v == null ? "—" : v.toFixed(2)
}

export default function CompetitorDetailPage() {
  const { brandId } = useParams<{ brandId: string }>()
  const [period, setPeriod] = useState("90")
  // Âncora no início do dia: estável durante o dia inteiro (não escorrega numa aba
  // aberta de ontem) e IGUAL pra todo mundo que abrir hoje. Ver lib/date-window.
  const [anchor] = useState(startOfToday)

  const range = useMemo(() => {
    const from = windowFrom(period, anchor)
    return from ? { from } : undefined
  }, [period, anchor])

  const detail = useCompetitorDetail(brandId ?? null, range)

  // Gate do add-on: o backend devolve 403 e a tela vira upsell — mesma decisão do SoV.
  if (detail.error instanceof ApiError && detail.error.status === 403) return <UpsellScreen />

  const data = detail.data

  return (
    <div>
      <section className="px-8 py-6 border-b border-border-soft">
        <Link
          to="/intelligence/sov"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Share of Voice
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              {data?.brand.name ?? "Concorrente"}
            </h1>
            <p className="text-[13px] text-ink-muted mt-1">
              Duas leituras separadas: o que falam dele e como a audiência dele reage.
            </p>
          </div>
          <SelectFilterChip
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            placeholder="Últimos 90 dias"
          />
        </div>
      </section>

      {detail.isLoading ? (
        <div className="px-8 py-20 text-center text-ink-muted text-[13px]">Carregando…</div>
      ) : detail.isError ? (
        <div className="px-8 py-20">
          <EmptyBlock
            message="Não foi possível carregar o detalhe"
            hint="Tente novamente em instantes."
          />
        </div>
      ) : !data ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          <EarnedPanel block={data.earned} brandName={data.brand.name} />
          <OwnedPanel block={data.owned} brandName={data.brand.name} />
        </div>
      )}
    </div>
  )
}

/** Painel 1 — o que TERCEIROS falam dele. Comparável ao earned da marca própria. */
function EarnedPanel({ block, brandName }: { block: CompetitorEarnedBlock; brandName: string }) {
  const total = block.sentiment.positives + block.sentiment.neutrals + block.sentiment.negatives

  return (
    <section className="px-8 py-7 border-b lg:border-b-0 lg:border-r border-border-soft">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-ink-muted" aria-hidden />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Conversa sobre {brandName}
        </h2>
      </div>
      <p className="text-[12px] text-ink-muted mb-6">
        O que canais de terceiros publicaram. É esta leitura que é comparável com o
        seu próprio earned.
      </p>

      {block.videoCount === 0 ? (
        <EmptyBlock
          message="Nenhuma menção de terceiros no período"
          hint="Ninguém publicou sobre esta marca na janela selecionada."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Vídeos" value={String(block.videoCount)} />
            <Stat label="Score médio" value={scoreText(block.averageScore)} />
            <Stat label="Share do SoV" value={pct(block.sovShare)} />
          </div>

          <SentimentBar
            positives={block.sentiment.positives}
            neutrals={block.sentiment.neutrals}
            negatives={block.sentiment.negatives}
            total={total}
          />

          {block.topChannels.length > 0 && (
            <div className="mt-6">
              <div className="eyebrow mb-3">Quem mais fala dele</div>
              <ul className="flex flex-col gap-2">
                {block.topChannels.map((c) => (
                  <li key={c.channelId} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] truncate" style={{ color: "var(--ink)" }}>
                      {c.channelName}
                    </span>
                    <span className="font-mono-zoe text-[12px] text-ink-muted shrink-0">
                      {c.videoCount} {c.videoCount === 1 ? "vídeo" : "vídeos"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Painel 2 — como a audiência reage NOS CANAIS DELE. Não comparável com o painel 1. */
function OwnedPanel({ block, brandName }: { block: CompetitorOwnedBlock; brandName: string }) {
  const total =
    block.commentSentiment.positives +
    block.commentSentiment.neutrals +
    block.commentSentiment.negatives

  return (
    <section className="px-8 py-7">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquareOff className="w-4 h-4 text-ink-muted" aria-hidden />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Reação da audiência nos canais oficiais de {brandName}
        </h2>
      </div>
      {/* Rótulo inequívoco de propósito: se o usuário ler isto como "o que falam
          dele por aí", a separação inteira dos dois painéis perde o sentido. */}
      <p className="text-[12px] text-ink-muted mb-6">
        Comentários nos vídeos publicados pelo próprio {brandName}. Mede a reação do
        público dele — <strong>não é comparável</strong> com o painel ao lado.
      </p>

      {block.videoCount === 0 ? (
        <EmptyBlock
          message="Nenhum vídeo do canal oficial no período"
          hint="Ou a marca não publicou, ou o canal oficial ainda não foi declarado no cadastro."
        />
      ) : (
        <>
          <AudienceScorePair
            weighted={block.audienceSentiment}
            perVideo={block.audienceSentimentPerVideo}
            label={block.audienceSentimentLabel}
            withSignal={block.videosWithAudienceSignal}
            isConcentrated={block.audienceIsConcentrated}
          />

          <div className="grid grid-cols-3 gap-4 my-6">
            <Stat label="Vídeos" value={String(block.videoCount)} />
            <Stat label="Comentários" value={block.totalComments.toLocaleString("pt-BR")} />
            <Stat label="Com sinal" value={String(block.videosWithAudienceSignal)} />
          </div>

          {total > 0 && (
            <SentimentBar
              positives={block.commentSentiment.positives}
              neutrals={block.commentSentiment.neutrals}
              negatives={block.commentSentiment.negatives}
              total={total}
            />
          )}

          <SignalGaps
            commentsDisabled={block.videosWithCommentsDisabled}
            withoutSignal={block.videosWithoutAudienceSignal}
          />

          {block.recentVideos.length > 0 && (
            <div className="mt-6">
              <div className="eyebrow mb-3">Publicações recentes</div>
              <ul className="flex flex-col gap-2.5">
                {block.recentVideos.map((v) => (
                  <li key={v.youtubeVideoId} className="flex items-start justify-between gap-3">
                    <a
                      href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] min-w-0 hover:underline flex items-start gap-1.5"
                      style={{ color: "var(--ink)" }}
                    >
                      <span className="truncate">{v.title}</span>
                      <ExternalLink className="w-3 h-3 mt-1 shrink-0 opacity-60" aria-hidden />
                    </a>
                    <span className="font-mono-zoe text-[12px] text-ink-muted shrink-0">
                      {v.commentCount > 0
                        ? `${scoreText(v.audienceSentiment)} · ${v.commentCount}`
                        : "sem comentários"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Os dois números aparecem JUNTOS por decisão de produto (doc 05 §5.3): eles só
 * carregam informação em contraste. A ponderada é a leitura da audiência (cada
 * comentário pesa um); a por-vídeo é a leitura do catálogo. Quando divergem
 * muito, um vídeo concentrou a audiência — e isso é a informação, não ruído.
 */
export function AudienceScorePair({
  weighted,
  perVideo,
  label,
  withSignal,
  isConcentrated,
}: {
  weighted: number | null
  perVideo: number | null
  label: string | null
  withSignal: number
  /** Resolvido no SERVIDOR. A tela não calcula limiar — ver lib/api/owned. */
  isConcentrated: boolean
}) {
  if (weighted == null) {
    return (
      <EmptyBlock
        message="Sem reação de audiência no período"
        hint="Nenhum vídeo teve comentários de terceiros para medir."
      />
    )
  }

  return (
    <div>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-1">Sentimento da audiência</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display" style={{ fontSize: 30, color: "var(--ink)" }}>
              {weighted.toFixed(2)}
            </span>
            {label && <span className="text-[13px] text-ink-muted">{label}</span>}
          </div>
          <div className="text-[11px] text-ink-muted-2 mt-0.5">
            ponderado por volume de comentários
          </div>
        </div>

        {perVideo != null && (
          <div className="pb-1">
            <div className="font-mono-zoe text-[15px]" style={{ color: "var(--ink)" }}>
              {perVideo.toFixed(2)}
            </div>
            <div className="text-[11px] text-ink-muted-2">
              média por vídeo · {withSignal} {withSignal === 1 ? "vídeo" : "vídeos"}
            </div>
          </div>
        )}
      </div>

      {isConcentrated && (
        <p className="text-[11.5px] text-ink-muted mt-2 leading-snug">
          As duas médias divergem: a reação está <strong>concentrada em poucos vídeos</strong>.
          O número ponderado reflete o que a maioria dos comentaristas expressou; a média
          por vídeo trata cada publicação como igual.
        </p>
      )}
    </div>
  )
}

/**
 * As duas ausências NÃO compartilham estética (doc 05 §5.1). Comentários
 * desativados é decisão editorial da marca — no canal de um concorrente é
 * possivelmente o item mais interessante da tela. "Sem sinal" é lacuna neutra.
 */
export function SignalGaps({
  commentsDisabled,
  withoutSignal,
}: {
  commentsDisabled: number
  withoutSignal: number
}) {
  if (commentsDisabled === 0 && withoutSignal === 0) return null

  return (
    <div className="mt-5 flex flex-col gap-2">
      {commentsDisabled > 0 && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded"
          style={{ background: "var(--color-amber-50, #FFFBEB)" }}
        >
          <MessageSquareOff
            className="w-3.5 h-3.5 mt-0.5 shrink-0"
            style={{ color: "var(--color-warn)" }}
            aria-hidden
          />
          <div className="text-[12px] leading-snug" style={{ color: "var(--color-amber-900, #78350F)" }}>
            <strong>
              {commentsDisabled} {commentsDisabled === 1 ? "vídeo" : "vídeos"} com comentários
              desativados
            </strong>
            <div className="opacity-80">
              Decisão editorial da marca — não é falha de coleta. Desativar comentários num
              lançamento costuma ser deliberado.
            </div>
          </div>
        </div>
      )}

      {withoutSignal > 0 && (
        <p className="text-[11.5px] text-ink-muted-2">
          {withoutSignal} {withoutSignal === 1 ? "vídeo" : "vídeos"} sem comentários de
          audiência no período.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono-zoe text-[17px]" style={{ color: "var(--ink)" }}>
        {value}
      </div>
      <div className="text-[11px] text-ink-muted-2 mt-0.5">{label}</div>
    </div>
  )
}

function SentimentBar({
  positives,
  neutrals,
  negatives,
  total,
}: {
  positives: number
  neutrals: number
  negatives: number
  total: number
}) {
  if (total === 0) return null
  const seg = (n: number) => `${(n / total) * 100}%`

  return (
    <div>
      <div className="flex h-2 rounded-sm overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
        <div style={{ width: seg(positives), background: "var(--color-pos)" }} />
        <div style={{ width: seg(neutrals), background: "#9CA3AF" }} />
        <div style={{ width: seg(negatives), background: "var(--color-neg)" }} />
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11.5px] text-ink-muted">
        <span>{positives} positivos</span>
        <span>{neutrals} neutros</span>
        <span>{negatives} negativos</span>
      </div>
    </div>
  )
}

function UpsellScreen() {
  return (
    <div className="px-8 py-20 flex flex-col items-center text-center">
      <Lock className="w-7 h-7 text-ink-muted-2 mb-4" aria-hidden />
      <h2 className="text-[16px] font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
        Análise competitiva não está no seu plano
      </h2>
      <p className="text-[13px] text-ink-muted max-w-md">
        O add-on de Share of Voice libera o detalhe de cada concorrente: o que terceiros
        falam dele e como a audiência reage nos canais oficiais dele.
      </p>
    </div>
  )
}
