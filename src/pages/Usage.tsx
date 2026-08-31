import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { EmptyBlock } from "@/components/ui/empty-block"
import { ApiError } from "@/lib/api"
import { useSubscription } from "@/lib/api/billing"
import {
  useSaveUsagePreferences,
  useUsageMeter,
  useUsagePreferences,
  type BrandUsage,
  type QuotaState,
  type UsageMeter,
  type UsageProjection,
} from "@/lib/api/usage"

// Consumo do período (ADR-041/043). Toda a tela sai de `/api/usage/meter` e
// `/api/usage/preferences` — nada é derivado de outra fonte, porque contestação de
// fatura se responde com a mesma trilha que gerou o número.

const WARNING_THRESHOLD = 0.8

// Cores por tom, não por estado: dois estados param a coleta e ambos são `neg`.
const TONE = {
  normal: { color: "var(--color-teal-500)", bg: "var(--color-teal-50)", border: "rgba(0,167,153,.28)" },
  warn: { color: "var(--color-warn)", bg: "#FFFBEB", border: "rgba(217,119,6,.32)" },
  neg: { color: "var(--color-neg)", bg: "#FEF2F2", border: "rgba(220,38,38,.32)" },
} as const

type Tone = keyof typeof TONE

const BLOCKING: QuotaState[] = ["SpendCapped", "TierCapped"]

const int = (v: number) => Math.round(v).toLocaleString("pt-BR")
const dec = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
// Preço do minuto tem fração de centavo (R$ 0,034/min). Formatar com 2 casas
// mostraria R$ 0,03 e faria a conta exibida não fechar com o total.
const rate = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3,
  })
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
const duration = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`

// Cor por marca derivada do id: o medidor não carrega a cor escolhida no SoV, e
// inventar uma paleta fixa faria a mesma marca mudar de cor entre as telas.
function brandColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360}, 55%, 55%)`
}

export default function UsagePage() {
  const meter = useUsageMeter()
  // A assinatura entra só pelo nome do plano: todo número do medidor vem do medidor.
  const subscription = useSubscription()

  if (meter.isLoading) return <SkeletonScreen />

  if (meter.error) {
    const message =
      meter.error instanceof ApiError ? meter.error.message : "Não foi possível carregar o consumo."
    return (
      <div className="p-8">
        <EmptyBlock message={message} />
      </div>
    )
  }

  const data = meter.data!
  const hasQuota = data.quotaMinutes > 0
  const paused = BLOCKING.includes(data.state)
  const tone: Tone = paused
    ? "neg"
    : data.state === "Warning" || data.state === "Overage"
      ? "warn"
      : "normal"

  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <Hero
        data={data}
        planSlug={subscription.data?.planSlug ?? null}
        trialEndsAt={subscription.data?.status === "Trialing" ? subscription.data.trialEndsAt : null}
      />

      <StateBanner data={data} paused={paused} hasQuota={hasQuota} />

      <div className="px-8 py-7 space-y-4">
        <MeterCard
          data={data}
          tone={tone}
          hasQuota={hasQuota}
          paused={paused}
          hasSubscription={subscription.data != null}
          emTeste={subscription.data?.status === "Trialing"}
        />

        <Projection projection={data.projection} paused={paused} hasQuota={hasQuota} />

        <BrandTable rows={data.byBrand} billedMinutes={data.billedMinutes} />

        <SpendCapCard
          overageCentsPerMinute={data.overageCentsPerMinute}
          quotaMinutes={data.quotaMinutes}
        />

        <div className="text-[11.5px] text-ink-muted-2">
          Números apurados em {new Date(data.asOf).toLocaleString("pt-BR")}.
        </div>
      </div>
    </div>
  )
}

// ── Cabeçalho ─────────────────────────────────────────────────────────────

function Hero({
  data,
  planSlug,
  trialEndsAt,
}: {
  data: UsageMeter
  planSlug: string | null
  /** Não-nulo só durante o teste. É o que explica a cota reduzida logo abaixo. */
  trialEndsAt: string | null
}) {
  return (
    <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
      <div className="eyebrow mb-2.5">Gestão · Consumo</div>
      <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
        Vídeo-minutos
      </h1>
      <div className="text-[14px] text-ink-muted mt-1.5 max-w-160">
        O que foi processado neste período de cobrança, de onde veio e quanto ainda cabe na cota.
      </div>
      <div className="text-[12.5px] text-ink-muted-2 mt-3">
        {dayMonth(data.periodStart)} a {dayMonth(data.periodEnd)} · {data.daysRemaining}{" "}
        {data.daysRemaining === 1 ? "dia restante" : "dias restantes"}
        {planSlug && <> · plano {planSlug}</>}
        {trialEndsAt && <> · teste até {dayMonth(trialEndsAt)}</>}
      </div>
    </section>
  )
}

