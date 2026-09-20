import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Download, TrendingUp, TrendingDown, Minus, ArrowUpDown, ArrowUp, AlertCircle, Users, X,
} from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { EmptyBlock } from "@/components/ui/empty-block"
import { CountUp } from "@/components/ui/count-up"
import { InfoHint } from "@/components/ui/info-hint"
import { SearchBox } from "@/components/ui/search-box"
import { Segmented } from "@/components/ui/segmented"
import { useActiveBrand } from "@/features/brands/context"
import { CoverageNotice } from "@/components/coverage/CoverageNotice"
import { brandVoice } from "@/features/brands/voice"
import { useInfluencers, type Influencer } from "@/lib/api/dashboard"
import { toCsv, downloadCsv } from "@/lib/csv"
import { useTheme } from "next-themes"
import { formatScore, scoreColor } from "@/lib/score"
import { stagger } from "@/lib/motion"

const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus }
const trendLabel: Record<string, string> = { up: "subindo", down: "caindo", stable: "estável" }

/** Quantos canais a lista mostra por vez (o backend manda tudo de uma vez). */
const PAGE = 15
/** Teto do endpoint (GetInfluencersQuery.Limit). Acima disso a lista vem cortada. */
const API_CAP = 100

/** Faixas do domínio: 0,60 pra cima é elogio; abaixo de 0,40 é crítica. */
const FALA_BEM = 0.6
const ATENCAO = 0.4

type SortKey = "mentions" | "reach" | "subscribers" | "sentiment"
type Tier = "all" | "mega" | "macro" | "micro"

// Tier por audiência (subscribers). null = canal sem captura de audiência ainda
// (collector não populou channel_snapshots) — não entra em nenhum tier.
function tierOf(subs: number | null): Exclude<Tier, "all"> | null {
  if (subs == null) return null
  if (subs >= 1_000_000) return "mega"
  if (subs >= 500_000) return "macro"
  return "micro"
}

const tierLabel: Record<Exclude<Tier, "all">, string> = { mega: "Mega", macro: "Macro", micro: "Micro" }

/**
 * Cores por tier (Mega laranja, Macro azul, Micro teal — do design).
 *
 * O par claro do design era fixo: fundo quase branco com texto escuro. No modo
 * escuro isso vira um adesivo claro sobre a superfície escura, e o contraste do
 * texto some. Aqui o fundo é o MATIZ com alfa e o texto é a versão clara dele —
 * a mesma técnica que `.chip-primary` já usava no dark.
 */
const tierChipStyle: Record<Exclude<Tier, "all">, { hue: string; light: string; dark: string }> = {
  mega: { hue: "249, 115, 22", light: "#C2410C", dark: "#FDBA74" },
  macro: { hue: "59, 130, 246", light: "#1D4ED8", dark: "#93C5FD" },
  micro: { hue: "0, 167, 153", light: "#006B60", dark: "#5DE0D4" },
}

function TierChip({ tier }: { tier: Exclude<Tier, "all"> }) {
  const c = tierChipStyle[tier]
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <span
      className="font-semibold shrink-0"
      style={{
        fontSize: 10.5, padding: "1px 7px", borderRadius: 4, letterSpacing: "0.04em",
        background: `rgba(${c.hue}, ${isDark ? 0.18 : 0.12})`,
        color: isDark ? c.dark : c.light,
      }}
    >
      {tierLabel[tier].toUpperCase()}
    </span>
  )
}

function fmtLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`
  return `${n}`
}

const nf = new Intl.NumberFormat("pt-BR")

// Score do backend está em [0,1] (0.5 ≈ neutro). >=0.6 positivo, <0.4 negativo.
function scoreChipClass(score: number): string {
  if (score >= FALA_BEM) return "chip-pos"
  if (score < ATENCAO) return "chip-neg"
  return ""
}

export default function InfluencersPage() {
  const navigate = useNavigate()
  const brand = useActiveBrand()
  const voice = brandVoice(brand.active)
  const inf = useInfluencers(brand.brandId)

  const [sortKey, setSortKey] = useState<SortKey>("mentions")
  const [sortAsc, setSortAsc] = useState(false)
  const [tier, setTier] = useState<Tier>("all")
  const [busca, setBusca] = useState("")
  const [visiveis, setVisiveis] = useState(PAGE)

  const influencers = useMemo(() => inf.data?.items ?? [], [inf.data])
  const totals = inf.data?.totals

  // Só faz sentido mostrar as abas de tier quando há audiência capturada.
  const hasSubs = useMemo(() => influencers.some((i) => i.subscribers != null), [influencers])

  const filtered = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const base = influencers.filter((i) => {
      if (tier !== "all" && tierOf(i.subscribers) !== tier) return false
      if (termo && !i.name.toLowerCase().includes(termo)) return false
      return true
    })
    const arr = [...base]
    const val = (i: Influencer): number => {
      if (sortKey === "mentions") return i.mentions
      if (sortKey === "reach") return i.reach
      if (sortKey === "subscribers") return i.subscribers ?? -1
      return i.avgScore
    }
    arr.sort((a, b) => (sortAsc ? val(a) - val(b) : val(b) - val(a)))
    return arr
  }, [influencers, sortKey, sortAsc, tier, busca])

  // Qualquer mudança de recorte volta pra primeira página: manter 45 linhas
  // abertas depois de trocar o filtro mostra um resultado que ninguém pediu.
  const trocarRecorte = (fn: () => void) => { fn(); setVisiveis(PAGE) }

  const toggleSort = (key: SortKey) => {
    trocarRecorte(() => {
      if (sortKey === key) setSortAsc(!sortAsc)
      else { setSortKey(key); setSortAsc(false) }
    })
  }

  const advocates = useMemo(
    () => [...influencers].filter((i) => i.avgScore >= FALA_BEM).sort((a, b) => b.avgScore - a.avgScore),
    [influencers],
  )
  const attention = useMemo(
    () => [...influencers]
      .filter((i) => i.avgScore < ATENCAO || i.trend === "down")
      .sort((a, b) => a.avgScore - b.avgScore),
    [influencers],
  )

  const temRecorte = tier !== "all" || busca.trim() !== ""
  const limparRecorte = () => trocarRecorte(() => { setTier("all"); setBusca("") })

  const tiers: { key: Tier; label: string; count: number }[] = useMemo(() => [
    { key: "all", label: "Todos", count: influencers.length },
    { key: "mega", label: "Mega", count: influencers.filter((i) => tierOf(i.subscribers) === "mega").length },
    { key: "macro", label: "Macro", count: influencers.filter((i) => tierOf(i.subscribers) === "macro").length },
    { key: "micro", label: "Micro", count: influencers.filter((i) => tierOf(i.subscribers) === "micro").length },
  ], [influencers])

  const handleExport = () => {
    const csv = toCsv(filtered, [
      { header: "Canal", value: (i) => i.name },
      { header: "Id do canal", value: (i) => i.channelId },
      { header: "Inscritos", value: (i) => i.subscribers ?? "" },
      { header: "Views somadas", value: (i) => i.reach },
      { header: "Menções", value: (i) => i.mentions },
      { header: "Sentimento", value: (i) => i.avgScore.toFixed(2) },
      { header: "Tendência", value: (i) => trendLabel[i.trend] ?? i.trend },
    ])
    downloadCsv(`influenciadores-${brand.active?.brandSlug ?? "marca"}.csv`, csv)
  }

  // ── Estados de topo ───────────────────────────────────────────────────
  if (brand.isLoading) return <PageSkeleton />
  if (brand.isError) return <ErrorState onRetry={() => brand.refetch()} />
  if (brand.brands.length === 0) {
    return (
      <EmptyState
        title="Nenhuma marca assinada ainda"
        description="Assine uma marca para ver a rede de influenciadores."
        actionLabel="Assinar uma marca"
        onAction={() => navigate("/brands")}
      />
    )
  }

  const mostrados = filtered.slice(0, visiveis)
  const restantes = filtered.length - mostrados.length

  return (
    <div className="-m-6" style={{ color: "var(--ink)" }}>
      {/* Abertura */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex-1 max-w-190 min-w-70">
            <div className="eyebrow mb-3">Intelligence · Pessoas</div>
            <h1 className="font-display m-0 text-ink" style={{ fontSize: 34, lineHeight: 1.1 }}>
              Influenciadores
            </h1>
            {/* Só o enquadramento: contagem, views e os dois grupos agora têm
                lugar próprio na faixa abaixo. Repetir aqui gastava duas linhas
                pra dizer o que o olho lê dois centímetros adiante. */}
            {inf.isLoading ? (
              <div className="h-4 w-96 max-w-full rounded z-skeleton mt-3" />
            ) : (
              <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 max-w-150">
                {influencers.length === 0
                  ? `Nenhum canal de terceiros citou ${voice.aMarca} nos últimos 30 dias.`
                  : `Canais de terceiros que citaram ${voice.aMarca} no YouTube nos últimos 30 dias.`}
              </p>
            )}
          </div>
          {/* A busca não mora aqui: ela recorta a tabela, que começa dois
              rolamentos abaixo. Junto do título, o controle ficava longe do
              efeito — agora ela vive na barra de trabalho, colada na lista. */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>
      </section>

      <CoverageNotice tenantBrandIds={[brand.active?.tenantBrandId]} className="mx-8 mt-4" />

      {inf.isError ? (
        <ErrorState onRetry={() => inf.refetch()} />
      ) : inf.isLoading ? (
        <TableSkeleton />
      ) : influencers.length === 0 ? (
        <EmptyBlock
          className="py-20"
          icon={<Users className="w-9 h-9" strokeWidth={1.5} />}
          message="Nenhum influenciador no período"
          hint="Assim que o pipeline analisar vídeos que mencionam esta marca, os criadores aparecem aqui — com alcance, sentimento e tendência."
        />
      ) : (
        <>
          {/* Uma faixa só: os dois grupos que pedem ação e, encostados neles, os
              números do período. Em duas faixas empilhadas os números empurravam
              a tabela pra baixo da dobra — e a tabela é o que a tela promete. */}
          <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_21rem] border-b border-border-soft">
            <div className="p-6 border-b xl:border-b-0 lg:border-r border-border-soft z-rise" style={stagger(0)}>
              <div className="eyebrow">Falam bem da marca</div>
              <div className="text-[12px] text-ink-muted mt-1 mb-3">
                Sentimento médio de {formatScore(FALA_BEM)} para cima
              </div>
              {advocates.length === 0 ? (
                <div className="text-[13px] text-ink-muted py-6">Nenhum canal nessa faixa no período.</div>
              ) : (
                <div className="flex flex-col">
                  {advocates.slice(0, 3).map((c, i) => (
                    <HighlightRow key={c.channelId} inf={c} index={i} hue={i * 67 + 160} />
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-b xl:border-b-0 xl:border-r border-border-soft z-rise" style={stagger(1)}>
              <div className="eyebrow">Merecem atenção</div>
              <div className="text-[12px] text-ink-muted mt-1 mb-3">
                Sentimento abaixo de {formatScore(ATENCAO)}, ou em queda contra o período anterior
              </div>
              {attention.length === 0 ? (
                <div className="text-[13px] text-ink-muted py-6">Nenhum canal nessa faixa no período.</div>
              ) : (
                <div className="flex flex-col">
                  {attention.slice(0, 3).map((c, i) => (
                    <HighlightRow key={c.channelId} inf={c} index={i} hue={i * 47 + 10} showTrend />
                  ))}
                </div>
              )}
            </div>

            {/* Rail de apoio, não manchete: os números contextualizam os
                destaques. As ressalvas que gastavam três linhas cada viraram
                tooltip — o texto continua lá, sem custar altura de página. */}
            <aside className="p-6 lg:col-span-2 xl:col-span-1 bg-inset z-rise" style={stagger(2)}>
              <div className="eyebrow mb-4">Visão geral · 30 dias</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Stat
                  label="Canais"
                  hint={influencers.length >= API_CAP
                    ? "Teto da consulta: há mais canais citando a marca além destes."
                    : "Canais de terceiros que citaram a marca nos últimos 30 dias."}
                >
                  <CountUp value={influencers.length} format={(n) => nf.format(Math.round(n))} />
                </Stat>

                <Stat label="Menções" hint="Vídeos de terceiros analisados no período.">
                  <CountUp value={totals?.totalMentions ?? 0} format={(n) => nf.format(Math.round(n))} />
                </Stat>

                <Stat
                  label="Views"
                  color="var(--color-teal-500)"
                  hint="Views somadas dos vídeos que citam a marca — não é a audiência dos canais."
                >
                  {fmtLargeNumber(totals?.totalReach ?? 0)}
                </Stat>

                <Stat
                  label="Sentimento"
                  color={scoreColor(totals?.avgScore ?? null)}
                  hint="Média de todas as menções do período, de 0,00 a 1,00."
                >
                  <CountUp value={totals?.avgScore ?? 0} format={(n) => formatScore(n)} />
                </Stat>
              </div>
            </aside>
          </section>

          {/* Barra de trabalho: tudo que recorta a tabela — tier, busca e o
              contador do resultado. Gruda no topo porque a lista é longa e o
              controle precisa seguir ao alcance enquanto se rola. */}
          <section
            className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-x-4 gap-y-2.5 flex-wrap sticky top-0 z-10"
            style={{ background: "var(--surface)" }}
          >
            {hasSubs ? (
              <div className="flex items-center gap-2">
                <Segmented
                  items={tiers}
                  value={tier}
                  onChange={(k) => trocarRecorte(() => setTier(k))}
                  ariaLabel="Recorte por tamanho de audiência"
                />
                <InfoHint text="Mega: 1 milhão de inscritos ou mais. Macro: de 500 mil a 1 milhão. Micro: abaixo de 500 mil. Canais sem inscritos capturados não entram em nenhum tier." />
              </div>
            ) : (
              // Sem inscritos capturados não dá pra separar por tier — melhor dizer
              // isso do que mostrar abas vazias (o collector ainda não popula).
              <span className="text-[12px] text-ink-muted-2 max-w-96">
                Tiers por audiência aparecem quando o pipeline capturar os inscritos dos canais.
              </span>
            )}

            <div className="flex items-center gap-2.5 ml-auto">
              <span className="text-[12px] text-ink-muted whitespace-nowrap">
                {filtered.length === influencers.length
                  ? `${filtered.length} ${filtered.length === 1 ? "canal" : "canais"}`
                  : `${filtered.length} de ${influencers.length} canais`}
              </span>
              {temRecorte && (
                <button
                  onClick={limparRecorte}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12px] rounded-lg text-ink-muted hover:text-ink hover:bg-hover transition-colors"
                >
                  <X className="w-3 h-3" /> Limpar
                </button>
              )}
              <SearchBox
                value={busca}
                onChange={(v) => trocarRecorte(() => setBusca(v))}
                placeholder="Buscar canal…"
                ariaLabel="Buscar canal na lista"
                className="w-44 sm:w-56"
              />
            </div>
          </section>

          {/* `overflow-y-clip` explícito: com só `overflow-x-auto`, a spec
              promove o eixo Y a `auto` junto (um eixo não fica `visible` ao
              lado de outro recortado) e a seção vira scroller nos dois
              sentidos. As linhas entram com `z-rise`, que as desloca 10px
              pra baixo — transbordo que conta pra área rolável e abria uma
              barra vertical fantasma até a última animação terminar. */}
          <section className="overflow-x-auto overflow-y-clip">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th className="text-left px-8 py-3 eyebrow font-semibold">#</th>
                  <th className="text-left py-3 eyebrow font-semibold">Canal</th>
                  <SortableHeader label="Inscritos" sortKey="subscribers" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortableHeader label="Views somadas" sortKey="reach" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortableHeader label="Menções" sortKey="mentions" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortableHeader label="Sentimento" sortKey="sentiment" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <th className="text-left px-4 py-3">
                    <span className="eyebrow font-semibold inline-flex items-center gap-1.5">
                      Tendência
                      <InfoHint text="Compara o sentimento médio do canal neste período com o período anterior. Sobe ou cai a partir de 0,05 de diferença; sem histórico anterior, fica estável." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mostrados.map((c, idx) => {
                  const TrendIcon = trendIcons[c.trend]
                  const trendColor =
                    c.trend === "up" ? "var(--color-pos)"
                      : c.trend === "down" ? "var(--color-neg)"
                        : "var(--ink-muted-2)"
                  const tierName = tierOf(c.subscribers)
                  return (
                    <tr
                      key={c.channelId}
                      className="border-b border-border-soft hover:bg-hover transition-colors z-rise"
                      style={stagger(Math.min(idx, 12))}
                    >
                      <td className="px-8 py-3.5">
                        <span className="font-mono-zoe text-[11.5px] text-ink-muted-2">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[13px]"
                            style={{ background: `hsl(${idx * 53}, 40%, 55%)` }}
                          >
                            {c.name[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium truncate text-ink">
                              {c.name || "Canal sem nome"}
                            </span>
                            {tierName && <TierChip tier={tierName} />}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 font-mono-zoe text-ink-2">
                        {c.subscribers == null ? (
                          <span className="text-ink-muted-2" title="Inscritos ainda não capturados para este canal">—</span>
                        ) : (
                          fmtLargeNumber(c.subscribers)
                        )}
                      </td>
                      <td className="py-3.5 font-mono-zoe text-ink-2">{fmtLargeNumber(c.reach)}</td>
                      <td className="py-3.5">
                        <span className="font-mono-zoe text-[13px] text-ink">{c.mentions}</span>
                      </td>
                      <td className="py-3.5">
                        <span className={`chip text-[11px] ${scoreChipClass(c.avgScore)}`}>
                          {formatScore(c.avgScore)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: trendColor }}>
                          <TrendIcon className="w-3.5 h-3.5" />
                          {trendLabel[c.trend]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-8 py-16 text-center">
                      <p className="text-ink-muted text-sm">
                        {busca.trim() ? (
                          <>
                            Nenhum canal com <span className="text-ink font-medium">“{busca.trim()}”</span> no nome
                            {tier !== "all" && ` entre os ${tierLabel[tier].toLowerCase()}`}.
                          </>
                        ) : (
                          "Nenhum canal com esse recorte."
                        )}
                      </p>
                      <button
                        onClick={limparRecorte}
                        className="mt-3 inline-flex items-center h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-hover transition-colors"
                      >
                        Limpar recorte
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Paginação local: a lista inteira já veio na resposta, então o botão
              só revela mais linhas — e por isso ele diz quantas faltam. */}
          {filtered.length > 0 && (
            <section className="px-8 py-6 flex flex-col items-center gap-2.5">
              {restantes > 0 ? (
                <>
                  <button
                    onClick={() => setVisiveis((v) => v + PAGE)}
                    className="inline-flex items-center h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors"
                  >
                    Carregar mais {restantes > PAGE ? PAGE : restantes}
                  </button>
                  <span className="text-[11.5px] text-ink-muted-2">
                    Mostrando {mostrados.length} de {filtered.length}
                  </span>
                </>
              ) : (
                <span className="text-[11.5px] text-ink-muted-2">
                  {filtered.length === 1 ? "1 canal" : `${filtered.length} canais`} · fim da lista
                  {influencers.length >= API_CAP && " (teto de 100 por consulta)"}
                </span>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ── Peças ──────────────────────────────────────────────────────────────

/**
 * Número do rail: menor que a manchete da faixa antiga de propósito — aqui ele
 * apoia os destaques, não disputa com eles. A ressalva mora no tooltip.
 */
function Stat({ label, hint, color, children }: {
  label: string
  hint?: string
  color?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="eyebrow inline-flex items-center gap-1 mb-2">
        {label}
        {hint && <InfoHint text={hint} />}
      </div>
      <div
        className="font-display leading-none truncate"
        style={{ fontSize: 27, color: color ?? "var(--ink)" }}
      >
        {children}
      </div>
    </div>
  )
}

function HighlightRow({
  inf, index, hue, showTrend,
}: { inf: Influencer; index: number; hue: number; showTrend?: boolean }) {
  const TrendIcon = trendIcons[inf.trend]
  return (
    <div className={`flex items-center gap-3 py-2.5 ${index === 0 ? "" : "border-t border-border-soft"}`}>
      <span className="font-mono-zoe text-[11px] text-ink-muted-2 w-[18px]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[13px]"
        style={{ background: `hsl(${hue}, 42%, 55%)` }}
      >
        {inf.name[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate text-ink">{inf.name || "Canal sem nome"}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted truncate">
          <span className="font-mono-zoe">{inf.mentions}</span>
          <span>{inf.mentions === 1 ? "menção" : "menções"}</span>
          <span>·</span>
          <span className="font-mono-zoe">{fmtLargeNumber(inf.reach)}</span>
          <span>views</span>
          {showTrend && inf.trend === "down" && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5" style={{ color: "var(--color-neg)" }}>
                <TrendIcon className="w-3 h-3" /> caindo
              </span>
            </>
          )}
        </div>
      </div>
      <span className={`chip text-[11px] ${scoreChipClass(inf.avgScore)}`}>
        {formatScore(inf.avgScore)}
      </span>
    </div>
  )
}

function SortableHeader({
  label, sortKey, currentKey, asc, onToggle,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  asc: boolean
  onToggle: (k: SortKey) => void
}) {
  const active = currentKey === sortKey
  return (
    <th className="text-left py-3">
      <button
        onClick={() => onToggle(sortKey)}
        className={`flex items-center gap-1 eyebrow font-semibold transition-colors ${active ? "text-ink" : "hover:text-ink-muted"}`}
      >
        {label}
        {/* Um indicador só: ativo mostra a direção, inativo mostra que dá pra ordenar. */}
        {active
          ? <ArrowUp className={`w-3 h-3 text-teal-500 transition-transform ${asc ? "" : "rotate-180"}`} />
          : <ArrowUpDown className="w-3 h-3 opacity-60" />}
      </button>
    </th>
  )
}

function PageSkeleton() {
  return (
    <div className="-m-6">
      <div className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="h-3 w-44 rounded z-skeleton mb-4" />
        <div className="h-9 w-80 max-w-full rounded z-skeleton" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_21rem] border-b border-border-soft">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-6 border-b xl:border-b-0 xl:border-r border-border-soft space-y-3">
            <div className="h-3 w-32 rounded z-skeleton" />
            <div className="h-9 rounded z-skeleton" />
            <div className="h-9 rounded z-skeleton" />
          </div>
        ))}
      </div>
      <TableSkeleton />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="px-8 py-6 space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 rounded z-skeleton" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-ink mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4">Tente novamente em instantes.</p>
      <button
        onClick={onRetry}
        className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  )
}
