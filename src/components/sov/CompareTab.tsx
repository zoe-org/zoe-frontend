import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useActiveBrand } from "@/features/brands/context"
import { ArrowRight } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { InfoHint } from "@/components/ui/info-hint"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SovTopic } from "@/lib/api/dashboard"
import { brandColor,
  CONTESTED_MARGIN, formatScore, GLOSSARY, matchup, nearestRival, readSentiment,
  type RankedBrand, type TopicDuel,
} from "@/lib/sov"
import { BlockSkeleton, BrandSwatch, DeltaPp, SectionHead } from "./shared"

/**
 * Você × um concorrente. É o "dossiê" do design na parte que os dados sustentam:
 * share, sentimento, volume e o duelo tópico a tópico. Temas próprios, alcance e
 * criadores em comum não entram — a API não os entrega por marca.
 */
export function CompareTab({ ranked, topics, topicsLoading, hasPreviousPeriod }: {
  ranked: RankedBrand[]
  topics: SovTopic[]
  topicsLoading: boolean
  hasPreviousPeriod: boolean
}) {
  const you = ranked.find((b) => b.isYou) ?? null
  const rivals = ranked.filter((b) => !b.isYou)
  const [choice, setChoice] = useState<string | null>(null)
  const { brands, setBrand } = useActiveBrand()
  // A escolha some sozinha se o concorrente sair do recorte (troca de marca própria).
  const rival = rivals.find((r) => r.brandId === choice) ?? nearestRival(ranked)

  if (!you) {
    return (
      <section className="px-8 py-7">
        <EmptyBlock
          message="Comparar exige uma marca própria no recorte"
          hint="Marque uma das suas marcas como própria em Gestão · Marcas."
        />
      </section>
    )
  }
  if (!rival) return null

  const youColor = brandColor(you.brandId, you.color)
  const rivalColor = brandColor(rival.brandId, rival.color)

  return (
    <>
      <section className="px-8 py-7 border-b border-border-soft">
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <span className="text-[13px] text-ink-muted">Comparar {you.brandName} com</span>
          <Select value={rival.brandId} onValueChange={setChoice}>
            <SelectTrigger
              aria-label="Concorrente da comparação"
              className="h-8 rounded-full px-3.5 text-[13px] font-medium border border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/25"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rivals.map((r) => (
                <SelectItem key={r.brandId} value={r.brandId}>{r.brandName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {brands.some((x) => x.brandId === rival.brandId) && (
            <Link
              to="/dashboard"
              onClick={() => setBrand(rival.brandId)}
              className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
            >
              Ver {rival.brandName} no dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <HeadToHead you={you} rival={rival} youColor={youColor} rivalColor={rivalColor} hasPreviousPeriod={hasPreviousPeriod} />
      </section>

      <section className="px-8 py-7">
        {topicsLoading ? (
          <BlockSkeleton rows={4} h="h-12" />
        ) : topics.length === 0 ? (
          <EmptyBlock message="Nenhum tópico no período" hint="O duelo por tópico aparece quando houver vídeos processados no recorte." />
        ) : (
          <TopicDuels
            topics={topics}
            you={you}
            rival={rival}
            youColor={youColor}
            rivalColor={rivalColor}
          />
        )}
      </section>
    </>
  )
}

// ── Frente a frente ───────────────────────────────────────────────────────

function HeadToHead({ you, rival, youColor, rivalColor, hasPreviousPeriod }: {
  you: RankedBrand
  rival: RankedBrand
  youColor: string
  rivalColor: string
  hasPreviousPeriod: boolean
}) {
  const ys = readSentiment(you.avgScore)
  const rs = readSentiment(rival.avgScore)
  // Sentimento só compara quando os dois têm leitura; "—" contra número não tem vencedor.
  const sentWinner = you.avgScore != null && rival.avgScore != null
    ? (you.avgScore > rival.avgScore ? "you" : you.avgScore < rival.avgScore ? "rival" : null)
    : null
  const winner = (a: number, b: number) => (a > b ? "you" : a < b ? "rival" : null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] min-w-130">
        <thead>
          <tr className="text-[12px] text-ink-muted">
            <th className="text-left font-medium pb-3 w-[28%]" />
            <th className="text-right font-medium pb-3">
              <span className="inline-flex items-center gap-1.5 justify-end" style={{ color: "var(--ink)" }}>
                <BrandSwatch color={youColor} /> <strong>{you.brandName}</strong>
                <span className="chip chip-primary text-[9.5px] px-1.5 py-px">VOCÊ</span>
              </span>
            </th>
            <th className="text-right font-medium pb-3">
              <span className="inline-flex items-center gap-1.5 justify-end" style={{ color: "var(--ink)" }}>
                <BrandSwatch color={rivalColor} /> {rival.brandName}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <Row label="Posição" hint="Lugar no ranking do conjunto competitivo, por share." win={winner(rival.rank, you.rank)}
            you={`#${you.rank}`} rival={`#${rival.rank}`} />
          <Row label="Share" hint={GLOSSARY.sov} win={winner(you.sharePct, rival.sharePct)}
            you={`${you.sharePct}%`} rival={`${rival.sharePct}%`}
            sub={`${Math.abs(you.sharePct - rival.sharePct)}pp de diferença`} />
          {hasPreviousPeriod && (
            <Row label="Variação" hint={GLOSSARY.pp} win={winner(you.deltaPp, rival.deltaPp)}
              you={<DeltaPp value={you.deltaPp} />} rival={<DeltaPp value={rival.deltaPp} />} />
          )}
          <Row label="Sentimento" hint={GLOSSARY.sentiment} win={sentWinner}
            you={<span style={{ color: ys.color }}>{formatScore(you.avgScore)} <span className="text-[11.5px]">{ys.label}</span></span>}
            rival={<span style={{ color: rs.color }}>{formatScore(rival.avgScore)} <span className="text-[11.5px]">{rs.label}</span></span>} />
          <Row label="Menções" hint={GLOSSARY.mentions} win={winner(you.mentions, rival.mentions)}
            you={you.mentions.toLocaleString("pt-BR")} rival={rival.mentions.toLocaleString("pt-BR")} />
        </tbody>
      </table>
    </div>
  )
}

function Row({ label, hint, you, rival, win, sub }: {
  label: string
  hint: string
  you: ReactNode
  rival: ReactNode
  win: "you" | "rival" | null
  sub?: string
}) {
  // Quem está à frente em cada linha ganha peso — a tabela se lê de relance.
  const cell = (side: "you" | "rival", content: ReactNode) => (
    <td className="py-3 text-right font-mono-zoe" style={{ color: "var(--ink)", fontWeight: win === side ? 700 : 400, opacity: win && win !== side ? 0.7 : 1 }}>
      {content}
    </td>
  )
  return (
    <tr className="border-t border-border-soft">
      <td className="py-3">
        <span className="inline-flex items-center gap-1 text-ink-muted">{label} <InfoHint text={hint} /></span>
        {sub && <div className="text-[11px] text-ink-muted-2 mt-0.5">{sub}</div>}
      </td>
      {cell("you", you)}
      {cell("rival", rival)}
    </tr>
  )
}

// ── Duelo por tópico ──────────────────────────────────────────────────────

function TopicDuels({ topics, you, rival, youColor, rivalColor }: {
  topics: SovTopic[]
  you: RankedBrand
  rival: RankedBrand
  youColor: string
  rivalColor: string
}) {
  const m = matchup(topics, rival.brandId)
  const total = m.youLead.length + m.theyLead.length + m.contested.length

  if (total === 0) {
    return (
      <EmptyBlock
        message={`Nenhum tópico com menção de ${you.brandName} ou ${rival.brandName}`}
        hint="Os tópicos do período são todos de outras marcas do conjunto."
      />
    )
  }

  return (
    <>
      <SectionHead
        title="Duelo por tópico"
        hint={GLOSSARY.topics}
        sub={<>Você está à frente em <strong style={{ color: "var(--ink)" }}>{m.youLead.length}</strong>{" "}
          {m.youLead.length === 1 ? "tópico" : "tópicos"} e atrás em{" "}
          <strong style={{ color: "var(--ink)" }}>{m.theyLead.length}</strong>. Diferença de até {CONTESTED_MARGIN}pp
          conta como disputa — o share já vem arredondado.</>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-7">
        <DuelColumn title={`Onde ${you.brandName} está à frente`} tone="var(--color-pos)" duels={m.youLead}
          youName={you.brandName} rivalName={rival.brandName} youColor={youColor} rivalColor={rivalColor}
          empty="Em nenhum tópico você está mais de 3pp à frente." />
        <DuelColumn title={`Onde ${rival.brandName} está à frente`} tone="var(--color-neg)" duels={m.theyLead}
          youName={you.brandName} rivalName={rival.brandName} youColor={youColor} rivalColor={rivalColor}
          empty={`Em nenhum tópico ${rival.brandName} está mais de 3pp à frente.`} />
        <DuelColumn title="Disputa acirrada" tone="var(--color-warn)" duels={m.contested}
          youName={you.brandName} rivalName={rival.brandName} youColor={youColor} rivalColor={rivalColor}
          empty="Nenhum tópico empatado." />
      </div>
    </>
  )
}

function DuelColumn({ title, tone, duels, youName, rivalName, youColor, rivalColor, empty }: {
  title: string
  tone: string
  duels: TopicDuel[]
  youName: string
  rivalName: string
  youColor: string
  rivalColor: string
  empty: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-4 rounded-full" style={{ background: tone }} />
        <span className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{title}</span>
        <span className="font-mono-zoe text-[11.5px] text-ink-muted-2">{duels.length}</span>
      </div>
      {duels.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted m-0">{empty}</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {duels.map((d) => (
            <div key={d.topic} className="border-t border-border-soft pt-3">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{d.topic}</span>
                <span className="font-mono-zoe text-[11px] text-ink-muted-2 shrink-0">
                  {d.volume.toLocaleString("pt-BR")} menções
                </span>
              </div>
              <DuelBar label={youName} value={d.yours} color={youColor} strong />
              <DuelBar label={rivalName} value={d.theirs} color={rivalColor} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DuelBar({ label, value, color, strong }: { label: string; value: number; color: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="w-20 truncate text-[11.5px] text-ink-muted" style={{ fontWeight: strong ? 600 : 400 }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
        <div style={{ width: `${value}%`, height: "100%", background: color }} />
      </div>
      <span className="w-9 text-right font-mono-zoe text-[11.5px]" style={{ color: "var(--ink)" }}>{value}%</span>
    </div>
  )
}