// ── Banner de estado ──────────────────────────────────────────────────────

type BannerProps = { data: UsageMeter; paused: boolean; hasQuota: boolean }

function StateBanner(p: BannerProps) {
  const banner = bannerFor(p)
  if (!banner) return null

  const t = TONE[banner.tone]
  return (
    <section className="px-8 pt-6">
      <div
        className="flex items-start gap-3 rounded-[14px] border px-4 py-3.5"
        style={{ background: t.bg, borderColor: t.border }}
      >
        <AlertCircle className="w-[17px] h-[17px] shrink-0 mt-0.5" style={{ color: t.color }} />
        <div className="flex-1">
          <div className="text-[14px] font-semibold" style={{ color: t.color }}>
            {banner.title}
          </div>
          <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {banner.detail}
          </div>
        </div>
      </div>

      {p.paused && (
        <div className="flex items-start gap-2.5 mt-3 text-[12.5px] text-ink-muted leading-relaxed">
          <ShieldCheck className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: "var(--color-teal-500)" }} />
          <span>
            Todo o histórico já coletado continua acessível — dashboards, menções, alertas e
            relatórios. Só a coleta de vídeos novos está pausada.
          </span>
        </div>
      )}
    </section>
  )
}

function bannerFor({ data, hasQuota }: BannerProps): { title: string; detail: string; tone: Tone } | null {
  // TierCapped é o teto estrutural do plano: só upgrade resolve. SpendCapped o
  // próprio tenant destrava, e o texto tem que dizer qual dos dois é.
  if (data.state === "TierCapped") {
    return {
      title: "Limite do plano atingido — coleta pausada",
      detail:
        "O consumo chegou ao teto do seu plano. Elevar o teto de gasto não resolve este caso: " +
        "é preciso mudar de plano para voltar a coletar.",
      tone: "neg",
    }
  }

  if (data.state === "SpendCapped") {
    return data.spendCapCents > 0
      ? {
          title: "Teto de gasto atingido — coleta pausada",
          detail:
            `O consumo além da cota chegou ao teto de ${brl(data.spendCapCents)} que você autorizou. ` +
            "Nenhum vídeo novo está sendo coletado.",
          tone: "neg",
        }
      : {
          title: "Cota esgotada — coleta pausada",
          detail:
            `Os ${int(data.quotaMinutes)} minutos do período acabaram e não há teto de gasto autorizado. ` +
            "Autorize um teto abaixo para continuar coletando além da cota.",
          tone: "neg",
        }
  }

  if (data.state === "Overage") {
    return {
      title: "Consumo além da cota em curso",
      detail:
        `${int(data.overageMinutes)} minutos além da cota, dentro do teto de ` +
        `${brl(data.spendCapCents)}. Acumulado até agora: ${brl(data.overageCents)}.`,
      tone: "warn",
    }
  }

  if (data.state === "Warning" && hasQuota) {
    const left = Math.max(0, data.quotaMinutes - data.billedMinutes)
    return {
      title: `Você passou de ${Math.round(WARNING_THRESHOLD * 100)}% da cota`,
      detail: `Faltam ${int(left)} minutos e ${data.daysRemaining} dias de período.`,
      tone: "warn",
    }
  }

  return null
}

// ── Medidor ───────────────────────────────────────────────────────────────

type MeterProps = {
  data: UsageMeter
  tone: Tone
  hasQuota: boolean
  paused: boolean
  /** Distingue Enterprise (pay-as-you-go) de workspace sem contrato nenhum. */
  hasSubscription: boolean
  /** Durante o teste a cota é a de trial, não a do tier — e isso precisa ser dito. */
  emTeste: boolean
}

