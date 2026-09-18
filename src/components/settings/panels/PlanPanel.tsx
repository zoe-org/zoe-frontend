import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { AlertCircle, CalendarClock, ExternalLink, Loader2, RotateCcw, ShieldCheck, Sparkles } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { EmptyBlock } from "@/components/ui/empty-block"
import { TabPill } from "@/components/ui/tab-pill"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/features/auth/context"
import {
  newAttemptKey,
  PAYMENT_METHOD_REQUIRED,
  projectionArrived,
  TRIAL_ALREADY_USED,
  useBillingPlans,
  useChangePreview,
  usePaymentMethod,
  useSubscription,
  useProjectionWatch,
  useSubscriptionMutations,
  type BillingPlans,
  type PendingProjection,
  type PlanSelection,
  type ProjectionPhase,
  type Subscription,
} from "@/lib/api/billing"
import {
  describeSelection,
  PLAN_TAB_PARAM,
  qualifiesForBundle,
  recurringCents,
  selectionFromSubscription,
} from "@/lib/plans"
import { ChangePlanDialog } from "./plan/ChangePlanDialog"
import { BundleGrid, IntelligenceGrid, OperationsGrid, type CardContext } from "./plan/PlanCards"
import { day, int, money, shortDay } from "./plan/format"

// Plano e faturamento (WS-F1). Nenhum valor em reais mora aqui: preço vem de
// /api/billing/plans, que o lê do Stripe. Cravar número nesta tela criaria uma
// terceira fonte de verdade — e é esta que fala com o cliente.
//
// Painel, não página: quem dá título, descrição e rolagem é o diálogo de
// configurações. Por isso as larguras respondem ao CONTÊINER (@container), não à
// janela — dentro do modal a viewport diz 1440px e a coluna tem 800.

const STATUS_LABELS: Record<string, string> = {
  Trialing: "em teste",
  Active: "ativa",
  PastDue: "pagamento pendente",
  Canceled: "cancelada",
}

type ModuleTab = "intelligence" | "operations" | "pacote"

export function PlanPanel() {
  // O que foi PEDIDO ao provedor e ainda não virou projeção. Quem decide parar o
  // repique é o callback do react-query, fora do render — relógio em render é impuro.
  const [awaiting, setAwaiting] = useState<PendingProjection | null>(null)
  const [changing, setChanging] = useState<PlanSelection | null>(null)
  const [tab, setTab] = useModuleTab()

  const plans = useBillingPlans(awaiting)
  const subscription = useSubscription(awaiting)
  const payment = usePaymentMethod()
  const voltandoDoCheckout = useCheckoutReturn()

  const sub = subscription.data ?? null
  const arrived = projectionArrived(awaiting, sub)
  const espera = useProjectionWatch(awaiting, arrived)
  const start = useStartFlow(plans.data ?? null, setAwaiting)

  if (plans.isLoading) return <SkeletonScreen />

  if (plans.error) {
    const message =
      plans.error instanceof ApiError ? plans.error.message : "Não foi possível carregar os planos."
    return <EmptyBlock message={message} />
  }

  const data = plans.data!
  const reativando = Boolean(sub?.readOnly)
  const pending = start.pending

  const ctx: CardContext = {
    data,
    sub,
    reativando,
    disabled: pending || !data.billingEnabled,
    busyKey: start.busyKey,
    onStart: start.begin,
    onChange: setChanging,
  }

  const temOsDois = Boolean(sub && !reativando && sub.planSlug && sub.operationsPlanSlug)

  return (
    <div className="@container">
      <div className="space-y-4">
        {!data.billingEnabled && <ProviderOffBanner />}
        {voltandoDoCheckout && !sub && <ProjectionBanner phase="waiting" />}
        {awaiting && !arrived && <ProjectionBanner phase={espera.phase} onRetry={espera.retry} />}
        {sub && (
          <CurrentSubscription
            sub={sub}
            data={data}
            onKeep={() => setChanging(selectionFromSubscription(sub))}
          />
        )}

        <div className="flex items-center gap-1 flex-wrap">
          <TabPill active={tab === "intelligence"} onClick={() => setTab("intelligence")} label="Intelligence" />
          <TabPill active={tab === "operations"} onClick={() => setTab("operations")} label="Operations" />
          <TabPill active={tab === "pacote"} onClick={() => setTab("pacote")} label="Full Platform" />
        </div>

        {tab === "intelligence" && (
          <>
            <IntelligenceGrid ctx={ctx} />
            <SharedSlotsNote />
            {data.currentPlanSlug && !reativando && (
              <ExtraBrandCard data={data} sub={sub} onRequested={setAwaiting} />
            )}
            {temOsDois && (
              <RemoveModuleLink
                label="Tirar o Intelligence do plano"
                onClick={() => setChanging({ planSlug: null, operationsPlanSlug: sub!.operationsPlanSlug, extraBrandSlots: 0 })}
              />
            )}
          </>
        )}

        {tab === "operations" && (
          <>
            <OperationsGrid ctx={ctx} />
            {temOsDois && (
              <RemoveModuleLink
                label="Tirar o Operations do plano"
                onClick={() => setChanging({ ...selectionFromSubscription(sub!), operationsPlanSlug: null })}
              />
            )}
          </>
        )}

        {tab === "pacote" && <BundleGrid ctx={ctx} />}

        <BillingSection
          enabled={data.billingEnabled}
          hasSubscription={Boolean(sub)}
          hasCard={payment.data?.hasPaymentMethod ?? null}
        />
      </div>

      {changing && sub && !reativando && (
        <ChangePlanDialog
          target={changing}
          data={data}
          sub={sub}
          onClose={() => setChanging(null)}
          onRequested={setAwaiting}
          onRetarget={setChanging}
        />
      )}

      {start.trialUsedFor && (
        <TrialUsedDialog
          selection={start.trialUsedFor}
          data={data}
          pending={pending}
          error={start.dialogError}
          onClose={start.dismissTrialDialog}
          onConfirm={() => start.checkout(start.trialUsedFor!)}
        />
      )}
    </div>
  )
}

