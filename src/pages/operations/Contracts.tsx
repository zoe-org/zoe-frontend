import { useMemo, useState } from "react"
import { CONTRACT_STATUS_COLOR } from "@/lib/status-colors"
import { Plus, X, Loader2, FileText, ShieldAlert, Trash2 } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, matches } from "@/lib/operations-format"
import {
  Field, Select, TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/components/operations/shared"
import {
  useContractDefaults,
  useContracts, useContractMutations, useRoster, useCampaigns, useCampaign, fmtCents,
  supportsEscrow, escrowRejectionReason, CONTRACT_MODALITIES,
  type ContractSummary, type CreateContractBody, type CampaignInvite, type RosterItem,
} from "@/lib/api/operations"

const STATUS_COLOR = CONTRACT_STATUS_COLOR

/** Custódia aberta (estado), prevista e ainda não aberta, ou inexistente por desenho. */
function EscrowCell({ item }: { item: ContractSummary }) {
  if (item.escrowState) {
    return (
      <span className="font-medium" style={{ color: "var(--ink)" }}>
        {tEnum("escrowState", item.escrowState)}
      </span>
    )
  }
  if (item.usesEscrow) {
    return <span className="text-ink-muted">prevista, não aberta</span>
  }
  return <span className="text-ink-muted">sem custódia</span>
}

export default function OperationsContractsPage() {
  const contracts = useContracts()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  // Vem do "Ver todos" da campanha. Na URL, e não em estado, para o voltar do navegador e o
  // link copiado levarem à mesma lista.
  const [params, setParams] = useSearchParams()
  const campaignFilter = params.get("campaign")
  // "?new=1" abre o modal; com "campaign" e "creator" ele já vem escolhido — é o "Criar
  // contrato" do funil da campanha.
  const openedFromLink = params.get("new") === "1"

  const allContracts = useMemo(() => contracts.data?.items ?? [], [contracts.data])
  // O nome vem da lista de campanhas, não dos contratos: campanha sem contrato nenhum também
  // precisa de nome no selo, e a lista de contratos ainda carregando dizia "Campanha: campanha".
  const campaigns = useCampaigns()
  const campaignFilterName = campaignFilter
    ? campaigns.data?.items.find((c) => c.campaignId === campaignFilter)?.name ?? "…"
    : null
  const clearCampaignFilter = () => setParams((p) => {
    p.delete("campaign")
    return p
  })

  // Criador e campanha sao o que se procura; status e modalidade entram porque "assinado"
  // e "publipost" sao termos que a pessoa digita sem pensar que sao filtros.
  const items = useMemo(
    () => allContracts.filter((c) => (!campaignFilter || c.campaignId === campaignFilter) && matches(
      search, c.influencerName, c.campaignName, tEnum("contractStatus", c.status),
      c.modality ? tEnum("contractModality", c.modality) : c.hybridCode)),
    [allContracts, search, campaignFilter],
  )

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-2.5">Operations · Contratos</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Contratos
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                {allContracts.length} {allContracts.length === 1 ? "contrato" : "contratos"}
              </span>{" "}
              neste workspace. O documento é montado a partir do template da modalidade —
              você preenche os valores, as cláusulas vêm prontas.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {campaignFilterName && (
              <button
                onClick={clearCampaignFilter}
                title="Mostrar os contratos de todas as campanhas"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium"
                style={{ background: "var(--color-teal-50, #F0FDFB)", color: "var(--color-teal-500)" }}
              >
                Campanha: {campaignFilterName} <X className="w-3 h-3" />
              </button>
            )}
            {allContracts.length > 0 && (
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Buscar por criador, campanha…"
              />
            )}
          <RoleGate minRole="Admin">
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Novo contrato
            </button>
          </RoleGate>
          </div>
        </div>
      </section>

      <section style={{ background: "var(--surface)" }}>
        {contracts.isLoading ? (
          <TableSkeleton />
        ) : contracts.isError ? (
          <ErrorState onRetry={() => contracts.refetch()} />
        ) : items.length === 0 && (search || campaignFilterName) ? (
          <NoResults
            query={search || campaignFilterName || ""}
            onClear={() => { setSearch(""); clearCampaignFilter() }}
          />
        ) : items.length === 0 ? (
          <EmptyBlock
            className="py-16"
            icon={<FileText className="w-7 h-7" strokeWidth={1.5} />}
            message="Nenhum contrato ainda"
            hint="Um contrato começa como rascunho a partir de uma modalidade. Só depois de assinado é que a custódia pode ser aberta."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Criador</th>
                  <th className="text-left py-3 eyebrow font-semibold">Campanha</th>
                  <th className="text-left py-3 eyebrow font-semibold">Modalidade</th>
                  <th className="text-left py-3 eyebrow font-semibold">Status</th>
                  <th className="text-left py-3 eyebrow font-semibold">Custódia</th>
                  <th className="text-left py-3 eyebrow font-semibold">Criado em</th>
                  <th className="px-8 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.contractId}
                    className="border-b border-border-soft hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                  >
                    <td className="px-8 py-3.5">
                      <Link to={`/operations/contracts/${it.contractId}`} className="block">
                        <div className="font-medium hover:underline" style={{ color: "var(--ink)" }}>
                          {it.influencerName}
                        </div>
                        <div className="font-mono-zoe text-[11.5px] text-ink-muted">
                          v{it.templateVersion}
                          {it.hybridCode && ` · ${it.hybridCode}`}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5">
                      {it.campaignId ? (
                        <Link
                          to={`/operations/campaigns?c=${it.campaignId}`}
                          className="hover:underline"
                          style={{ color: "var(--ink)" }}
                        >
                          {it.campaignName}
                        </Link>
                      ) : (
                        // Avulso não tem para onde levar: um link cinza que não navega
                        // é pior do que dizer que a campanha não existe.
                        <span className="text-ink-muted">Sem campanha</span>
                      )}
                    </td>
                    <td className="py-3.5">{tEnum("contractModality", it.modality)}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <StatusChip status={it.status} kind="contractStatus" colors={STATUS_COLOR} />
                        {it.status === "Draft" && !it.templateLegalReviewed && (
                          <span
                            title="O template desta modalidade ainda não passou por revisão jurídica — o contrato não sai para assinatura assim."
                            className="text-[#D97706]"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5"><EscrowCell item={it} /></td>
                    <td className="py-3.5 font-mono-zoe text-ink-2">{fmtDate(it.createdAt)}</td>
                    <td className="px-8 py-3.5 text-right">
                      <RoleGate allow={["Owner", "Admin"]}>
                        {/* Só rascunho: a partir do envio existe envelope no provedor e
                            talvez quem ja' assinou, e apagar aqui nao desfaz nada disso. */}
                        {it.status === "Draft" && <DeleteDraftButton item={it} />}
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(createOpen || openedFromLink) && (
        <CreateContractModal
          initialCampaignId={openedFromLink ? campaignFilter ?? undefined : undefined}
          initialInfluencerId={openedFromLink ? params.get("creator") ?? undefined : undefined}
          onClose={() => {
            setCreateOpen(false)
            if (openedFromLink) {
              setParams((p) => {
                p.delete("new")
                p.delete("creator")
                return p
              })
            }
          }}
        />
      )}
    </div>
  )
}

/** Exclusão de rascunho confirmada no próprio botão, sem modal. */
function DeleteDraftButton({ item }: { item: ContractSummary }) {
  const { remove } = useContractMutations()
  const [confirming, setConfirming] = useState(false)

  const deleteDraft = async () => {
    try {
      await remove.mutateAsync(item.contractId)
      notifySuccess("Rascunho excluído.")
    } catch (e) {
      notifyError(e, "Não foi possível excluir.")
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        title="Excluir rascunho"
        aria-label={`Excluir rascunho de ${item.influencerName}`}
        className="p-1.5 rounded-md text-ink-muted hover:text-[#DC2626] transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={deleteDraft}
        disabled={remove.isPending}
        className="text-[12px] font-medium px-2 py-1 rounded-md disabled:opacity-50"
        style={{ background: "#DC262615", color: "#DC2626" }}
      >
        {remove.isPending ? "Excluindo…" : "Confirmar"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-[12px] text-ink-muted px-1.5 py-1"
      >
        Cancelar
      </button>
    </span>
  )
}

function CreateContractModal({
  onClose, initialCampaignId, initialInfluencerId,
}: {
  onClose: () => void
  initialCampaignId?: string
  initialInfluencerId?: string
}) {
  const roster = useRoster()
  const campaigns = useCampaigns()
  const { create } = useContractMutations()
  const navigate = useNavigate()
  const existingContracts = useContracts()

  const [campaignId, setCampaignId] = useState(initialCampaignId ?? "")
  /** Modalidade do avulso. Ignorada quando há campanha — lá ela é quem manda. */
  const [avulsaModality, setAvulsaModality] = useState("")
  const [influencerId, setInfluencerId] = useState(initialInfluencerId ?? "")
  const [usesEscrow, setUsesEscrow] = useState(true)
  /** Pagamento encadeado ligado por padrão; desligar volta ao fluxo manual. */
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [reviewSlaDays, setReviewSlaDays] = useState("7")
  const [maxResubmissions, setMaxResubmissions] = useState("2")
  /** Aprovação por prazo vencido (RN-O-055); nulo usa o padrão da marca no servidor. */
  const [autoRelease, setAutoRelease] = useState<boolean | null>(null)
  const tenantDefaults = useContractDefaults()
  const autoReleaseValue = autoRelease ?? tenantDefaults.data?.autoReleaseOnTimeout ?? true
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()

  const people = useMemo(() => roster.data?.items ?? [], [roster.data])

  // Com campanha escolhida, quem foi convidado para ela vem primeiro — é para quem o contrato
  // costuma ser — e a proposta aparece antes de criar, em vez de só depois, no rascunho.
  const campaignDetail = useCampaign(campaignId || undefined)
  const inviteByCreator = useMemo(() => {
    const m = new Map<string, CampaignInvite>()
    // A lista vem do mais novo: o primeiro de cada pessoa fica, a menos que um aceito apareça.
    for (const i of campaignDetail.data?.invites ?? []) {
      const existing = m.get(i.influencerId)
      if (!existing || (!existing.accepted && i.accepted)) m.set(i.influencerId, i)
    }
    return m
  }, [campaignDetail.data])

  // Aceito, pendente, vencido: vencido não some — a proposta dele ainda é a última conversa
  // com essa pessoa —, mas não pode parecer à espera de resposta.
  const inviteStatus = (i: CampaignInvite) =>
    i.accepted ? "aceitou o convite" : i.expired ? "convite vencido" : "convite pendente"
  const inviteOrder = (i: CampaignInvite) => (i.accepted ? 0 : i.expired ? 2 : 1)

  const invitedCreators = campaignId
    ? people
      .filter((p) => inviteByCreator.has(p.influencerId))
      .sort((a, b) => inviteOrder(inviteByCreator.get(a.influencerId)!)
        - inviteOrder(inviteByCreator.get(b.influencerId)!))
    : []
  const otherCreators = invitedCreators.length > 0
    ? people.filter((p) => !inviteByCreator.has(p.influencerId))
    : people
  const selectedInvite = influencerId ? inviteByCreator.get(influencerId) : undefined
  const hasProposal = (i: CampaignInvite) =>
    i.feeCents != null || Boolean(i.expectedDeliverables?.trim()) || i.deliveryDeadline != null

  const renderOption = (p: RosterItem, suffix: string) => (
    <option key={p.influencerId} value={p.influencerId}>
      {p.displayName || p.fullName} — {suffix}
    </option>
  )

  const duplicates = useMemo(
    () => campaignId && influencerId
      ? (existingContracts.data?.items ?? []).filter(
        (c) => c.campaignId === campaignId && c.influencerId === influencerId && c.status !== "Cancelled")
      : [],
    [existingContracts.data, campaignId, influencerId],
  )
  // Campanha encerrada não recebe contrato — o domínio recusa, então nem oferecemos.
  const openCampaigns = useMemo(
    () => (campaigns.data?.items ?? []).filter(
      (c) => c.status === "Draft" || c.status === "Active"),
    [campaigns.data],
  )

  const campaign = openCampaigns.find((c) => c.campaignId === campaignId)
  // Com campanha ela manda; sem campanha, quem escolhe é este formulário. Uma variável
  // só para as duas origens: o resto da tela não precisa saber de onde veio.
  const modality = campaign?.modality ?? (campaignId === "" ? avulsaModality : "")
  const escrowBlocked = modality ? escrowRejectionReason(modality) : null

  const disableEscrowIfUnsupported = (m: string) => {
    if (m && !supportsEscrow(m)) setUsesEscrow(false)
  }

  // Trocar de campanha pode desligar a custódia, porque troca a modalidade junto.
  const changeCampaign = (next: string) => {
    setCampaignId(next)
    if (next === "") disableEscrowIfUnsupported(avulsaModality)
    else disableEscrowIfUnsupported(
      openCampaigns.find((c) => c.campaignId === next)?.modality ?? "")
  }

  const changeModality = (next: string) => {
    setAvulsaModality(next)
    disableEscrowIfUnsupported(next)
  }

  // Sem campanha a modalidade passa a ser obrigatória: é ela que resolve o template.
  const canSubmit = Boolean(modality) && Boolean(influencerId) && !create.isPending

  const submit = () => {
    if (!canSubmit) return
    const body: CreateContractBody = {
      campaignId: campaignId || null,
      influencerId,
      // Campanha que veio pelo link não passou por changeCampaign: a modalidade dela decide
      // aqui, senão uma permuta sairia pedindo custódia e voltaria recusada.
      usesEscrow: usesEscrow && !escrowBlocked,
      autoAdvanceEscrow: usesEscrow && !escrowBlocked && autoAdvance,
      modality: campaignId ? undefined : avulsaModality,
      reviewSlaDays: Number(reviewSlaDays) || undefined,
      maxResubmissions: Number(maxResubmissions) || undefined,
      autoReleaseOnTimeout: autoRelease ?? undefined,
    }
    create.mutate(body, {
      onSuccess: (res) => {
        notifySuccess(
          `Rascunho criado a partir do template ${tEnum("contractModality", res.modality)} v${res.templateVersion}.`,
        )
        onClose()
        // O trabalho que sobra está no detalhe: o rascunho já nasce com o que foi herdado, e
        // voltar à lista obrigaria a pessoa a achar a linha nova para ver o que falta.
        navigate(`/operations/contracts/${res.contractId}`)
      },
      onError: (e) => {
        // A matriz é revalidada no backend. Se cair aqui, a tela e o domínio
        // discordaram — a mensagem do servidor é a que vale.
        notifyError(e, "Não foi possível criar o contrato.")
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: "var(--surface)" }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Novo contrato"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <div className="eyebrow mb-1.5">Contratos</div>
            <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
              Novo contrato
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-2 overflow-y-auto flex-1 flex flex-col gap-3.5">
          {people.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-ink-muted">
              Nenhum criador no elenco ainda.{" "}
              <Link to="/operations/influencers" className="underline" style={{ color: "var(--color-teal-500)" }}>
                Adicione um criador
              </Link>{" "}
              antes de criar um contrato.
            </div>
          ) : (
            <>
              <Field
                label="Campanha"
                hint={campaignId
                  ? "A modalidade e as cláusulas vêm dela."
                  : "Trabalho pontual não precisa de campanha — escolha a modalidade abaixo."}
              >
                <Select value={campaignId} onChange={changeCampaign}>
                  {/* "Sem campanha" é opção, não estado vazio: um "Selecione…" que também
                      significa "nenhuma" faria a pessoa achar que esqueceu de escolher. */}
                  <option value="">Sem campanha (avulso)</option>
                  {openCampaigns.map((c) => (
                    <option key={c.campaignId} value={c.campaignId}>
                      {c.name} — {tEnum("contractModality", c.modality)}
                    </option>
                  ))}
                </Select>
              </Field>

              {!campaignId && (
                <Field
                  label="Modalidade"
                  hint="Resolve o template do documento. No contrato com campanha, ela vem da campanha."
                >
                  <Select value={avulsaModality} onChange={changeModality}>
                    <option value="">Selecione…</option>
                    {CONTRACT_MODALITIES.map((m) => (
                      <option key={m} value={m}>
                        {tEnum("contractModality", m)}
                        {!supportsEscrow(m) ? " — sem custódia" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {openCampaigns.length === 0 && (
                <p className="text-[11.5px] text-ink-muted m-0 -mt-1">
                  Nenhuma campanha aberta.{" "}
                  <Link to="/operations/campaigns" className="underline" style={{ color: "var(--color-teal-500)" }}>
                    Criar uma campanha
                  </Link>{" "}
                  agrupa contratos e habilita o briefing auditável.
                </p>
              )}

              <Field label="Criador">
                <Select value={influencerId} onChange={setInfluencerId}>
                  <option value="">Selecione…</option>
                  {invitedCreators.length > 0 ? (
                    <>
                      <optgroup label="Convidados para esta campanha">
                        {invitedCreators.map((p) => renderOption(p, inviteStatus(inviteByCreator.get(p.influencerId)!)))}
                      </optgroup>
                      {otherCreators.length > 0 && (
                        <optgroup label="Resto do elenco">
                          {otherCreators.map((p) => renderOption(p, p.email))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    otherCreators.map((p) => renderOption(p, p.email))
                  )}
                </Select>
              </Field>

              {selectedInvite && hasProposal(selectedInvite) && (
                <div
                  className="rounded-lg border border-border-soft p-3 text-[12px]"
                  style={{ background: "var(--bg, #F9FAFB)" }}
                >
                  <div className="text-[11px] text-ink-muted mb-1">
                    Proposta do convite{" "}
                    {selectedInvite.accepted
                      ? "(aceita)"
                      : selectedInvite.expired ? "(convite vencido, não aceito)" : "(ainda não aceita)"}
                  </div>
                  <div style={{ color: "var(--ink)" }}>
                    {[
                      selectedInvite.feeCents != null && `Cachê ${fmtCents(selectedInvite.feeCents)}`,
                      selectedInvite.expectedDeliverables?.trim(),
                      selectedInvite.deliveryDeadline && `prazo ${fmtDate(selectedInvite.deliveryDeadline)}`,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1">
                    {duplicates.length > 0
                      ? "Cada proposta vale para um contrato: se o existente já a usou, este nasce sem ela — o rascunho avisa."
                      : "Entra no rascunho marcada como vinda da proposta."}
                  </div>
                </div>
              )}

              {/* Com o rascunho nascendo no aceite do convite, criar pela tela duplicava sem
                  ninguém perceber. Não bloqueia: dois trabalhos na mesma campanha existem. */}
              {duplicates.length > 0 && (
                <div className="rounded-lg p-3 text-[12px]" style={{ background: "#D9770615", color: "#B45309" }}>
                  Este criador já tem {duplicates.length === 1 ? "um contrato" : `${duplicates.length} contratos`} nesta
                  campanha ({duplicates.map((c) => tEnum("contractStatus", c.status).toLowerCase()).join(", ")}).{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => { onClose(); navigate(`/operations/contracts/${duplicates[0].contractId}`) }}
                  >
                    Abrir o existente
                  </button>
                  {" "}— ou crie outro se for um trabalho novo.
                </div>
              )}

              <div
                className="rounded-lg border p-3 flex flex-col gap-2"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usesEscrow && !escrowBlocked}
                    disabled={Boolean(escrowBlocked) || !modality}
                    onChange={(e) => setUsesEscrow(e.target.checked)}
                    className="mt-0.5 accent-[var(--color-teal-500)] disabled:opacity-40"
                  />
                  <span>
                    <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      Usar custódia (Smart Escrow)
                    </span>
                    <span className="block text-[11.5px] text-ink-muted mt-0.5">
                      O valor fica reservado antes da produção e só é pago após a aprovação.
                    </span>
                  </span>
                </label>

                {escrowBlocked && (
                  <p className="text-[11.5px] text-[#D97706] pl-6.5">{escrowBlocked}</p>
                )}

                {usesEscrow && !escrowBlocked && (
                  <label className="flex items-start gap-2.5 cursor-pointer pl-6.5">
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={(e) => setAutoAdvance(e.target.checked)}
                      className="mt-0.5 accent-[var(--color-teal-500)]"
                    />
                    <span>
                      <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                        Pagamento automático
                      </span>
                      <span className="block text-[11.5px] text-ink-muted mt-0.5">
                        Assinado o contrato, o valor é reservado e a produção liberada sem
                        clique. Aprovada a entrega, o pagamento sai. A aprovação continua sua.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Prazo de revisão" hint="Dias para revisar a entrega.">
                  <Input
                    type="number"
                    min={1}
                    value={reviewSlaDays}
                    onChange={(e) => setReviewSlaDays(e.target.value)}
                  />
                </Field>
                <Field label="Correções" hint="Tentativas antes de virar disputa.">
                  <Input
                    type="number"
                    min={0}
                    value={maxResubmissions}
                    onChange={(e) => setMaxResubmissions(e.target.value)}
                  />
                </Field>
              </div>

              <label
                className="flex items-start gap-2.5 cursor-pointer rounded-lg border p-3"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <input
                  type="checkbox"
                  checked={autoReleaseValue}
                  onChange={(e) => setAutoRelease(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-teal-500)]"
                />
                <span>
                  <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    Aprovar a entrega se o prazo de revisão vencer
                  </span>
                  <span className="block text-[11.5px] text-ink-muted mt-0.5">
                    Sem revisão em {Number(reviewSlaDays) || 7} dias, a entrega é aprovada e segue como numa
                    aprovação sua — nunca sobre entrega com auditoria reprovada. Vai escrito no contrato e dá
                    para mudar até enviar para assinatura.
                  </span>
                </span>
              </label>

              <p className="text-[12px] text-ink-muted">
                O contrato nasce como rascunho. Os campos obrigatórios são preenchidos
                depois, na tela do contrato, antes de enviar para assinatura.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-soft shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            // Campanha deixou de ser pré-requisito: o que trava agora é elenco vazio,
            // porque sem criador não há com quem contratar.
            disabled={!canSubmit || people.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Criar rascunho
          </button>
        </div>
      </div>
    </div>
  )
}