function MeterCard(p: MeterProps) {
  const t = TONE[p.tone]
  const pct = p.hasQuota ? p.data.billedMinutes / p.data.quotaMinutes : 0

  return (
    <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display" style={{ fontSize: 38, lineHeight: 1, color: t.color }}>
              {int(p.data.billedMinutes)}
            </span>
            <span className="text-[15px] text-ink-muted">
              {p.hasQuota ? <>de {int(p.data.quotaMinutes)} minutos</> : <>minutos cobrados</>}
            </span>
            {p.hasQuota && (
              <span
                className="text-[12px] font-semibold rounded-full px-2 py-0.5"
                style={{ background: t.bg, color: t.color }}
              >
                {Math.round(pct * 100)}%
              </span>
            )}
          </div>
          {p.paused && <span className="chip chip-neg text-[11px]">coleta pausada</span>}
        </div>

        {p.hasQuota ? (
          <>
            <QuotaBar pct={pct} color={t.color} />
            <div className="flex justify-between mt-2 text-[11.5px] text-ink-muted-2 font-mono-zoe">
              <span>0</span>
              <span>
                {p.emTeste ? "cota do teste" : "cota do plano"} · {int(p.data.quotaMinutes)} min
              </span>
            </div>

            {/* Sem isto a tela se contradiz: aqui aparece a cota do teste e o card do
                plano anuncia a cota cheia, sem nada ligando os dois números. */}
            {p.emTeste && (
              <div className="text-[12px] text-ink-muted mt-2.5 leading-relaxed">
                Durante o período de teste a cota é reduzida. A cota cheia do plano passa a
                valer quando a assinatura for paga.
              </div>
            )}
          </>
        ) : p.hasSubscription ? (
          // Enterprise: cota zero é pay-as-you-go. Barra sem denominador desenharia
          // um limite que não existe.
          <div className="text-[12.5px] text-ink-muted">
            Este plano não tem cota fixa de minutos — o consumo é medido e cobrado pelo que
            for processado.
          </div>
        ) : (
          // Sem assinatura NÃO é pay-as-you-go: não há contrato, e dizer "cobrado pelo
          // que for processado" prometeria uma cobrança que não existe. O consumo é
          // medido mesmo assim — o fail-safe não bloqueia quem não tem contrato.
          <div className="text-[12.5px] text-ink-muted">
            Este workspace ainda não tem assinatura. O consumo está sendo medido, mas não há
            plano contratado —{" "}
            <Link to="/plan" className="underline" style={{ color: "var(--color-teal-500)" }}>
              escolha um plano
            </Link>{" "}
            para definir cota e cobrança.
          </div>
        )}

        {p.hasQuota && p.data.overageMinutes > 0 && (
          <div className="flex items-baseline gap-2.5 flex-wrap mt-4 pt-4 border-t border-border-soft">
            <span className="text-[13px] text-ink-muted">Consumo além da cota</span>
            <span className="font-display" style={{ fontSize: 21, color: t.color }}>
              {brl(p.data.overageCents)}
            </span>
            <span className="text-[11.5px] text-ink-muted-2 font-mono-zoe">
              {int(p.data.overageMinutes)} min × {rate(p.data.overageCentsPerMinute)}/min
            </span>
            <span className="ml-auto text-[12.5px] text-ink-muted">
              Teto autorizado: {p.data.spendCapCents > 0 ? brl(p.data.spendCapCents) : "nenhum"}
            </span>
          </div>
        )}
      </div>

      <TwoQuantities
        billed={p.data.billedMinutes}
        analyzed={p.data.analyzedVideos}
        owned={p.data.ownedVideos}
      />
    </div>
  )
}

function QuotaBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width]"
        style={{ width: `${Math.min(100, pct * 100)}%`, background: color }}
      />
      {/* Marca dos 80%: é onde o aviso é disparado, então tem que ser visível
          antes de ser cruzada, não depois. */}
      <div
        className="absolute inset-y-0 w-px"
        style={{ left: `${WARNING_THRESHOLD * 100}%`, background: "var(--surface)", opacity: 0.9 }}
        title="80% da cota"
      />
    </div>
  )
}

/**
 * As duas grandezas da ADR-041, lado a lado e rotuladas. Não existe um terceiro
 * número somando as duas de propósito: minuto e vídeo são unidades diferentes, e
 * um total misturado é o tipo de número que vira slide.
 */
