import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { AlertCircle, Download, Lock, Sparkles } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { InfoHint } from "@/components/ui/info-hint"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Segmented } from "@/components/ui/segmented"
import { CoverageNotice } from "@/components/coverage/CoverageNotice"
import { PanoramaTab } from "@/components/sov/PanoramaTab"
import { TopicsTab } from "@/components/sov/TopicsTab"
import { CompareTab } from "@/components/sov/CompareTab"
import { useFeature } from "@/features/auth/useFeature"
import { useActiveBrand } from "@/features/brands/context"
import { useShareOfVoice, useSovTrend, useSovByTopic } from "@/lib/api/dashboard"
import { ApiError } from "@/lib/api"
import { toCsv, downloadCsv } from "@/lib/csv"
import { GLOSSARY, rankBrands } from "@/lib/sov"

const PERIOD_OPTIONS = [
  { key: "", label: "Todo o período" },
  { key: "7", label: "Últimos 7 dias" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "90", label: "Últimos 90 dias" },
] as const

// Três leituras, uma por pergunta: como estou (Panorama), sobre o quê (Por tópico) e
// contra quem (Comparar). Empilhadas numa página só, as cinco seções tinham o mesmo
// peso e nenhuma respondia a nada de relance. A aba "Resumo executivo" do design fica
// de fora: é narrativa gerada e decomposição de ganho, que a API não entrega.
const TABS = [
  { key: "panorama", label: "Panorama" },
  { key: "topicos", label: "Por tópico" },
  { key: "comparar", label: "Comparar" },
] as const
type TabKey = (typeof TABS)[number]["key"]

// Na URL, e não em estado: o link para uma aba funciona e o voltar do navegador também.
const TAB_PARAM = "aba"

