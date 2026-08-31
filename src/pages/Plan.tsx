import { useMemo, useState } from "react"
import { AlertCircle, Check, ExternalLink, Loader2, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { EmptyBlock } from "@/components/ui/empty-block"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/features/auth/context"
import {
  TRIAL_ALREADY_USED,
  useBillingPlans,
  useSubscription,
  useSubscriptionMutations,
  type BillingPlans,
  type PendingProjection,
  type PlanOption,
  type Subscription,
} from "@/lib/api/billing"

// Plano e faturamento (WS-F1). Nenhum valor em reais mora aqui: preço vem de
// /api/billing/plans, que o lê do Stripe. Cravar número nesta tela criaria uma
// terceira fonte de verdade — e é esta que fala com o cliente.

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  max: "Max",
  enterprise: "Enterprise",
}

const PLAN_PITCH: Record<string, string> = {
  starter: "Uma marca própria e um concorrente.",
  pro: "Operação de monitoramento com concorrência.",
  max: "Portfólio de marcas e agências.",
  enterprise: "Volume alto e contrato negociado.",
}

// A escada define o que é upgrade e o que é downgrade. Enterprise não entra:
// é negociado, e o caminho dele é vendas.
const LADDER = ["starter", "pro", "max"]

const FEATURE_LABELS: Record<string, string> = {
  sov: "Share of Voice",
  reports: "Relatórios",
}

const STATUS_LABELS: Record<string, string> = {
  Trialing: "em teste",
  Active: "ativa",
  PastDue: "pagamento pendente",
  Canceled: "cancelada",
}

const int = (v: number) => Math.round(v).toLocaleString("pt-BR")
const money = (cents: number, currency: string | null) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: (currency || "BRL").toUpperCase(),
  })
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

export default function PlanPage() {
  // O que foi PEDIDO ao provedor e ainda não virou projeção. Quem decide parar o
  // repique é o callback do react-query, fora do render — relógio em render é impuro.
  const [awaiting, setAwaiting] = useState<PendingProjection | null>(null)

  const plans = useBillingPlans(awaiting)
  const subscription = useSubscription(awaiting)

  if (plans.isLoading) return <SkeletonScreen />

  if (plans.error) {
    const message =
      plans.error instanceof ApiError ? plans.error.message : "Não foi possível carregar os planos."
    return (
      <div className="p-8">
        <EmptyBlock message={message} />
      </div>
    )
  }

  const data = plans.data!
  const sub = subscription.data ?? null

  // Chegou = a projeção já reflete o que foi pedido. Comparação pura sobre o dado
  // buscado, sem relógio.
  const arrived = awaiting != null && sub?.planSlug === awaiting.planSlug && !sub.readOnly

  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="eyebrow mb-2.5">Gestão · Assinatura</div>
        <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
          Plano e faturamento
        </h1>
        <div className="text-[14px] text-ink-muted mt-1.5 max-w-160">
          Cada plano dá uma cota de vídeo-minutos por mês. Trocas entram com proração na
          próxima fatura.
        </div>
      </section>

      <div className="px-8 py-7 space-y-4">
        {!data.billingEnabled && <ProviderOffBanner />}
        {awaiting && !arrived && <ProjectionBanner />}
        {sub && <CurrentSubscription sub={sub} />}

        <PlanGrid data={data} sub={sub} onRequested={setAwaiting} />

        <SharedSlotsNote />

        {data.currentPlanSlug && !sub?.readOnly && (
          <ExtraBrandCard data={data} onRequested={setAwaiting} />
        )}

        <BillingSection enabled={data.billingEnabled} hasSubscription={Boolean(sub)} />
      </div>
    </div>
  )
}

// ── Avisos de estado ──────────────────────────────────────────────────────

/**
 * A projeção não é síncrona: o endpoint responde quando o Stripe aceita, e a linha só
 * existe aqui quando o webhook chega. Sem dizer isso, a tela parecia simplesmente não
 * ter feito nada — e o cliente clicava de novo.
 */
function ProjectionBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border px-4 py-3.5"
      style={{ background: "var(--color-teal-50)", borderColor: "rgba(0,167,153,.28)" }}
    >
      <Loader2
        className="w-[17px] h-[17px] shrink-0 mt-0.5 animate-spin"
        style={{ color: "var(--color-teal-500)" }}
      />
      <div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--color-teal-500)" }}>
          Aguardando confirmação do provedor
        </div>
        <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
          O pedido foi aceito e o plano aparece aqui assim que o provedor confirmar,
          normalmente em alguns segundos. Se demorar mais que isso, recarregue a página.
        </div>
      </div>
    </div>
  )
}

function ProviderOffBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border px-4 py-3.5"
      style={{ background: "#FFFBEB", borderColor: "rgba(217,119,6,.32)" }}
    >
      <AlertCircle className="w-[17px] h-[17px] shrink-0 mt-0.5" style={{ color: "var(--color-warn)" }} />
      <div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--color-warn)" }}>
          Cobrança não configurada neste ambiente
        </div>
        <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Os planos abaixo mostram o que cada tier entrega, mas sem preço e sem troca — não
          há provedor de pagamento ligado aqui.
        </div>
      </div>
    </div>
  )
}

function CurrentSubscription({ sub }: { sub: Subscription }) {
  const degraded = sub.readOnly
  const tone = degraded
    ? { color: "var(--color-neg)", bg: "#FEF2F2", border: "rgba(220,38,38,.32)" }
    : { color: "var(--color-teal-500)", bg: "var(--color-teal-50)", border: "rgba(0,167,153,.28)" }

  return (
    <div className="rounded-[14px] border border-border-soft px-6 py-5" style={{ background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="eyebrow">Assinatura atual</div>
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className="font-display" style={{ fontSize: 26, color: "var(--ink)" }}>
              {PLAN_NAMES[sub.planSlug] ?? sub.planSlug}
            </span>
            <span
              className="text-[11.5px] font-semibold rounded-full px-2 py-0.5"
              style={{ background: tone.bg, color: tone.color }}
            >
              {STATUS_LABELS[sub.status] ?? sub.status}
            </span>
          </div>
          <div className="text-[12.5px] text-ink-muted mt-2">
            Período de {day(sub.currentPeriodStart)} a {day(sub.currentPeriodEnd)}
            {sub.extraBrandSlots > 0 && <> · {sub.extraBrandSlots} marca(s) extra</>}
          </div>
          {sub.status === "Trialing" && (
            <div className="text-[12.5px] text-ink-muted mt-1 max-w-140 leading-relaxed">
              {/* A cota do teste é menor que a do tier. Sem dizer isso aqui, o card do
                  plano logo abaixo anuncia outro número e a tela se contradiz. */}
              Cota do teste:{" "}
              <strong style={{ color: "var(--ink)" }}>{int(sub.quotaMinutes)} minutos</strong> — a
              cota cheia do plano vale quando a assinatura for paga.
              {sub.trialEndsAt && (
                <>
                  {" "}
                  O teste termina em {day(sub.trialEndsAt)}; sem método de pagamento até lá, a
                  assinatura é cancelada e o acesso fica somente leitura.
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {degraded && (
        <div className="flex items-start gap-2.5 mt-4 pt-4 border-t border-border-soft text-[12.5px] text-ink-muted leading-relaxed">
          <ShieldCheck className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: "var(--color-teal-500)" }} />
          <span>
            Acesso somente leitura. <strong>Nenhum dado foi apagado</strong> — marcas,
            análises, histórico e relatórios continuam de pé, e voltam a receber coleta assim
            que a assinatura for reativada.
          </span>
        </div>
      )}
    </div>
  )
}

function SharedSlotsNote() {
  return (
    <div className="flex items-start gap-2.5 text-[12.5px] text-ink-muted leading-relaxed">
      <AlertCircle className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: "var(--color-teal-500)" }} />
      <span>
        Marcas incluem concorrentes. Quem monitora 3 marcas próprias e 4 concorrentes usa 7
        dos slots do plano.
      </span>
    </div>
  )
}

// ── Planos ────────────────────────────────────────────────────────────────

function PlanGrid({
  data,
  sub,
  onRequested,
}: {
  data: BillingPlans
  sub: Subscription | null
  onRequested: (r: PendingProjection) => void
}) {
  const { start, change } = useSubscriptionMutations()
  const pending = start.isPending || change.isPending
  const [busySlug, setBusySlug] = useState<string | null>(null)

  const [trialUsedFor, setTrialUsedFor] = useState<PlanOption | null>(null)
  // Erro que precisa aparecer DENTRO do diálogo: toast atrás de um overlay é um botão
  // que não faz nada do ponto de vista de quem clicou.
  const [dialogError, setDialogError] = useState<string | null>(null)

  // Assinatura cancelada EXISTE mas não é alterável: o provedor recusa update nela, e
  // o caminho certo é abrir uma nova. Decidir por "tem linha" em vez de "está ativa"
  // mandava a reativação para o endpoint de troca e devolvia erro cru do provedor.
  const reativando = Boolean(sub?.readOnly)

  const act = (plan: PlanOption, withTrial = true) => {
    setBusySlug(plan.slug)
    const trocando = Boolean(data.currentPlanSlug) && !reativando
    const input = trocando
      ? { planSlug: plan.slug, extraBrandSlots: data.currentExtraBrandSlots }
      : { planSlug: plan.slug, extraBrandSlots: data.currentExtraBrandSlots, withTrial }
    const mutation = trocando ? change : start
    const verb = trocando ? "Troca" : "Assinatura"

    mutation.mutate(input, {
      // A resposta é o Stripe confirmando o pedido; quem escreve a projeção é o
      // webhook. Por isso a mensagem fala em "solicitada", não em "concluída".
      onSuccess: () => {
        setTrialUsedFor(null)
        setDialogError(null)
        onRequested({ planSlug: plan.slug, since: Date.now() })
        toast.success(`${verb} solicitada. Aguardando a confirmação do provedor.`)
      },
      onError: (e) => {
        // O trial já usado não é falha: é uma escolha que o cliente ainda pode fazer,
        // então vira pergunta em vez de toast vermelho e beco sem saída.
        if (e instanceof ApiError && e.problem?.code === TRIAL_ALREADY_USED) {
          setDialogError(null)
          setTrialUsedFor(plan)
          return
        }

        const message =
          e instanceof ApiError ? e.message : `Não foi possível concluir a ${verb.toLowerCase()}.`

        // Com o diálogo aberto o toast fica atrás do overlay: o erro tem que ir para
        // dentro dele, senão o botão parece simplesmente não responder.
        if (trialUsedFor) setDialogError(message)
        else toast.error(message)
      },
      onSettled: () => setBusySlug(null),
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4 sm:grid-cols-2">
      {data.plans.map((plan) => (
        <PlanCard
          key={plan.slug}
          plan={plan}
          data={data}
          sub={sub}
          reativando={reativando}
          busy={busySlug === plan.slug}
          disabled={pending || !data.billingEnabled}
          onAct={() => act(plan)}
        />
      ))}

      {trialUsedFor && (
        <TrialUsedDialog
          plan={trialUsedFor}
          currency={data.currency}
          pending={pending}
          error={dialogError}
          onClose={() => {
            setTrialUsedFor(null)
            setDialogError(null)
          }}
          onConfirm={() => act(trialUsedFor, false)}
        />
      )}
    </div>
  )
}

/**
 * O período de teste é um por pessoa (D8). Quem já usou não fica sem caminho: a
 * alternativa é assinar pagando desde já, e ela é oferecida aqui em vez de o cliente
 * receber um erro e ter que adivinhar o que fazer.
 */
function TrialUsedDialog({
  plan,
  currency,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  plan: PlanOption
  currency: string | null
  pending: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-[480px] rounded-[14px] border border-border-soft px-6 py-6 shadow-xl"
        style={{ background: "var(--surface)" }}
      >
        <div className="eyebrow">Período de teste</div>
        <h2 className="font-display mt-2 mb-0" style={{ fontSize: 20, color: "var(--ink)" }}>
          Você já usou seu teste gratuito
        </h2>
        <p className="text-[13.5px] text-ink-muted mt-3 leading-relaxed">
          O período de teste é um por pessoa, mesmo em workspaces diferentes. Você ainda pode
          assinar o {PLAN_NAMES[plan.slug] ?? plan.slug}
          {plan.priceCents != null && <> por {money(plan.priceCents, currency)}/mês</>}, com
          cobrança desde já.
        </p>

        {error && (
          <div
            className="flex items-start gap-3 rounded-[12px] border px-4 py-3 mt-4"
            style={{ background: "#FEF2F2", borderColor: "rgba(220,38,38,.32)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-neg)" }} />
            <span className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {error}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-ink-muted hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Assinar sem teste
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  data,
  reativando,
  busy,
  disabled,
  onAct,
}: {
  plan: PlanOption
  data: BillingPlans
  sub: Subscription | null
  reativando: boolean
  busy: boolean
  disabled: boolean
  onAct: () => void
}) {
  const isEnterprise = plan.slug === "enterprise"
  const current = plan.isCurrent

  const action = useMemo(() => {
    if (isEnterprise) return { label: "Falar com vendas", kind: "sales" as const }

    // Cancelada: todo card volta a ser assinável, inclusive o do plano anterior.
    // Desabilitar aquele card prenderia o cliente fora do plano que ele já tinha.
    if (reativando)
      return { label: current ? "Reativar" : "Assinar", kind: "primary" as const }

    if (current) return { label: "Plano atual", kind: "disabled" as const }
    if (!data.currentPlanSlug) return { label: "Assinar", kind: "primary" as const }

    const from = LADDER.indexOf(data.currentPlanSlug)
    const to = LADDER.indexOf(plan.slug)
    // Plano atual fora da escada (Enterprise): qualquer troca é "mudar", não descer.
    if (from < 0 || to < 0) return { label: "Mudar para este", kind: "primary" as const }
    return to > from
      ? { label: "Fazer upgrade", kind: "primary" as const }
      : { label: "Fazer downgrade", kind: "ghost" as const }
  }, [current, isEnterprise, reativando, data.currentPlanSlug, plan.slug])

  return (
    <div
      className="rounded-[14px] border px-5 py-5 flex flex-col"
      style={{
        background: "var(--surface)",
        borderColor: current && !reativando ? "var(--color-teal-500)" : "var(--border-soft)",
      }}
    >
      {current && (
        <span
          className="self-start text-[10px] font-semibold rounded-full px-2 py-0.5 mb-2"
          style={
            reativando
              ? { background: "#F3F4F6", color: "#6B7280" }
              : { background: "var(--color-teal-50)", color: "var(--color-teal-500)" }
          }
        >
          {reativando ? "Plano anterior" : "Plano atual"}
        </span>
      )}

      <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
        {PLAN_NAMES[plan.slug] ?? plan.slug}
      </div>
      <div className="text-[12.5px] text-ink-muted mt-1 min-h-[34px] leading-relaxed">
        {PLAN_PITCH[plan.slug] ?? ""}
      </div>

      <div className="font-display mt-3 mb-4" style={{ fontSize: 24, color: "var(--ink)" }}>
        {plan.priceCents != null ? (
          <>
            {money(plan.priceCents, data.currency)}
            <span className="text-[13px] text-ink-muted">/mês</span>
          </>
        ) : (
          // Nunca "R$ 0,00": Enterprise é negociado, e ambiente sem Stripe não tem preço.
          <span style={{ fontSize: 18 }} className="text-ink-muted">
            Sob consulta
          </span>
        )}
      </div>

      <dl className="text-[12.5px] space-y-1.5 mb-4">
        <Row label="Vídeo-minutos" value={plan.quotaMinutes > 0 ? int(plan.quotaMinutes) : "Pay-as-you-go"} />
        <Row label="Marcas" value={plan.brandSlots > 0 ? int(plan.brandSlots) : "Ilimitado"} />
        {["sov", "reports"].map((code) => (
          <Row
            key={code}
            label={FEATURE_LABELS[code]}
            value={
              plan.tierFeatures.includes(code) ? (
                <Check className="w-3.5 h-3.5 inline" style={{ color: "var(--color-pos)" }} strokeWidth={2.6} />
              ) : (
                <span className="text-ink-muted-2">—</span>
              )
            }
          />
        ))}
      </dl>

      <div className="mt-auto">
        {action.kind === "sales" ? (
          <a
            href="mailto:comercial@zoe.com.br?subject=Plano%20Enterprise"
            className="w-full h-9 inline-flex items-center justify-center rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={onAct}
            disabled={action.kind === "disabled" || disabled || busy}
            className={`w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 ${
              action.kind === "primary"
                ? "text-white"
                : "border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
            }`}
            style={action.kind === "primary" ? { background: "var(--color-teal-500)" } : undefined}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {action.label}
          </button>
        )}
        {reativando && (
          <div className="text-[11.5px] text-ink-muted mt-2 text-center">Reativa o acesso</div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono-zoe" style={{ color: "var(--ink)" }}>
        {value}
      </dd>
    </div>
  )
}

// ── Marca extra ───────────────────────────────────────────────────────────

function ExtraBrandCard({
  data,
  onRequested,
}: {
  data: BillingPlans
  onRequested: (r: PendingProjection) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const current = data.plans.find((p) => p.isCurrent)

  // Só o Pro vende. Nos outros o card nem aparece: no Starter o limite é o gatilho
  // de upgrade, e Max/Enterprise já são ilimitados.
  if (!current?.sellsExtraBrandSlots) return null

  const price = data.extraBrandSlotPriceCents

  return (
    <>
      <div
        className="rounded-[14px] border border-border-soft px-6 py-5 flex items-center gap-5 flex-wrap"
        style={{ background: "var(--surface)" }}
      >
        <Sparkles className="w-5 h-5 shrink-0" style={{ color: "var(--color-teal-500)" }} />
        <div className="flex-1 min-w-[280px]">
          <div className="text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>
            Marca extra
          </div>
          <div className="text-[13px] text-ink-muted mt-1 leading-relaxed max-w-140">
            Um slot de marca a mais no seu plano, <strong>sem alterar a cota de minutos</strong>.
            Cobrado com proração na próxima fatura.
            {data.currentExtraBrandSlots > 0 && (
              <> Você já tem {data.currentExtraBrandSlots} contratada(s).</>
            )}
          </div>
        </div>
        {price != null && (
          <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
            {money(price, data.currency)}
            <span className="text-[13px] text-ink-muted">/mês</span>
          </div>
        )}
        <button
          onClick={() => setConfirming(true)}
          disabled={!data.billingEnabled}
          className="h-9 px-4 inline-flex items-center justify-center rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--color-teal-500)" }}
        >
          Adicionar marca
        </button>
      </div>

      {confirming && (
        <ExtraBrandDialog
          data={data}
          onRequested={onRequested}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  )
}

/**
 * O aceite explícito existe porque a confusão é previsível e cara: "mais uma marca"
 * soa como "mais capacidade", e marca extra não traz um minuto sequer. Quem está com
 * a cota apertada resolve com upgrade, não com slot.
 */
function ExtraBrandDialog({
  data,
  onRequested,
  onClose,
}: {
  data: BillingPlans
  onRequested: (r: PendingProjection) => void
  onClose: () => void
}) {
  const [ack, setAck] = useState(false)
  const { change } = useSubscriptionMutations()
  const current = data.plans.find((p) => p.isCurrent)!

  const confirm = () => {
    change.mutate(
      { planSlug: current.slug, extraBrandSlots: data.currentExtraBrandSlots + 1 },
      {
        onSuccess: () => {
          onRequested({ planSlug: current.slug, since: Date.now() })
          toast.success("Marca extra solicitada. Aguardando a confirmação do provedor.")
          onClose()
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Não foi possível adicionar a marca."),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-[520px] rounded-[14px] border border-border-soft px-6 py-6 shadow-xl"
        style={{ background: "var(--surface)" }}
      >
        <div className="eyebrow">Adicionar marca extra</div>
        <h2 className="font-display mt-2 mb-0" style={{ fontSize: 20, color: "var(--ink)" }}>
          Um slot de marca, sem minutos
        </h2>
        <p className="text-[13.5px] text-ink-muted mt-3 leading-relaxed">
          Você passa de {int(current.brandSlots + data.currentExtraBrandSlots)} para{" "}
          {int(current.brandSlots + data.currentExtraBrandSlots + 1)} marcas monitoradas. A cota
          continua em {int(current.quotaMinutes)} vídeo-minutos: a nova marca vai consumir da
          mesma cota que as atuais.
        </p>

        <div
          className="flex items-start gap-3 rounded-[12px] border px-4 py-3 mt-4"
          style={{ background: "#FFFBEB", borderColor: "rgba(217,119,6,.32)" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warn)" }} />
          <span className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            Marca extra <strong>não traz minutos</strong>. Se a cota já está apertada, o upgrade
            tende a resolver melhor.
          </span>
        </div>

        <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="w-4 h-4 mt-0.5"
            style={{ accentColor: "var(--color-teal-500)" }}
          />
          <span className="text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
            Entendi que a cota de minutos não muda com esta compra.
          </span>
        </label>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-ink-muted hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!ack || change.isPending}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {change.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Adicionar marca
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Faturamento ───────────────────────────────────────────────────────────

/**
 * Método de pagamento, faturas e nota fiscal vivem no portal da Stripe. Reconstruir
 * isso aqui significaria manter uma segunda cópia de dado financeiro — e o portal já
 * resolve PCI, comprovantes e histórico.
 */
function BillingSection({ enabled, hasSubscription }: { enabled: boolean; hasSubscription: boolean }) {
  const { portal } = useSubscriptionMutations()
  const { activeTenantId } = useAuth()

  const open = () => {
    portal.mutate(window.location.href, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : "Não foi possível abrir o portal."),
    })
  }

  const rows = [
    { label: "Método de pagamento", hint: "Cartão usado nas cobranças recorrentes." },
    { label: "Histórico de faturas", hint: "Faturas pagas e em aberto, com comprovante." },
    { label: "Dados de cobrança", hint: "Razão social, endereço e documento fiscal." },
  ]

  const disabled = !enabled || !hasSubscription || !activeTenantId || portal.isPending

  return (
    <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-6 pt-5 pb-3">
        <div className="eyebrow">Faturamento</div>
        <div className="text-[13px] text-ink-muted mt-2 max-w-165 leading-relaxed">
          Pagamento e notas ficam no portal da Stripe. Os três itens abaixo abrem lá.
        </div>
      </div>

      {rows.map((r, i) => (
        <button
          key={r.label}
          onClick={open}
          disabled={disabled}
          className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] disabled:opacity-50 disabled:hover:bg-transparent ${
            i === 0 ? "border-t border-border-soft" : "border-t border-border-soft"
          }`}
        >
          <div className="flex-1">
            <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              {r.label}
            </div>
            <div className="text-[12.5px] text-ink-muted mt-0.5">{r.hint}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted shrink-0">
            {portal.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            Abrir na Stripe
          </span>
        </button>
      ))}

      {!hasSubscription && (
        <div className="px-6 py-3 text-[12px] text-ink-muted border-t border-border-soft">
          O portal fica disponível depois da primeira assinatura.
        </div>
      )}
    </div>
  )
}

function SkeletonScreen() {
  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)" }}>
      <div className="px-8 py-8 space-y-4 animate-pulse">
        <div className="h-9 w-72 rounded-md bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        <div className="h-24 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        <div className="grid gap-4 lg:grid-cols-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          ))}
        </div>
      </div>
    </div>
  )
}