function TwoQuantities({
  billed,
  analyzed,
  owned,
}: {
  billed: number
  analyzed: number
  owned: number
}) {
  return (
    <div className="grid sm:grid-cols-2 border-t border-border-soft">
      <div className="px-6 py-5 sm:border-r border-border-soft">
        <div className="eyebrow">Minutos cobrados</div>
        <div className="font-display mt-1.5" style={{ fontSize: 26, color: "var(--ink)" }}>
          {int(billed)}
        </div>
        <div className="text-[12px] text-ink-muted mt-1.5 leading-relaxed">
          A unidade de cobrança do período. Um vídeo de 40 minutos consome 40 minutos de cota.
        </div>
      </div>
      <div className="px-6 py-5">
        <div className="eyebrow">Vídeos analisados</div>
        <div className="font-display mt-1.5" style={{ fontSize: 26, color: "var(--ink)" }}>
          {int(analyzed)}
        </div>
        <div className="text-[12px] text-ink-muted mt-1.5 leading-relaxed">
          {owned > 0 ? (
            <>
              Inclui {int(owned)} {owned === 1 ? "vídeo do seu próprio canal" : "vídeos do seu próprio canal"},
              analisados e <strong>não cobrados</strong>.
            </>
          ) : (
            <>Volume analisado no período. Não se soma aos minutos — são unidades diferentes.</>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Projeção ──────────────────────────────────────────────────────────────

function Projection({
  projection,
  paused,
  hasQuota,
}: {
  projection: UsageProjection
  paused: boolean
  hasQuota: boolean
}) {
  // Coleta pausada não tem ritmo a projetar: a estimativa diria que a cota acaba
  // num dia em que nada mais vai ser coletado.
  if (paused) return null

  const text = projectionText(projection, hasQuota)

  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border border-border-soft px-4 py-3.5"
      style={{ background: "var(--surface)" }}
    >
      <span className="eyebrow shrink-0 mt-0.5">estimativa</span>
      <div className="flex-1">
        <div className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {text.headline}
        </div>
        <div className="text-[12.5px] text-ink-muted mt-1">{text.caveat}</div>
      </div>
      {projection.confidence === "Low" && <span className="chip chip-warn text-[10.5px]">confiança baixa</span>}
    </div>
  )
}

function projectionText(p: UsageProjection, hasQuota: boolean) {
  // A incerteza vem da API e não da tela: se cada consumidor a redigisse, o
  // e-mail e o painel qualificariam o mesmo número de formas diferentes.
  if (p.confidence === "Insufficient") {
    return {
      headline: "Ainda não há dados suficientes para estimar o fim da cota.",
      caveat:
        `São necessários ao menos 3 dias de consumo no período; até agora há ${p.sampleDays}. ` +
        "A estimativa aparece assim que o ritmo se estabiliza.",
    }
  }

  const base =
    `Ritmo de ${dec(p.minutesPerDay)} minutos por dia nos últimos ${p.sampleDays} ` +
    `${p.sampleDays === 1 ? "dia" : "dias"}. Não é cobrança.`

  if (!hasQuota) {
    return {
      headline: `No ritmo atual, o período deve fechar em cerca de ${int(p.projectedPeriodMinutes)} minutos.`,
      caveat: base,
    }
  }

  if (!p.estimatedExhaustionAt) {
    return {
      headline:
        `No ritmo atual, a cota deve durar até o fim do período — projeção de ` +
        `${int(p.projectedPeriodMinutes)} minutos.`,
      caveat: base,
    }
  }

  return {
    headline: (
      <>
        No ritmo atual, sua cota deve acabar{" "}
        <strong className="font-semibold">por volta de {dayMonth(p.estimatedExhaustionAt)}</strong> —
        projeção de {int(p.projectedPeriodMinutes)} minutos no período.
      </>
    ),
    caveat:
      p.confidence === "Low"
        ? `Confiança baixa: só ${p.sampleDays} dias de amostra. Trate como sinal inicial, não como previsão.`
        : base,
  }
}

// ── Causa do consumo ──────────────────────────────────────────────────────

function BrandTable({ rows, billedMinutes }: { rows: BrandUsage[]; billedMinutes: number }) {
  return (
    <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-6 pt-5 pb-3">
        <div className="eyebrow">Causa do consumo, por marca</div>
        <div className="text-[13px] text-ink-muted mt-2 max-w-165 leading-relaxed">
          Os quatro números juntos, porque 50 vídeos de 2 minutos e 2 vídeos de 50 minutos dão o
          mesmo total e pedem ações opostas.
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 pb-6">
          <EmptyBlock message="Nenhum minuto cobrado neste período." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-border-soft">
                <th className="text-left font-medium text-ink-muted px-6 py-2.5">Marca</th>
                <th className="text-right font-medium text-ink-muted px-3 py-2.5">Minutos</th>
                <th className="text-right font-medium text-ink-muted px-3 py-2.5">Vídeos</th>
                <th className="text-right font-medium text-ink-muted px-3 py-2.5">Duração média</th>
                <th className="text-right font-medium text-ink-muted px-3 py-2.5">Vídeo mais longo</th>
                <th className="text-left font-medium text-ink-muted px-6 py-2.5 w-[150px]">Participação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const share = billedMinutes > 0 ? (b.billedMinutes / billedMinutes) * 100 : 0
                const color = brandColor(b.brandId)
                return (
                  <tr key={b.brandId} className="border-b border-border-soft last:border-b-0">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                        <span className="font-semibold">{b.brandName}</span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-3 font-mono-zoe">{int(b.billedMinutes)}</td>
                    <td className="text-right px-3 py-3 font-mono-zoe">{int(b.videoCount)}</td>
                    <td className="text-right px-3 py-3 font-mono-zoe">{dec(b.averageMinutes)} min</td>
                    <td className="text-right px-3 py-3 font-mono-zoe">{duration(b.longestVideoMinutes)}</td>
                    <td className="px-6 py-3">
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Teto de gasto ─────────────────────────────────────────────────────────

function SpendCapCard({
  overageCentsPerMinute,
  quotaMinutes,
}: {
  overageCentsPerMinute: number
  quotaMinutes: number
}) {
  const prefs = useUsagePreferences()
  const save = useSaveUsagePreferences()

  // Em reais na tela, em centavos no contrato. A conversão mora aqui e em nenhum
  // outro lugar.
  //
  // O campo é DERIVADO do servidor, com o que foi digitado por cima: sincronizar
  // por efeito dispararia render em cascata e, pior, sobrescreveria a digitação
  // toda vez que a query revalidasse.
  const [draft, setDraft] = useState<string | null>(null)
  const capReais = draft ?? (prefs.data ? String(prefs.data.spendCapCents / 100) : "")

  const capCents = Math.max(0, Math.round(Number(capReais.replace(",", ".")) * 100)) || 0
  const dirty = prefs.data ? capCents !== prefs.data.spendCapCents : false

  const extraMinutes = useMemo(
    () => (overageCentsPerMinute > 0 ? Math.floor(capCents / overageCentsPerMinute) : 0),
    [capCents, overageCentsPerMinute],
  )

  const onSave = () => {
    if (!prefs.data) return
    save.mutate(
      { spendCapCents: capCents, maxVideoMinutes: prefs.data.maxVideoMinutes },
      {
        // Volta a seguir o servidor: o rascunho já virou o valor salvo.
        onSuccess: () => {
          setDraft(null)
          toast.success("Teto de gasto atualizado.")
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar o teto."),
      },
    )
  }

  return (
    <div className="rounded-[14px] border border-border-soft px-6 py-6" style={{ background: "var(--surface)" }}>
      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div>
          <div className="eyebrow">Teto de gasto</div>
          <h2 className="font-display mt-2 mb-0" style={{ fontSize: 18, color: "var(--ink)" }}>
            Quanto você autoriza gastar além da cota
          </h2>
          <p className="text-[13.5px] text-ink-muted mt-2.5 leading-relaxed max-w-130">
            O teto não muda a cota do plano{quotaMinutes > 0 && <> — ela continua em {int(quotaMinutes)} minutos</>}.
            Ele autoriza o consumo além dela
            {overageCentsPerMinute > 0 && <> a {rate(overageCentsPerMinute)} por minuto</>}. Ao
            atingir o teto, a coleta de vídeos novos pausa e o histórico segue acessível.
          </p>
        </div>

        <div>
          <label className="eyebrow block mb-2" htmlFor="spend-cap">
            Teto mensal
          </label>
          <div
            className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-border-soft"
            style={{ background: "var(--surface)" }}
          >
            <span className="text-[13px] text-ink-muted">R$</span>
            <input
              id="spend-cap"
              type="number"
              min="0"
              step="10"
              value={capReais}
              disabled={prefs.isLoading || save.isPending}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-mono-zoe"
              style={{ color: "var(--ink)" }}
            />
            <span className="text-[12px] text-ink-muted-2">/mês</span>
          </div>

          <div className="text-[12.5px] text-ink-muted mt-2 min-h-[18px]">
            {capCents > 0 ? (
              extraMinutes > 0 ? (
                <>
                  <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                    {int(extraMinutes)}
                  </span>{" "}
                  minutos extras ao mês
                </>
              ) : (
                <>Equivalente em minutos aparece quando a assinatura estiver ativa.</>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" style={{ color: "var(--color-warn)" }} />
                Parar quando a cota acabar
              </span>
            )}
          </div>

          <button
            onClick={onSave}
            disabled={!dirty || save.isPending}
            className="w-full h-9 mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar teto
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Carregamento ──────────────────────────────────────────────────────────

function SkeletonScreen() {
  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)" }}>
      <div className="px-8 py-8 space-y-4 animate-pulse">
        <div className="h-9 w-64 rounded-md bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        <div className="h-40 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        <div className="h-56 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      </div>
    </div>
  )
}
