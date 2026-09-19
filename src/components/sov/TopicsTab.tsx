import { EmptyBlock } from "@/components/ui/empty-block"
import type { SovTopic, SovTopicShare } from "@/lib/api/dashboard"
import {
  brandColor, findTopicGaps, GLOSSARY, isLowVolume, leaderOf, MIN_TOPIC_VOLUME, type RankedBrand,
} from "@/lib/sov"
import { BlockSkeleton, BrandSwatch, SectionHead } from "./shared"

/** Fundo de chip na cor da marca. `color-mix` porque a cor derivada vem em hsl(), não em hex. */
const tint = (color: string) => `color-mix(in srgb, ${color} 13%, transparent)`

export function TopicsTab({ topics, loading, ranked }: {
  topics: SovTopic[]
  loading: boolean
  ranked: RankedBrand[]
}) {
  if (loading) {
    return (
      <section className="px-8 py-7">
        <BlockSkeleton rows={6} h="h-10" />
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

  // Tabela à esquerda, espaços não ocupados num painel ao lado. Empilhados, o painel
  // vem primeiro: é a leitura que pede ação, e a tabela é o detalhe.
  return (
    <section className="px-8 py-7">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-x-10 gap-y-8 items-start">
        {you && (
          <div className="xl:order-2 xl:sticky xl:top-4">
            <GapsPanel topics={topics} you={you} />
          </div>
        )}
        <div className="xl:order-1 min-w-0">
          <TopicShareTable topics={topics} ranked={ranked} />
        </div>
      </div>
    </section>
  )
}

// ── Espaços não ocupados ──────────────────────────────────────────────────

function GapsPanel({ topics, you }: { topics: SovTopic[]; you: RankedBrand }) {
  const gaps = findTopicGaps(topics, you.sharePct)
  const youColor = brandColor(you.brandId, you.color)

  return (
    <aside className="rounded-[14px] border border-border-soft p-5 bg-inset">
      <SectionHead
        title="Espaços não ocupados"
        hint={GLOSSARY.topics}
        sub={<>Onde o setor conversa e você quase não aparece: tópicos abaixo dos seus{" "}
          <span className="font-mono-zoe">{you.sharePct}%</span> gerais, com outra marca na frente.</>}
      />

      {gaps.length === 0 ? (
        // Some sem explicação parece que a análise não rodou.
        <p className="text-[12.5px] text-ink-muted m-0 leading-relaxed">
          Nenhum tópico com {MIN_TOPIC_VOLUME} ou mais menções em que outra marca esteja à sua
          frente e você abaixo da sua média.
        </p>
      ) : (
        <div className="flex flex-col">
          {gaps.map(({ topic, mine, leader }) => {
            const leaderColor = brandColor(leader.brandId, leader.color)
            return (
              <div key={topic.topic} className="border-t border-border-soft py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }} title={topic.topic}>
                    {topic.topic}
                  </span>
                  <span className="font-mono-zoe text-[11px] text-ink-muted-2 shrink-0">
                    {topic.volume.toLocaleString("pt-BR")} menções
                  </span>
                </div>
                {/* Você e o líder no mesmo trilho: o contraste é o par, e um empilhado com
                    todos diluiria justamente isso. */}
                <div className="relative h-2 rounded-full overflow-hidden bg-tint">
                  <div className="absolute inset-y-0 left-0 opacity-35" style={{ width: `${leader.sharePct}%`, background: leaderColor }} />
                  <div className="absolute inset-y-0 left-0" style={{ width: `${mine}%`, background: youColor }} />
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5 text-[11.5px] text-ink-muted">
                  <span>você <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{mine}%</span></span>
                  <span className="truncate">
                    {leader.brandName} <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{leader.sharePct}%</span>
                    {" · "}<span className="font-mono-zoe">{leader.sharePct - mine}pp</span> à frente
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}

// ── Share por tópico ──────────────────────────────────────────────────────

// Uma linha por tópico, e não rótulo em cima da barra: metade da altura, e a largura
// da tela vira barra em vez de margem vazia.
const ROW = "grid grid-cols-1 md:grid-cols-[minmax(140px,210px)_minmax(0,1fr)_minmax(150px,auto)] items-center gap-x-5 gap-y-1.5"

function TopicShareTable({ topics, ranked }: { topics: SovTopic[]; ranked: RankedBrand[] }) {
  const anyLow = topics.some(isLowVolume)

  return (
    <div>
      <SectionHead
        title="Share por tópico"
        hint={GLOSSARY.topics}
        sub={<>Cada barra divide as menções daquele assunto entre as marcas do conjunto, do tópico mais
          falado para o menos.{anyLow && <> Tópicos com menos de {MIN_TOPIC_VOLUME} menções aparecem
          esmaecidos: com esse volume, 50% ou 100% é acaso, não posição.</>}</>}
        aside={
          // Legenda fixa: sem ela, a barra empilhada só se lê passando o mouse em cada pedaço.
          <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
            {ranked.map((b) => (
              <span key={b.brandId} className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                <BrandSwatch color={brandColor(b.brandId, b.color)} />
                <span style={{ fontWeight: b.isYou ? 600 : 400, color: b.isYou ? "var(--ink)" : undefined }}>
                  {b.brandName}
                </span>
              </span>
            ))}
          </div>
        }
      />

      <div className={`${ROW} hidden md:grid pb-2 text-[11.5px] text-ink-muted`}>
        <span>Tópico</span>
        <span>Divisão entre as marcas</span>
        <span className="text-right">Você · liderança</span>
      </div>

      {topics.map((t) => {
        const low = isLowVolume(t)
        const mine = t.shares.find((s) => s.isYou)
        return (
          <div key={t.topic} className={`${ROW} py-2.5 border-t border-border-soft`} style={{ opacity: low ? 0.55 : 1 }}>
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }} title={t.topic}>
                {t.topic}
              </div>
              <div className="font-mono-zoe text-[11px] text-ink-muted-2">
                {t.volume.toLocaleString("pt-BR")} {t.volume === 1 ? "menção" : "menções"}
                {low && <span className="font-sans"> · amostra pequena</span>}
              </div>
            </div>

            <StackedBar shares={t.shares} />

            <div className="flex items-center md:justify-end gap-2 flex-wrap">
              <span className="text-[11.5px] text-ink-muted whitespace-nowrap">
                você <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{mine?.sharePct ?? 0}%</span>
              </span>
              <LeaderChip leader={leaderOf(t)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StackedBar({ shares }: { shares: SovTopicShare[] }) {
  return (
    <div className="flex h-4 rounded-md overflow-hidden bg-tint">
      {shares.map((s) => (
        <div
          key={s.brandId}
          title={`${s.brandName}: ${s.sharePct}%`}
          className="flex items-center justify-center text-[10px] font-mono-zoe text-white overflow-hidden"
          style={{ width: `${s.sharePct}%`, background: brandColor(s.brandId, s.color) }}
        >
          {/* Número dentro só onde cabe; o resto fica no title e na legenda. */}
          {s.sharePct >= 9 ? `${s.sharePct}%` : ""}
        </div>
      ))}
    </div>
  )
}

function LeaderChip({ leader }: { leader: SovTopicShare | null }) {
  // Empate não tem líder: com 50% a 50%, "líder: X" seria só a ordem da lista.
  if (!leader) return <span className="chip text-[10px] whitespace-nowrap">empate</span>
  const c = brandColor(leader.brandId, leader.color)
  return (
    <span className="chip text-[10px] whitespace-nowrap" style={{ background: tint(c), color: c }}>
      {leader.isYou ? "você lidera" : `líder: ${leader.brandName}`}
    </span>
  )
}
