import { useMemo, useState } from "react"
import { ExternalLink, MessageSquareOff } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { EmptyState } from "@/components/ui/empty-state"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import { useActiveBrand } from "@/features/brands/context"
import { startOfToday, windowFrom } from "@/lib/date-window"
import { useOwnedReaction, type OwnedVideoItem } from "@/lib/api/owned"
import { AudienceScorePair, SignalGaps } from "@/pages/intelligence/CompetitorDetail"

/**
 * Reação da audiência no canal oficial da MARCA PRÓPRIA (ADR-035, D3).
 *
 * Existe porque owned está fora de todos os agregados por definição — e sem uma
 * tela própria o cliente que publica no próprio canal simplesmente não encontra
 * os vídeos dele em lugar nenhum. Aqui a inclusão de owned é o produto.
 *
 * Não expõe `score_360` nem `ConfidenceBadge`: o corpus owned mistura vídeos do
 * pipeline pesado (score contaminado pelo próprio roteiro) com a rota leve. O
 * número aqui é o componente de comentários, path-invariante. Ver doc 05 §4/§5.
 */

const PERIOD_OPTIONS = [
  { key: "", label: "Todo o período" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "90", label: "Últimos 90 dias" },
] as const

export default function OwnedReactionPage() {
  const brand = useActiveBrand()
  const [period, setPeriod] = useState("90")
  // Âncora no início do dia — ver lib/date-window.
  const [anchor] = useState(startOfToday)

  const params = useMemo(() => {
    if (!brand.brandId) return null
    return { brandId: brand.brandId, from: windowFrom(period, anchor), pageSize: 20 }
  }, [brand.brandId, period, anchor])

  const reaction = useOwnedReaction(params)
  const data = reaction.data

  if (brand.isLoading) return <div className="px-8 py-20 text-center text-ink-muted text-[13px]">Carregando…</div>
  if (brand.brands.length === 0) {
    return (
      <EmptyState
        title="Nenhuma marca assinada ainda"
        description="Assine uma marca para acompanhar a reação da audiência no canal oficial dela."
        actionLabel="Assinar uma marca"
        onAction={() => { window.location.href = "/brands" }}
      />
    )
  }

  return (
    <div className="-m-6">
      <section className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-160">
            <div className="eyebrow mb-3">Intelligence · Canal próprio</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Reação da audiência
            </h1>
            <p className="text-[14px] text-ink-muted mt-1.5">
              Comentários nos vídeos publicados no canal oficial de{" "}
              <strong>{data?.brandName ?? brand.active?.displayName ?? brand.active?.brandName}</strong>.
            </p>
            {/* Ancora a expectativa antes de o usuário procurar o número em outro
                lugar: aqui é a única tela do produto que mede conteúdo próprio. */}
            <p className="text-[11.5px] text-ink-muted-2 mt-2 leading-snug">
              Estes vídeos ficam fora de Sentimento, Share of Voice e Influenciadores —
              lá as métricas medem o que <em>terceiros</em> publicam sobre você.
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

      {reaction.isLoading ? (
        <div className="px-8 py-20 text-center text-ink-muted text-[13px]">Carregando…</div>
      ) : reaction.isError ? (
        <div className="px-8 py-16">
          <EmptyBlock message="Não foi possível carregar" hint="Tente novamente em instantes." />
        </div>
      ) : !data || data.summary.videoCount === 0 ? (
        <div className="px-8 py-16">
          <EmptyBlock
            message="Nenhum vídeo do seu canal oficial no período"
            hint="Se você publica no YouTube, confirme com o suporte que o canal oficial está declarado no cadastro da marca."
          />
        </div>
      ) : (
        <>
          <section className="px-8 py-7 border-b border-border-soft">
            <AudienceScorePair
              weighted={data.summary.audienceSentiment}
              perVideo={data.summary.audienceSentimentPerVideo}
              label={data.summary.audienceSentimentLabel}
              withSignal={data.summary.videosWithAudienceSignal}
              isConcentrated={data.summary.audienceIsConcentrated}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
              <Stat label="Vídeos" value={String(data.summary.videoCount)} />
              <Stat label="Comentários" value={data.summary.totalComments.toLocaleString("pt-BR")} />
              <Stat label="Positivos" value={String(data.summary.positives)} />
              <Stat label="Negativos" value={String(data.summary.negatives)} />
            </div>

            <SignalGaps
              commentsDisabled={data.summary.videosWithCommentsDisabled}
              withoutSignal={data.summary.videosWithoutAudienceSignal}
            />
          </section>

          {data.recurringThemes.length > 0 && (
            <section className="px-8 py-5 border-b border-border-soft">
              <div className="eyebrow mb-3">Temas recorrentes nos comentários</div>
              <div className="flex flex-wrap gap-1.5">
                {data.recurringThemes.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2.5 py-1 rounded text-[12px]"
                    style={{ background: "var(--color-teal-50, #F0FDFA)", color: "var(--color-teal-700, #0F766E)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            {data.videos.map((v) => (
              <OwnedVideoRow key={v.analysisId} video={v} />
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function OwnedVideoRow({ video }: { video: OwnedVideoItem }) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 py-3.5 border-b border-border-soft">
      <div className="min-w-0">
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] font-medium hover:underline inline-flex items-start gap-1.5 min-w-0"
          style={{ color: "var(--ink)" }}
        >
          <span className="truncate">{video.title}</span>
          <ExternalLink className="w-3 h-3 mt-1 shrink-0 opacity-60" aria-hidden />
        </a>
        <div className="flex items-center gap-2 text-[11.5px] text-ink-muted mt-0.5 flex-wrap">
          <span>{new Date(video.publishedAt).toLocaleDateString("pt-BR")}</span>
          {video.views != null && (
            <>
              <span>·</span>
              <span className="font-mono-zoe">{video.views.toLocaleString("pt-BR")} views</span>
            </>
          )}
          <span>·</span>
          <span className="font-mono-zoe">
            {video.commentCount} {video.commentCount === 1 ? "comentário" : "comentários"}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        {video.commentsDisabled ? (
          // Estética de CONTEÚDO, não de erro: a marca decidiu desativar. Cinza de
          // "faltou dado" transformaria uma informação editorial em ruído.
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11.5px]"
            style={{ background: "var(--color-amber-50, #FFFBEB)", color: "var(--color-amber-700, #B45309)" }}
          >
            <MessageSquareOff className="w-3 h-3" aria-hidden />
            Comentários desativados
          </span>
        ) : !video.hasAudienceSignal ? (
          <span className="text-[12px] text-ink-muted-2">sem comentários</span>
        ) : (
          <>
            <div className="font-mono-zoe text-[14px]" style={{ color: "var(--ink)" }}>
              {video.audienceSentiment!.toFixed(2)}
            </div>
            <div className="text-[10.5px] text-ink-muted-2">{video.audienceSentimentLabel ?? "audiência"}</div>
          </>
        )}
      </div>
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