/** Aba vinda da URL; sem ela, a do módulo que o workspace usa. */
function useModuleTab(): [ModuleTab, (t: ModuleTab) => void] {
  const [params, setParams] = useSearchParams()
  const { hasFeature } = useAuth()
  const raw = params.get(PLAN_TAB_PARAM)
  const fallback: ModuleTab = hasFeature("intelligence") || !hasFeature("operations") ? "intelligence" : "operations"
  const tab: ModuleTab = raw === "intelligence" || raw === "operations" || raw === "pacote" ? raw : fallback

  const setTab = (t: ModuleTab) => {
    const next = new URLSearchParams(params)
    next.set(PLAN_TAB_PARAM, t)
    setParams(next, { replace: true })
  }

  return [tab, setTab]
}

/**
 * Assinatura nova (ou reativação). Só o trial nasce direto — ele é sem cartão; plano
 * pago vai para a tela de pagamento do provedor.
 */
function useStartFlow(data: BillingPlans | null, onRequested: (r: PendingProjection) => void) {
  const { start, checkout } = useSubscriptionMutations()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [trialUsedFor, setTrialUsedFor] = useState<PlanSelection | null>(null)
  // Erro com o diálogo aberto vai para dentro dele: é onde o olho de quem clicou está.
  const [dialogError, setDialogError] = useState<string | null>(null)

  const irParaCheckout = (selection: PlanSelection, key?: string) => {
    setBusyKey(key ?? "checkout")
    checkout.mutate(
      { ...selection, idempotencyKey: newAttemptKey() },
      {
        onSuccess: ({ url }) => window.location.assign(url),
        onError: (e) => {
          notifyError(e, "Não foi possível abrir a tela de pagamento.", { terminal: true })
          setBusyKey(null)
        },
      },
    )
  }

  const begin = (selection: PlanSelection, key: string) => {
    if (!data) return
    // Assinatura cancelada: o provedor não reabre a antiga, então vai direto ao pagamento.
    if (data.currentPlanSlug || data.currentOperationsPlanSlug) return irParaCheckout(selection, key)

    setBusyKey(key)
    start.mutate(
      { ...selection, withTrial: true, idempotencyKey: newAttemptKey() },
      {
        // A resposta é o Stripe confirmando o pedido; quem escreve a projeção é o
        // webhook. Por isso a mensagem fala em "solicitada", não em "concluída".
        onSuccess: () => {
          onRequested({ ...selection, mode: "immediate", since: Date.now() })
          notifySuccess("Assinatura solicitada. Aguardando a confirmação do provedor.")
        },
        onError: (e) => {
          // O trial já usado não é falha: é uma escolha que o cliente ainda pode fazer,
          // então vira pergunta em vez de toast vermelho e beco sem saída.
          const code = e instanceof ApiError ? e.problem?.code : undefined
          if (code === TRIAL_ALREADY_USED) {
            setDialogError(null)
            setTrialUsedFor(selection)
            return
          }
          // Falta de cartão deixou de ser erro: o checkout coleta o cartão junto com o pagamento.
          if (code === PAYMENT_METHOD_REQUIRED) return irParaCheckout(selection, key)
          notifyError(e, "Não foi possível concluir a assinatura.", { terminal: true })
        },
        onSettled: () => setBusyKey(null),
      },
    )
  }

  return {
    begin,
    checkout: (selection: PlanSelection) => {
      setDialogError(null)
      irParaCheckout(selection)
    },
    busyKey,
    pending: start.isPending || checkout.isPending,
    trialUsedFor,
    dialogError,
    dismissTrialDialog: () => {
      setTrialUsedFor(null)
      setDialogError(null)
    },
  }
}

