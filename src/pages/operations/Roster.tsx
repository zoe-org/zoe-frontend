import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Users, UserPlus, X, ExternalLink, Loader2, Mail } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { DELIVERY_STATUS_COLOR } from "@/lib/status-colors"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { fmtDate, initials, matches, campaignLabel } from "@/lib/operations-format"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/components/operations/shared"
import { InviteCreatorModal } from "@/components/operations/InviteCreatorModal"
import {
  useRoster, useContracts, useRosterMutations, canReceivePayout, fmtCents,
  useDeliveries, useEscrowAccounts,
  type RosterItem,
} from "@/lib/api/operations"
import { AUDIENCE_SIZES } from "@/lib/api/creator"

/** Valor da aba do filtro de pagamento travado — não é um estado de relacionamento. */
const PAYMENT_STUCK = "pagamento-travado"

/**
 * A conta de recebimento numa situação só. Eram duas colunas, KYC e Recebimento, dizendo quase o
 * mesmo com palavras diferentes — e nenhuma das duas dizia o que fazer.
 */
function payoutState(it: RosterItem): { label: string; color: string; explanation: string } {
  if (canReceivePayout(it)) {
    return { label: "pode receber", color: "#00A799", explanation: "Conta de recebimento conectada e verificada." }
  }
  if (it.kycStatus === "Rejected") {
    return {
      label: "verificação recusada",
      color: "#DC2626",
      explanation: "O provedor recusou a verificação. O criador revisa os dados pela área dele — daqui não há o que fazer além de avisá-lo.",
    }
  }
  if (it.hasStripeAccount || it.kycStatus === "Pending") {
    return {
      label: "em verificação",
      color: "#D97706",
      explanation: "A conta existe e está em verificação pelo provedor. O criador conclui pela área dele.",
    }
  }
  return {
    label: "sem conta",
    color: "#6B7280",
    explanation: "O criador ainda não conectou a conta de recebimento. Ele faz isso pela área dele; sem ela, pagamento aprovado espera.",
  }
}

/** Dinheiro já aprovado para ele, parado porque a conta não está pronta. */
const isPaymentStuck = (it: RosterItem) => (it.releasableCents ?? 0) > 0 && !canReceivePayout(it)

const NETWORKS: Record<string, { abbreviation: string; url: (handle: string) => string }> = {
  YouTube: { abbreviation: "YT", url: (h) => `https://www.youtube.com/@${h}` },
  Instagram: { abbreviation: "IG", url: (h) => `https://www.instagram.com/${h}` },
  TikTok: { abbreviation: "TT", url: (h) => `https://www.tiktok.com/@${h}` },
}

const stripAt = (h: string) => h.trim().replace(/^@/, "")

