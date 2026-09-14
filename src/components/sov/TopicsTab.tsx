import { EmptyBlock } from "@/components/ui/empty-block"
import type { SovTopic } from "@/lib/api/dashboard"
import { brandColor, findTopicGaps, GLOSSARY, leaderOf, type RankedBrand } from "@/lib/sov"
import { BlockSkeleton, BrandSwatch, SectionHead } from "./shared"

export function TopicsTab({ topics, loading, ranked }: {
  topics: SovTopic[]
  loading: boolean
  ranked: RankedBrand[]
}) {
  if (loading) {
    return (
      <section className="px-8 py-7">
        <BlockSkeleton rows={5} h="h-12" />
      </section>
    )
  }

  if (topics.length === 0) {
    return (
      <section className="px-8 py-7">
        <EmptyBlock
          message="Nenhum tópico no período"
          hint="Os tópicos vêm da análise de IA das menções e aparecem quando houver vídeos processados no recorte."
        />
      </section>
    )
  }

  const you = ranked.find((b) => b.isYou) ?? null
  return (
    <>
      {you && <GapsSection topics={topics} yourShare={you.sharePct} />}
      <TopicShareSection topics={topics} ranked={ranked} />
    </>
  )
}

// ── Espaços não ocupados ──────────────────────────────────────────────────

function GapsSection({ topics, yourShare }: { topics: SovTopic[]; yourShare: number }) {
  const gaps = findTopicGaps(topics, yourShare)

  return (
    <section className="px-8 py-7 border-b border-border-soft">
      <SectionHead
        title="Espaços não ocupados"
        hint={GLOSSARY.topics}
        sub={<>Tópicos com conversa no setor em que seu share está abaixo dos seus{" "}
          <span className="font-mono-zoe">{yourShare}%</span> gerais e outra marca lidera. É a pergunta que o
          share total não responde: onde o setor conversa e você quase não aparece.</>}
      />

      {gaps.length === 0 ? (
        // Some sem explicação parece que a análise não rodou.
        <p className="text-[13px] text-ink-muted m-0">
          Nenhum tópico em que você esteja abaixo da sua média com outra marca na liderança.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 max-w-4xl">
          {gaps.map(({ topic, mine, leader }) => (
            <div key={topic.topic} className="border-t border-border-soft pt-3.5">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-[14px] font-semibold truncate" style={{ color: "var(--ink)" }}>{topic.topic}</span>
                <span className="font-mono-zoe text-[11.5px] text-ink-muted shrink-0">
                  {topic.volume.toLocaleString("pt-BR")} {topic.volume === 1 ? "menção" : "menções"}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11.5px] text-ink-muted mb-1.5">
                <span>você <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{mine}%</span></span>
                <span>
                  {leader.brandName}{" "}
                  <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{leader.sharePct}%</span>
                </span>
              </div>

              {/* Duas barras no mesmo trilho: o contraste é você × líder, e um empilhado
                  com todos diluiria justamente isso. */}
              <div className="relative h-2.5 rounded-sm overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
                <div
                  className="absolute inset-y-0 left-0 opacity-40"
                  style={{ width: `${leader.sharePct}%`, background: brandColor(leader.brandId, leader.color) }}
                />
                <div className="absolute inset-y-0 left-0" style={{ width: `${mine}%`, background: "var(--color-teal-500)" }} />
              </div>
              <div className="text-[11.5px] text-ink-muted mt-1.5">
                {leader.sharePct - mine}pp atrás do líder
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Share por tópico ──────────────────────────────────────────────────────

function TopicShareSection({ topics, ranked }: { topics: SovTopic[]; ranked: RankedBrand[] }) {
  return (
    <section className="px-8 py-7">
      <SectionHead
        title="Share por tópico"
        hint={GLOSSARY.topics}
        sub="Cada barra divide as menções daquele assunto entre as marcas do conjunto. Os tópicos estão do maior volume para o menor."
      />

      {/* Legenda fixa: sem ela, a barra empilhada só se lê passando o mouse em cada pedaço. */}
      <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mb-5">
        {ranked.map((b) => (
          <span key={b.brandId} className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
            <BrandSwatch color={brandColor(b.brandId, b.color)} />
            <span style={{ fontWeight: b.isYou ? 600 : 400, color: b.isYou ? "var(--ink)" : undefined }}>{b.brandName}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4 max-w-4xl">
        {topics.map((t) => {
          const leader = leaderOf(t)
          const mine = t.shares.find((s) => s.isYou)
          return (
            <div key={t.topic}>
              <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{t.topic}</span>
                  <span className="font-mono-zoe text-[11px] text-ink-muted-2 shrink-0">
                    {t.volume.toLocaleString("pt-BR")} {t.volume === 1 ? "menção" : "menções"}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {mine && <span className="text-[11.5px] text-ink-muted">você <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{mine.sharePct}%</span></span>}
                  {leader && (leader.isYou ? (
                    <span className="chip chip-primary text-[10px]">você lidera</span>
                  ) : (
                    <span
                      className="chip text-[10px]"
                      style={{ background: `${brandColor(leader.brandId, leader.color)}1f`, color: brandColor(leader.brandId, leader.color) }}
                    >
                      líder: {leader.brandName}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex h-5 rounded-md overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
                {t.shares.map((s) => (
                  <div
                    key={s.brandId}
                    title={`${s.brandName}: ${s.sharePct}%`}
                    className="flex items-center justify-center text-[10.5px] font-mono-zoe text-white overflow-hidden"
                    style={{
                      width: `${s.sharePct}%`,
                      background: brandColor(s.brandId, s.color),
                      boxShadow: s.isYou ? "inset 0 0 0 2px rgba(255,255,255,.55)" : undefined,
                    }}
                  >
                    {/* Número dentro só onde cabe; o resto fica no title e na legenda. */}
                    {s.sharePct >= 9 ? `${s.sharePct}%` : ""}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