/**
 * Volta do pagamento: puxa a assinatura do provedor em vez de esperar o webhook.
 * O webhook segue sendo o caminho normal — isto cobre o caso em que ele não chega,
 * que é quando o cliente já pagou e não pode resolver sozinho.
 */
function useCheckoutReturn(): boolean {
  const [params, setParams] = useSearchParams()
  const { sync } = useSubscriptionMutations()
  const disparado = useRef(false)
  // `success` = voltou do pagamento; `portal` = voltou do portal, onde cancelar e
  // trocar de cartão acontecem. Os dois mudam a assinatura sem passar por nós.
  const outcome = params.get("checkout")
  const precisaSincronizar = outcome === "success" || outcome === "portal"

  useEffect(() => {
    if (!precisaSincronizar || disparado.current) return
    disparado.current = true

    sync.mutate(undefined, {
      onSettled: () => {
        const limpo = new URLSearchParams(params)
        limpo.delete("checkout")
        setParams(limpo, { replace: true })
      },
    })
    // `sync` e `params` mudam a cada render; o ref é o que garante disparo único.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaSincronizar])

  return precisaSincronizar || sync.isPending
}

// ── Avisos de estado ──────────────────────────────────────────────────────

/**
 * A projeção não é síncrona: o endpoint responde quando o Stripe aceita, e a linha só
 * existe aqui quando o webhook chega. Sem dizer isso, a tela parecia simplesmente não
 * ter feito nada — e o cliente clicava de novo.
 *
 * <p>As três fases existem porque a espera precisa TERMINAR. Enquanto ela era um
 * spinner só, webhook que não chega virava tela girando para sempre — e o cliente
 * não tinha como distinguir isso de um botão quebrado.</p>
 */
function ProjectionBanner({
  phase,
  onRetry,
}: {
  phase: ProjectionPhase
  onRetry?: () => void
}) {
  if (phase === "stale") {
    return (
      <div
        className="flex items-start gap-3 rounded-[14px] border px-4 py-3.5"
        style={{ background: "#FFFBEB", borderColor: "rgba(217,119,6,.32)" }}
      >
        <AlertCircle className="w-[17px] h-[17px] shrink-0 mt-0.5" style={{ color: "var(--color-warn)" }} />
        <div className="flex-1">
          <div className="text-[14px] font-semibold" style={{ color: "var(--color-warn)" }}>
            O provedor aceitou, mas a mudança ainda não apareceu aqui
          </div>
          <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
            <strong>Nada foi cobrado a mais</strong> e o pedido não se perdeu — o que faltou
            foi a confirmação chegar até nós. Tente conferir de novo; se continuar assim,
            a fatura e o plano vigente estão corretos no portal de cobrança.
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Conferir de novo
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border px-4 py-3.5"
      style={{ background: "var(--teal-bg)", borderColor: "rgba(0,167,153,.28)" }}
    >
      <Loader2
        className="w-[17px] h-[17px] shrink-0 mt-0.5 animate-spin"
        style={{ color: "var(--color-teal-500)" }}
      />
      <div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--color-teal-500)" }}>
          {phase === "syncing"
            ? "Conferindo direto com o provedor"
            : "Aguardando confirmação do provedor"}
        </div>
        <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {phase === "syncing"
            ? "A confirmação automática demorou, então fomos buscar a assinatura na fonte. Isso leva alguns segundos."
            : "O pedido foi aceito e o plano aparece aqui assim que o provedor confirmar, normalmente em alguns segundos."}
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

/**
 * Abre o portal do provedor. Mora aqui porque tem dois chamadores: o bloco de
 * faturamento e o aviso de cancelamento agendado, que é onde o cliente vai querer
 * voltar atrás.
 */
function usePortal() {
  const { portal } = useSubscriptionMutations()

  // Volta para a própria seção de Plano, não para a rota antiga: o `?checkout=portal`
  // é o gatilho da sincronização no retorno, e ele precisa sobreviver à navegação.
  const open = () =>
    portal.mutate(`${window.location.origin}/dashboard?settings=plano&checkout=portal`, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (e) =>
        notifyError(e, "Não foi possível abrir o portal."),
    })

  return { open, pending: portal.isPending }
}

function CurrentSubscription({
  sub,
  data,
  onKeep,
}: {
  sub: Subscription
  data: BillingPlans
  onKeep: () => void
}) {
  const degraded = sub.readOnly
  const portal = usePortal()

  // Cancelar no portal não mexe no status: sem este sinal a tela ficava idêntica à de
  // antes do pedido, e era isso que fazia o cliente achar que nada tinha acontecido.
  const scheduled = !degraded && sub.cancelAt != null
  const troca = !degraded ? sub.scheduledChange : null
  const pacote = !degraded && qualifiesForBundle(sub, data) && data.bundle.percentOff != null

  const tone = degraded
    ? { color: "var(--color-neg)", bg: "#FEF2F2" }
    : { color: "var(--color-teal-500)", bg: "var(--teal-bg)" }

  return (
    <div className="rounded-[14px] border border-border-soft px-6 py-5" style={{ background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="eyebrow">Assinatura atual</div>
          <div className="flex items-baseline gap-2.5 mt-2 flex-wrap">
            <span className="font-display" style={{ fontSize: 26, color: "var(--ink)" }}>
              {describeSelection(sub)}
            </span>
            <span
              className="text-[11.5px] font-semibold rounded-full px-2 py-0.5"
              style={{ background: tone.bg, color: tone.color }}
            >
              {STATUS_LABELS[sub.status] ?? sub.status}
            </span>
            {pacote && (
              <span
                className="text-[11.5px] font-semibold rounded-full px-2 py-0.5 inline-flex items-center gap-1"
                style={{ background: "var(--teal-bg)", color: "var(--color-teal-500)" }}
              >
                <Sparkles className="w-3 h-3" />
                Full Platform · −{data.bundle.percentOff}%
              </span>
            )}
            {/* Chip separado, e não texto no lugar do status: a assinatura segue "ativa"
                ou "em teste" até a data, e trocar um pelo outro perderia qual das duas. */}
            {scheduled && (
              <span
                className="text-[11.5px] font-semibold rounded-full px-2 py-0.5"
                style={{ background: "#FFFBEB", color: "var(--color-warn)" }}
              >
                encerra em {shortDay(sub.cancelAt!)}
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-ink-muted mt-2">
            Período de {day(sub.currentPeriodStart)} a {day(sub.currentPeriodEnd)}
            {sub.extraBrandSlots > 0 && <> · {sub.extraBrandSlots} marca(s) extra</>}
          </div>
          {sub.status === "Trialing" && (
            <div className="text-[12.5px] text-ink-muted mt-1 max-w-140 leading-relaxed">
              {/* A cota do teste é menor que a do tier. Sem dizer isso aqui, o card do
                  plano logo abaixo anuncia outro número e a tela se contradiz. */}
              {sub.planSlug && (
                <>
                  Cota do teste:{" "}
                  <strong style={{ color: "var(--ink)" }}>{int(sub.quotaMinutes)} minutos</strong> — a
                  cota cheia do plano vale quando a assinatura for paga.
                </>
              )}
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

      {troca && (
        <div className="mt-4 pt-4 border-t border-border-soft">
          <div className="flex items-start gap-2.5">
            <CalendarClock className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: "var(--color-teal-500)" }} />
            <div className="text-[12.5px] text-ink-muted leading-relaxed max-w-165">
              <strong style={{ color: "var(--ink)" }}>
                Troca agendada para {day(troca.effectiveAt)}: passa a ser {describeSelection(troca)}.
              </strong>{" "}
              Até lá nada muda — cota, marcas e módulos seguem como estão.
            </div>
          </div>
          <button
            onClick={onKeep}
            className="mt-3 ml-[25px] h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Manter {describeSelection(sub)}
          </button>
        </div>
      )}

      {scheduled && (
        <div className="mt-4 pt-4 border-t border-border-soft">
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="w-[15px] h-[15px] shrink-0 mt-0.5"
              style={{ color: "var(--color-warn)" }}
            />
            <div className="text-[12.5px] text-ink-muted leading-relaxed max-w-165">
              <strong style={{ color: "var(--ink)" }}>
                Cancelamento agendado para {day(sub.cancelAt!)}.
              </strong>{" "}
              Até lá nada muda: cota, marcas e coleta seguem como estão. Nesse dia a
              assinatura encerra e o workspace fica somente leitura —{" "}
              <strong>nenhum dado é apagado</strong>.
              {/* Trocar de plano não desmarca a saída: o Stripe mantém o agendamento sobre
                  a assinatura nova, e quem só faz upgrade sairia mesmo assim. */}{" "}
              Fazer upgrade <strong>não cancela o agendamento</strong>, e downgrade só pode ser
              agendado depois de retomar a assinatura no portal.
            </div>
          </div>
          <button
            onClick={portal.open}
            disabled={portal.pending}
            className="mt-3 ml-[25px] h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {portal.pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            Retomar assinatura no portal
          </button>
        </div>
      )}

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

      {!degraded && !troca && sub.status !== "Trialing" && (
        <div className="mt-4 pt-4 border-t border-border-soft text-[12.5px] text-ink-muted leading-relaxed max-w-165">
          Upgrade vale na hora, com a diferença proporcional cobrada no ato. Downgrade fica
          agendado para o fim do período já pago, sem mudar nada até lá.
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

function RemoveModuleLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="text-right">
      <button onClick={onClick} className="text-[12.5px] text-ink-muted underline hover:opacity-80">
        {label}
      </button>
    </div>
  )
}

/**
 * O período de teste é um por pessoa (D8). Quem já usou não fica sem caminho: a
 * alternativa é assinar pagando desde já, e ela é oferecida aqui em vez de o cliente
 * receber um erro e ter que adivinhar o que fazer.
 */
function TrialUsedDialog({
  selection,
  data,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  selection: PlanSelection
  data: BillingPlans
  pending: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const price = recurringCents(selection, data)

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
          assinar {describeSelection(selection)}
          {price != null && <> por {money(price, data.currency)}/mês</>}. Você vai
          para a tela de pagamento do provedor para confirmar.
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
            Ir para o pagamento
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Marca extra ───────────────────────────────────────────────────────────

function ExtraBrandCard({
  data,
  sub,
  onRequested,
}: {
  data: BillingPlans
  sub: Subscription | null
  onRequested: (r: PendingProjection) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const current = data.plans.find((p) => p.isCurrent)

  // Só o Pro vende. Nos outros o card nem aparece: no Starter o limite é o gatilho
  // de upgrade, e Max/Enterprise já são ilimitados.
  if (!current?.sellsExtraBrandSlots || !sub) return null

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
            O proporcional até o fim do período é cobrado na hora.
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
          sub={sub}
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
  sub,
  onRequested,
  onClose,
}: {
  data: BillingPlans
  sub: Subscription
  onRequested: (r: PendingProjection) => void
  onClose: () => void
}) {
  const [ack, setAck] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { change } = useSubscriptionMutations()
  const current = data.plans.find((p) => p.isCurrent)!
  const target: PlanSelection = {
    ...selectionFromSubscription(sub),
    extraBrandSlots: data.currentExtraBrandSlots + 1,
  }
  const preview = useChangePreview(target)
  const dueNow = preview.data?.dueNow?.amountDueCents

  const confirm = () => {
    setError(null)
    change.mutate(target, {
      onSuccess: () => {
        // O plano NÃO muda aqui — o que muda é a contagem de slots. Esperar pelo slug
        // dava a projeção por chegada antes de a marca extra existir.
        onRequested({ ...target, mode: "immediate", since: Date.now() })
        notifySuccess("Marca extra confirmada. Aguardando a confirmação do provedor.")
        onClose()
      },
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : "Não foi possível adicionar a marca."),
    })
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

        <div className="text-[13px] mt-3" style={{ color: "var(--ink)" }}>
          {preview.isLoading ? (
            <span className="text-ink-muted">Calculando o valor…</span>
          ) : dueNow != null ? (
            <>
              Cobrado agora: <strong className="font-mono-zoe">{money(dueNow, preview.data?.currency ?? data.currency)}</strong>{" "}
              <span className="text-ink-muted">(proporcional até {day(sub.currentPeriodEnd)})</span>
            </>
          ) : null}
        </div>

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
function BillingSection({
  enabled,
  hasSubscription,
  hasCard,
}: {
  enabled: boolean
  hasSubscription: boolean
  /** Null = não deu para saber; nesse caso não afirmamos nada sobre o cartão. */
  hasCard: boolean | null
}) {
  const portal = usePortal()
  const { activeTenantId } = useAuth()
  const open = portal.open

  const rows = [
    {
      label: "Método de pagamento",
      hint:
        hasCard === true ? "Cartão cadastrado. Troque ou remova no portal."
        : hasCard === false ? "Nenhum cartão cadastrado."
        : "Cartão usado nas cobranças recorrentes.",
    },
    { label: "Histórico de faturas", hint: "Faturas pagas e em aberto, com comprovante." },
    { label: "Dados de cobrança", hint: "Razão social, endereço e documento fiscal." },
    {
      label: "Cancelar assinatura",
      // O cancelamento vale até o fim do período pago. Dizer só "reflete aqui" fazia o
      // cliente esperar o acesso cair na hora e concluir que o pedido não pegou.
      hint: "Feito no portal. O acesso continua até o fim do período já pago.",
    },
  ]

  const disabled = !enabled || !hasSubscription || !activeTenantId || portal.pending

  return (
    <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-6 pt-5 pb-3">
        <div className="eyebrow">Faturamento</div>
        <div className="text-[13px] text-ink-muted mt-2 max-w-165 leading-relaxed">
          Pagamento e notas ficam no portal da Stripe. Os itens abaixo abrem lá.
        </div>
      </div>

      {rows.map((r) => (
        <button
          key={r.label}
          onClick={open}
          disabled={disabled}
          className="w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] disabled:opacity-50 disabled:hover:bg-transparent border-t border-border-soft"
        >
          <div className="flex-1">
            <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              {r.label}
            </div>
            <div className="text-[12.5px] text-ink-muted mt-0.5">{r.hint}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted shrink-0">
            {portal.pending ? (
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
    <div className="@container space-y-4 animate-pulse">
      <div className="h-24 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      <div className="grid gap-4 @md:grid-cols-2 @4xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        ))}
      </div>
    </div>
  )
}