export default function SovPage() {
  const hasSov = useFeature("sov")
  const [params, setParams] = useSearchParams()
  const tab: TabKey = TABS.find((t) => t.key === params.get(TAB_PARAM))?.key ?? "panorama"
  const setTab = (next: TabKey) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      if (next === "panorama") n.delete(TAB_PARAM)
      else n.set(TAB_PARAM, next)
      return n
    }, { replace: true })

  const [period, setPeriod] = useState("90")
  const days = period === "" ? 0 : Number(period)
  const periodLabel = period === "" ? "Todo o período" : `Últimos ${period} dias`

  // O recorte segue o brand switcher global quando a marca ativa é própria: quem
  // acabou de escolher "Itaú" lá em cima não deve ter que escolher de novo aqui.
  const brand = useActiveBrand()
  const marcaAtivaPropria =
    brand.active?.relationship === "OwnBrand" ? brand.active.brandId : null

  // Escolha local carimbada com a marca ativa do momento. Trocar no switcher global
  // descarta o override sozinho — sem efeito de reset, que dispararia render em
  // cascata e o lint recusa.
  const [override, setOverride] = useState<{ para: string | null; ownBrandId: string } | null>(null)
  const ownBrandId =
    override && override.para === marcaAtivaPropria ? override.ownBrandId : marcaAtivaPropria
  const setOwnBrandId = (id: string) => setOverride({ para: marcaAtivaPropria, ownBrandId: id })

  const sov = useShareOfVoice(hasSov, days, ownBrandId)
  const trend = useSovTrend(hasSov, 12, ownBrandId)
  const topics = useSovByTopic(hasSov, days, ownBrandId)

  const ranked = useMemo(() => rankBrands(sov.data?.brands ?? []), [sov.data])
  const competitors = ranked.filter((b) => !b.isYou).length

  const ownBrands = sov.data?.ownBrands ?? []
  const selectedOwn = sov.data?.selectedOwnBrandId ?? null
  // Mais de uma marca própria e nenhuma escolhida: a API devolve vazio de propósito
  // em vez de chutar a primeira (ADR-044). A tela pergunta.
  const precisaEscolher = ownBrands.length > 1 && selectedOwn === null

  // Bloqueio em QUALQUER marca do conjunto muda o share, não só na própria: o
  // denominador é a soma das menções visíveis.
  const setTenantBrandIds = ranked
    .map((b) => brand.brands.find((tb) => tb.brandId === b.brandId)?.tenantBrandId)
    .filter((id): id is string => Boolean(id))

  // Sem a feature → upsell. O backend também retorna 403 (defesa: a UI não depende
  // só de si), caindo no mesmo upsell.
  const forbidden = sov.error instanceof ApiError && sov.error.status === 403
  if (!hasSov || forbidden) return <UpsellScreen />

  const exportCsv = () => {
    if (ranked.length === 0) return
    const csv = toCsv(ranked, [
      { header: "Posição", value: (b) => b.rank },
      { header: "Marca", value: (b) => b.brandName },
      { header: "Você", value: (b) => (b.isYou ? "sim" : "") },
      { header: "Menções", value: (b) => b.mentions },
      { header: "Share (%)", value: (b) => b.sharePct },
      { header: "Sentimento (0-1)", value: (b) => (b.avgScore != null ? b.avgScore.toFixed(2) : "") },
      { header: "Variação (pp)", value: (b) => (days > 0 ? b.deltaPp : "") },
      { header: "Período", value: () => periodLabel },
    ])
    downloadCsv(`zoe-share-of-voice-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  const ready = !sov.isError && !sov.isLoading && !precisaEscolher && competitors > 0

  return (
    <div className="-m-6" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      {/* Abertura */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex-1 max-w-200 min-w-70">
            <div className="eyebrow mb-3">Intelligence · Competitivo</div>
            <h1 className="font-display m-0 text-ink" style={{ fontSize: 34, lineHeight: 1.1 }}>
              Share of Voice
            </h1>
            <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0">
              Quanto da conversa em vídeo sobre o seu setor é sobre a sua marca, frente aos
              concorrentes que você declarou.
            </p>
            {/* O recorte, dito antes de qualquer número: sem isto, 34% parece "34% do mercado". */}
            <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-3 text-[12px] text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <span className="chip text-[11px]">YouTube</span>
                <InfoHint text={GLOSSARY.scope} label="Por que só YouTube?" />
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="chip text-[11px]">Só vídeos de terceiros</span>
                <InfoHint text={GLOSSARY.earned} label="O que conta como menção?" />
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="chip text-[11px]">Seu conjunto competitivo</span>
                <InfoHint text={GLOSSARY.sov} label="Qual é o denominador?" />
              </span>
            </div>
          </div>
          <button
            onClick={exportCsv}
            disabled={ranked.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </section>

      {/* Barra de trabalho: a leitura à esquerda, o recorte à direita. Gruda no
          topo porque as três leituras são longas e trocar de aba no meio da
          rolagem era subir a página inteira pra encontrar o controle. */}
      <section
        className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-x-4 gap-y-2.5 flex-wrap sticky top-0 z-10"
        style={{ background: "var(--surface)" }}
      >
        <Segmented items={TABS} value={tab} onChange={setTab} ariaLabel="Leitura do share of voice" />

        <div className="flex items-center gap-2 ml-auto">
          {!precisaEscolher && competitors > 0 && (
            <span className="text-[12px] text-ink-muted whitespace-nowrap">
              {competitors} {competitors === 1 ? "concorrente" : "concorrentes"}
            </span>
          )}
          {/* O SoV é POR marca própria (ADR-044). Com mais de uma, o seletor é a
              primeira coisa a decidir — o período vem depois. `Select` direto porque o
              `SelectFilterChip` reserva a chave vazia para "todas", e aqui o recorte é
              obrigatório; o visual acompanha o chip à mão. */}
          {ownBrands.length > 1 && (
            <Select value={selectedOwn ?? ""} onValueChange={(v) => setOwnBrandId(v)}>
              <SelectTrigger
                aria-label="Marca própria do recorte"
                className={`h-8 rounded-lg px-3.5 text-[13px] font-medium border transition-colors ${
                  selectedOwn
                    ? "border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/25"
                    : "border-warn text-warn"
                }`}
                style={selectedOwn ? undefined : { borderColor: "var(--color-warn)", color: "var(--color-warn)" }}
              >
                <SelectValue placeholder="Escolha a marca própria" />
              </SelectTrigger>
              <SelectContent>
                {ownBrands.map((b) => (
                  <SelectItem key={b.brandId} value={b.brandId}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SelectFilterChip value={period} onChange={setPeriod} options={PERIOD_OPTIONS} placeholder="Todo o período" />
        </div>
      </section>

      <CoverageNotice
        tenantBrandIds={setTenantBrandIds}
        scopeLabel={setTenantBrandIds.length > 1 ? "deste conjunto competitivo" : "desta marca"}
        className="mx-8 mt-4"
      />

      {sov.isError && !forbidden ? (
        <ErrorState onRetry={() => sov.refetch()} />
      ) : sov.isLoading ? (
        <BarsSkeleton />
      ) : precisaEscolher ? (
        <EmptyBlock
          className="py-20"
          message="Escolha a marca própria"
          hint="Cada marca própria tem o seu conjunto competitivo, e o share é calculado dentro dele. Somar todas num número só compararia marcas de mercados diferentes."
        />
      ) : competitors === 0 && ranked.length > 0 ? (
        // Sem concorrente declarado não há denominador: a marca marcaria 100%, que é
        // um número correto para uma pergunta que ninguém fez.
        <EmptyBlock
          className="py-20"
          message="Nenhum concorrente no conjunto desta marca"
          hint="Monte o conjunto competitivo dela em Gestão · Marcas para comparar o share."
        />
      ) : ranked.length === 0 ? (
        <EmptyBlock
          className="py-20"
          message="Ainda não há dados de share of voice"
          hint="Assine marcas concorrentes, monte o conjunto competitivo da sua marca e aguarde o pipeline analisar menções."
        />
      ) : ready && tab === "topicos" ? (
        <TopicsTab topics={topics.data?.topics ?? []} loading={topics.isLoading} ranked={ranked} />
      ) : ready && tab === "comparar" ? (
        <CompareTab
          ranked={ranked}
          topics={topics.data?.topics ?? []}
          topicsLoading={topics.isLoading}
          hasPreviousPeriod={days > 0}
        />
      ) : (
        <PanoramaTab
          ranked={ranked}
          periodLabel={periodLabel}
          hasPreviousPeriod={days > 0}
          trend={trend.data}
          trendLoading={trend.isLoading}
          onCompare={() => setTab("comparar")}
        />
      )}
    </div>
  )
}

// ── Estados ───────────────────────────────────────────────────────────────

function UpsellScreen() {
  return (
    <div className="-m-6" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--teal-bg)" }}>
          <Lock className="w-6 h-6" style={{ color: "var(--color-teal-500)" }} />
        </div>
        <div className="eyebrow mb-3">Recurso premium</div>
        <h1 className="font-display m-0 mb-3" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Share of Voice
        </h1>
        <p className="text-[14px] text-ink-muted mb-6 max-w-md">
          Compare a fatia de voz da sua marca com a dos concorrentes e acompanhe a evolução ao
          longo do tempo. Ative o add-on em Configurações · Add-ons.
        </p>
        <a
          href="mailto:contato@heyzoe.com.br?subject=Habilitar%20Share%20of%20Voice"
          className="inline-flex items-center gap-1.5 h-10 px-5 text-[13.5px] font-medium rounded-md text-white transition-colors"
          style={{ background: "var(--color-ember)" }}
        >
          <Sparkles className="w-4 h-4" /> Falar com o time
        </a>
      </div>
    </div>
  )
}

function BarsSkeleton() {
  return (
    <section className="px-8 py-7">
      <div className="flex flex-col gap-4 max-w-3xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-40 rounded z-skeleton" />
            <div className="h-2 w-full rounded z-skeleton" />
          </div>
        ))}
      </div>
    </section>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-ink mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