export default function OperationsRosterPage() {
  const roster = useRoster()
  const [inviteOpen, setInviteOpen] = useState(false)

  // O criador aberto vive na URL: é assim que a custódia e o funil da campanha trazem a pessoa
  // direto para cá, e o voltar do navegador fecha a gaveta.
  const [params, setParams] = useSearchParams()
  const selectedId = params.get("creator")
  const openCreator = (influencerId: string | null) => setParams((p) => {
    if (influencerId) p.set("creator", influencerId)
    else p.delete("creator")
    return p
  })

  const all = useMemo(() => roster.data?.items ?? [], [roster.data])
  const [rel, setRel] = useState<string>("")
  const [search, setSearch] = useState("")
  const [area, setArea] = useState("")
  const [audience, setAudience] = useState("")

  // Só as áreas que existem no elenco: oferecer as quinze do cadastro faria a maioria dar vazio.
  const areas = useMemo(
    () => [...new Set(all.map((i) => i.primaryArea).filter((a): a is string => Boolean(a)))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [all],
  )

  // Só as faixas que existem no elenco, na ordem de tamanho do cadastro.
  const audienceOptions = useMemo(
    () => AUDIENCE_SIZES.filter((a) => all.some((i) => i.audienceSize === a.value)),
    [all],
  )

  const items = useMemo(
    () => (rel === PAYMENT_STUCK ? all.filter(isPaymentStuck) : rel ? all.filter((i) => i.relationshipStatus === rel) : all)
      // E-mail entra na busca porque e' o identificador que a pessoa tem em maos quando
      // veio de fora — de uma conversa, de uma planilha — e nem sempre sabe o nome exato
      // com que o criador foi cadastrado aqui.
      .filter((i) => !area || i.primaryArea === area)
      .filter((i) => !audience || i.audienceSize === audience)
      .filter((i) => matches(search, i.displayName, i.fullName, i.email, i.primaryArea)),
    [all, rel, search, area, audience],
  )

  const selectedCreator = selectedId ? all.find((i) => i.influencerId === selectedId) ?? null : null

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      <RelationshipTabs items={all} value={rel} onChange={setRel} />

      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-2.5">Operations · Elenco</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Criadores
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                {all.length} {all.length === 1 ? "criador" : "criadores"}
              </span>{" "}
              no elenco deste workspace. A pessoa é única na plataforma — se ela já
              trabalha com outra marca, o cadastro só cria o vínculo com você.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {areas.length > 1 && (
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                aria-label="Filtrar por área"
                className="h-9 px-2.5 rounded-lg border border-border-soft text-[12.5px] bg-transparent max-w-[200px]"
                style={{ color: "var(--ink)" }}
              >
                <option value="">Todas as áreas</option>
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            {audienceOptions.length > 1 && (
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                aria-label="Filtrar por audiência"
                className="h-9 px-2.5 rounded-lg border border-border-soft text-[12.5px] bg-transparent max-w-[200px]"
                style={{ color: "var(--ink)" }}
              >
                <option value="">Qualquer audiência</option>
                {audienceOptions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            )}
            {all.length > 0 && (
              <SearchBox value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail, área…" />
            )}
          <RoleGate minRole="Admin">
            {/* Convidar nao depende de campanha: a marca monta elenco antes de existir
                acao, e o criador e da marca, nao do projeto.

                E' a unica porta de entrada. Existia tambem "Adicionar criador", que
                cadastrava sem avisar a pessoa: ela entrava no elenco sem conta, e sem
                conta nao conecta o recebimento — o contrato andava e o pagamento travava
                no fim. */}
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Convidar criador
            </button>
          </RoleGate>
          </div>
        </div>
      </section>

      <section style={{ background: "var(--surface)" }}>
        {roster.isLoading ? (
          <TableSkeleton />
        ) : roster.isError ? (
          <ErrorState onRetry={() => roster.refetch()} />
        ) : items.length === 0 && (search || area || audience) ? (
          <NoResults
            query={search || area || AUDIENCE_SIZES.find((a) => a.value === audience)?.label || ""}
            onClear={() => { setSearch(""); setArea(""); setAudience("") }}
          />
        ) : items.length === 0 ? (
          <EmptyBlock
            className="py-16"
            icon={<Users className="w-7 h-7" strokeWidth={1.5} />}
            message="Nenhum criador no elenco"
            hint="Convide um criador: ele entra no elenco ao aceitar e passa a poder ser contratado."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Criador</th>
                  <th className="text-left py-3 eyebrow font-semibold">Redes</th>
                  <th className="text-left py-3 eyebrow font-semibold">Área</th>
                  <th className="text-left py-3 eyebrow font-semibold">Recebimento</th>
                  <th className="text-left py-3 eyebrow font-semibold">Contratos</th>
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Última campanha</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <RosterRow key={it.tenantInfluencerId} item={it} index={i} onOpen={() => openCreator(it.influencerId)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCreator && <CreatorDrawer item={selectedCreator} onClose={() => openCreator(null)} />}
      {inviteOpen && <InviteCreatorModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}

function RosterRow({ item, index, onOpen }: { item: RosterItem; index: number; onOpen: () => void }) {
  const name = item.displayName || item.fullName
  const rec = payoutState(item)
  const networks = Object.entries(item.handles ?? {})

  return (
    // A linha inteira abre a gaveta; o nome é o botão, para teclado e leitor de tela.
    <tr
      onClick={onOpen}
      className="border-b border-border-soft hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors cursor-pointer"
    >
      <td className="px-8 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[12px]"
            style={{ background: `hsl(${index * 47 + 200}, 45%, 60%)` }}
          >
            {initials(item.fullName, item.email)}
          </div>
          <div className="min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); onOpen() }}
              className="font-medium flex items-center gap-2 text-left hover:underline"
              style={{ color: "var(--ink)" }}
            >
              {name}
              {item.status !== "Active" && (
                <span className="chip text-[10px]">{tEnum("rosterStatus", item.status)}</span>
              )}
            </button>
            <div className="font-mono-zoe text-[11.5px] text-ink-muted truncate">{item.email}</div>
          </div>
        </div>
      </td>
      <td className="py-3.5 text-[12px] text-ink-2">
        {networks.length === 0
          ? <span className="text-ink-muted">—</span>
          : networks.map(([network, handle]) => (
            <span key={network} className="mr-2 whitespace-nowrap">
              <span className="text-ink-muted">{NETWORKS[network]?.abbreviation ?? network}</span> @{stripAt(handle)}
            </span>
          ))}
      </td>
      <td className="py-3.5 text-[12.5px] text-ink-2">
        {item.primaryArea ?? <span className="text-ink-muted">—</span>}
      </td>
      <td className="py-3.5 text-[12.5px]">
        <span style={{ color: rec.color }}>{rec.label}</span>
        {isPaymentStuck(item) && (
          <div className="text-[11px] font-medium" style={{ color: "#DC2626" }}>
            {fmtCents(item.releasableCents ?? 0)} esperando
          </div>
        )}
      </td>
      <td className="py-3.5 font-mono-zoe text-ink-2">{item.contractCount}</td>
      <td className="px-8 py-3.5 text-[12.5px] text-ink-2">
        {item.lastContractAt
          ? <>{campaignLabel(item.lastCampaignName)} <span className="text-ink-muted">· {fmtDate(item.lastContractAt)}</span></>
          : <span className="text-ink-muted">—</span>}
      </td>
    </tr>
  )
}

/**
 * O criador por inteiro: situação da conta, o que ele declarou no cadastro e os contratos com
 * este workspace. A linha do elenco não abria nada, e para saber qualquer coisa além do nome era
 * preciso caçar em Contratos ou Custódia.
 */
function CreatorDrawer({ item, onClose }: { item: RosterItem; onClose: () => void }) {
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const contracts = useContracts()
  const creatorContracts = (contracts.data?.items ?? []).filter((c) => c.influencerId === item.influencerId)

  // Histórico do trabalho com este criador. As entregas vêm pela lista de contratos dele (a fila
  // não traz o id do criador); os pagamentos, pelas custódias já liberadas.
  const deliveries = useDeliveries()
  const escrows = useEscrowAccounts()
  const contractIds = new Set(creatorContracts.map((c) => c.contractId))
  const creatorDeliveries = (deliveries.data?.items ?? [])
    .filter((d) => contractIds.has(d.contractId))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const creatorPayments = (escrows.data?.items ?? [])
    .filter((e) => e.influencerId === item.influencerId && e.state === "Released")
  const rec = payoutState(item)
  const audience = AUDIENCE_SIZES.find((a) => a.value === item.audienceSize)?.label
  const networks = Object.entries(item.handles ?? {})
  const topics = item.topics ?? []

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(11,15,26,.5)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] overflow-y-auto border-l border-border-soft"
        style={{ background: "var(--surface)" }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Criador ${item.fullName}`}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border-soft"
          style={{ background: "var(--surface)" }}
        >
          <div className="eyebrow">Criador</div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <h2 className="font-display m-0" style={{ fontSize: 21, color: "var(--ink)" }}>
            {item.displayName || item.fullName}
          </h2>
          <div className="font-mono-zoe text-[12px] text-ink-muted mt-0.5">{item.email}</div>
          <div className="flex gap-1.5 flex-wrap mt-2">
            <span className="chip text-[10.5px]">{tEnum("relationshipStatus", item.relationshipStatus)}</span>
            {item.countryCode && <span className="chip text-[10.5px]">{item.countryCode}</span>}
          </div>

          <div className="rounded-lg border border-border-soft p-4 mt-5">
            <div className="eyebrow mb-1.5">Recebimento</div>
            <div className="text-[13px] font-medium" style={{ color: rec.color }}>{rec.label}</div>
            <p className="text-[12px] text-ink-muted m-0 mt-1">{rec.explanation}</p>
            {isPaymentStuck(item) && (
              <div className="rounded-md p-2.5 mt-2.5 text-[12px]" style={{ background: "#DC262612", color: "#B91C1C" }}>
                {fmtCents(item.releasableCents ?? 0)} já aprovados para este criador esperam esta conta.{" "}
                <Link to="/operations/escrow" className="underline">Ver na custódia</Link>
              </div>
            )}
            {!canReceivePayout(item) && (
              <RoleGate minRole="Admin">
                <RemindCreatorButton influencerId={item.influencerId} name={item.displayName || item.fullName} />
              </RoleGate>
            )}
          </div>

          <div className="mt-5">
            <div className="eyebrow mb-2">Cadastro</div>
            {!item.profileComplete && (
              <p className="text-[12px] text-ink-muted m-0 mb-2">
                Ainda não completou o cadastro — o que estiver abaixo pode estar incompleto.
              </p>
            )}
            <div className="text-[12.5px] flex flex-col gap-1.5" style={{ color: "var(--ink-2)" }}>
              <div>
                <span className="text-ink-muted">Área: </span>
                {item.primaryArea ?? "—"}
                {audience && <span className="text-ink-muted"> · audiência {audience.toLowerCase()}</span>}
              </div>
              {networks.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {networks.map(([network, handle]) => (
                    <a
                      key={network}
                      href={NETWORKS[network]?.url(stripAt(handle)) ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1"
                      style={{ color: "var(--color-teal-500)" }}
                    >
                      {network} @{stripAt(handle)} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {topics.map((t) => <span key={t} className="chip text-[10.5px]">{t}</span>)}
                </div>
              )}
              {item.bio && <p className="m-0 mt-1">{item.bio}</p>}
              {item.portfolioUrl && (
                <a
                  href={item.portfolioUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 break-all"
                  style={{ color: "var(--color-teal-500)" }}
                >
                  Portfólio <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="eyebrow mb-2">Contratos com você ({creatorContracts.length})</div>
            {/* O dinheiro da relação num relance, sempre em líquido — o que chega nele. */}
            {((item.paidCents ?? 0) > 0 || (item.inEscrowCents ?? 0) > 0 || (item.releasableCents ?? 0) > 0) && (
              <div className="grid grid-cols-3 gap-2 mb-2.5">
                {([
                  ["Pago", item.paidCents ?? 0],
                  ["Em custódia", item.inEscrowCents ?? 0],
                  ["Liberável", item.releasableCents ?? 0],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border-soft px-2.5 py-2">
                    <div className="text-[10.5px] text-ink-muted">{label}</div>
                    <div className="font-mono-zoe text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>
                      {fmtCents(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {creatorContracts.length === 0 ? (
              <p className="text-[12.5px] text-ink-muted m-0">Nenhum contrato com este criador ainda.</p>
            ) : (
              <div className="rounded-lg border border-border-soft">
                {creatorContracts.map((c, i) => (
                  <Link
                    key={c.contractId}
                    to={`/operations/contracts/${c.contractId}`}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
                  >
                    <span className="flex-1 truncate" style={{ color: "var(--ink)" }}>{campaignLabel(c.campaignName)}</span>
                    {c.escrowState && (
                      <span className="text-[11px] text-ink-muted">{tEnum("escrowState", c.escrowState)}</span>
                    )}
                    <span className="chip text-[10.5px]">{tEnum("contractStatus", c.status)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {creatorDeliveries.length > 0 && (
            <div className="mt-5">
              <div className="eyebrow mb-2">Entregas ({creatorDeliveries.length})</div>
              <div className="rounded-lg border border-border-soft">
                {creatorDeliveries.slice(0, 5).map((d, i) => (
                  <Link
                    key={d.deliveryId}
                    to={`/operations/deliveries?contract=${d.contractId}`}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ color: "var(--ink)" }}>{campaignLabel(d.campaignName)}</span>
                      <span className="text-[11px] text-ink-muted">
                        {fmtDate(d.submittedAt)}
                        {d.submissionAttempt > 1 && ` · ${d.submissionAttempt}ª tentativa`}
                      </span>
                    </span>
                    <StatusChip status={d.status} kind="deliveryStatus" colors={DELIVERY_STATUS_COLOR} small />
                  </Link>
                ))}
              </div>
              {creatorDeliveries.length > 5 && (
                <p className="text-[11.5px] text-ink-muted m-0 mt-1.5">
                  Mostrando as 5 mais recentes. As demais estão na fila de entregas.
                </p>
              )}
            </div>
          )}

          {creatorPayments.length > 0 && (
            <div className="mt-5">
              <div className="eyebrow mb-2">Pagamentos feitos ({creatorPayments.length})</div>
              <div className="rounded-lg border border-border-soft">
                {creatorPayments.map((e, i) => (
                  <Link
                    key={e.escrowAccountId}
                    to="/operations/escrow"
                    className="flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
                  >
                    <span className="flex-1 truncate" style={{ color: "var(--ink)" }}>{campaignLabel(e.campaignName)}</span>
                    {/* Líquido: o que chegou nele, como no resumo acima. */}
                    <span className="font-mono-zoe text-[12px]" style={{ color: "var(--ink)" }}>
                      {fmtCents(e.netToInfluencerCents)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Lembrete por e-mail para o criador resolver a conta de recebimento. A conta é dele — a marca
 * não tem como concluir por ele —, e sem isto o caminho era mandar mensagem por fora sem saber
 * o que dizer. O servidor limita o envio e recusa quando a conta já está pronta.
 */
function RemindCreatorButton({ influencerId, name }: { influencerId: string; name: string }) {
  const { remindPayout } = useRosterMutations()
  const [sent, setSent] = useState(false)

  const remind = async () => {
    try {
      const res = await remindPayout.mutateAsync(influencerId)
      setSent(true)
      if (res.emailDelivery === "Sent") notifySuccess(`Lembrete enviado para ${name}.`)
      else notifyError(null, "O e-mail não saiu — o envio está desligado ou falhou neste ambiente.")
    } catch (e) {
      notifyError(e, "Não foi possível lembrar o criador.")
    }
  }

  return (
    <button
      onClick={remind}
      disabled={remindPayout.isPending || sent}
      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft disabled:opacity-50"
      style={{ color: "var(--color-teal-500)" }}
    >
      {remindPayout.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
      {sent ? "Lembrete enviado" : "Lembrar criador por e-mail"}
    </button>
  )
}

/**
 * Filtro por estado do relacionamento.
 *
 * <p>As abas saem dos dados, não de uma lista fixa: só aparece o estado que existe no
 * elenco. Aba com zero é aba que o usuário clica e não entende por que está vazia.</p>
 *
 * <p><b>Não há "Recusou".</b> O convite tem aceite e vencimento, e nenhuma recusa
 * explícita — o criador aceita ou deixa vencer. O protótipo mostra essa aba; o domínio
 * não sabe produzi-la, e inventá-la aqui seria rotular como recusa o que é silêncio.</p>
 *
 * <p>"Pagamento travado" vem por último e só com alguém nele: não é etapa da relação, é o
 * que a marca procura quando a custódia avisa que um pagamento está parado.</p>
 */
function RelationshipTabs({
  items,
  value,
  onChange,
}: {
  items: RosterItem[]
  value: string
  onChange: (v: string) => void
}) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) m.set(i.relationshipStatus, (m.get(i.relationshipStatus) ?? 0) + 1)
    return m
  }, [items])
  const stuckCount = items.filter(isPaymentStuck).length

  // Ordem do fluxo, não alfabética: é a jornada do criador com a marca.
  const ORDER = ["Convidado", "Aceito", "Contratado", "Active", "Paused", "ConviteExpirado", "Archived"]
  const present = ORDER.filter((k) => counts.has(k))

  if (present.length <= 1 && stuckCount === 0) return null

  return (
    <div className="flex gap-1 flex-wrap">
      <TabButton label="Todos" count={items.length} active={value === ""} onClick={() => onChange("")} />
      {present.map((k) => (
        <TabButton
          key={k}
          label={tEnum("relationshipStatus", k)}
          count={counts.get(k) ?? 0}
          active={value === k}
          onClick={() => onChange(k)}
        />
      ))}
      {stuckCount > 0 && (
        <TabButton
          label="Pagamento travado"
          count={stuckCount}
          active={value === PAYMENT_STUCK}
          onClick={() => onChange(PAYMENT_STUCK)}
          warning
        />
      )}
    </div>
  )
}

function TabButton({
  label, count, active, onClick, warning = false,
}: { label: string; count: number; active: boolean; onClick: () => void; warning?: boolean }) {
  const color = warning ? "#DC2626" : "var(--color-teal-500)"
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors"
      style={
        active
          ? { background: color, color: "#fff" }
          : { color: warning ? "#DC2626" : "var(--ink-muted)", border: `1px solid ${warning ? "#DC262640" : "var(--border-soft)"}` }
      }
    >
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  )
}
