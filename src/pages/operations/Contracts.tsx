import { useMemo, useState } from "react"
import { Plus, X, Loader2, FileText, ShieldAlert, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Link, useNavigate } from "react-router-dom"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, matches } from "@/pages/operations/format"
import {
  Field, Select, TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/pages/operations/shared"
import {
  useContracts, useContractMutations, useRoster, useCampaigns,
  supportsEscrow, escrowRejectionReason, CONTRACT_MODALITIES,
  type ContractSummary, type CreateContractBody,
} from "@/lib/api/operations"

const STATUS_COLOR: Record<string, string> = {
  Draft: "#6B7280",
  SentForSignature: "#D97706",
  Signed: "#00A799",
  Cancelled: "#DC2626",
}

/**
 * Célula de custódia. Três situações diferentes que não podem virar a mesma coisa:
 * conta aberta (mostra o estado), custódia prevista mas ainda não aberta, e
 * contrato que por desenho não tem custódia nenhuma.
 */
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
  const [busca, setBusca] = useState("")

  const todos = useMemo(() => contracts.data?.items ?? [], [contracts.data])

  // Criador e campanha sao o que se procura; status e modalidade entram porque "assinado"
  // e "publipost" sao termos que a pessoa digita sem pensar que sao filtros.
  const items = useMemo(
    () => todos.filter((c) => matches(
      busca, c.influencerName, c.campaignName, tEnum("contractStatus", c.status),
      c.modality ? tEnum("contractModality", c.modality) : c.hybridCode)),
    [todos, busca],
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
                {todos.length} {todos.length === 1 ? "contrato" : "contratos"}
              </span>{" "}
              neste workspace. O documento é montado a partir do template da modalidade —
              você preenche os valores, as cláusulas vêm prontas.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {todos.length > 0 && (
              <SearchBox
                value={busca}
                onChange={setBusca}
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
        ) : items.length === 0 && busca ? (
          <NoResults query={busca} onClear={() => setBusca("")} />
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
                        {it.status === "Draft" && <ExcluirRascunho item={it} />}
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && <CreateContractModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

/**
 * Exclusão de rascunho, com confirmação.
 *
 * <p>Confirmar em dois passos no proprio botao, sem caixa de dialogo: a acao e' pequena e
 * reversivel pelo esforco (basta criar outro rascunho), e um modal para isso interromperia
 * mais do que protege. O que ele protege e' o clique errado, e um segundo clique explicito
 * ja' resolve.</p>
 */
function ExcluirRascunho({ item }: { item: ContractSummary }) {
  const { remove } = useContractMutations()
  const [confirmando, setConfirmando] = useState(false)

  const excluir = async () => {
    try {
      await remove.mutateAsync(item.contractId)
      toast.success("Rascunho excluído.")
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível excluir.")
    }
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
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
        onClick={excluir}
        disabled={remove.isPending}
        className="text-[12px] font-medium px-2 py-1 rounded-md disabled:opacity-50"
        style={{ background: "#DC262615", color: "#DC2626" }}
      >
        {remove.isPending ? "Excluindo…" : "Confirmar"}
      </button>
      <button
        onClick={() => setConfirmando(false)}
        className="text-[12px] text-ink-muted px-1.5 py-1"
      >
        Cancelar
      </button>
    </span>
  )
}

function CreateContractModal({ onClose }: { onClose: () => void }) {
  const roster = useRoster()
  const campaigns = useCampaigns()
  const { create } = useContractMutations()
  const navigate = useNavigate()
  const contratosExistentes = useContracts()

  const [campaignId, setCampaignId] = useState("")
  /** Modalidade do avulso. Ignorada quando há campanha — lá ela é quem manda. */
  const [avulsaModality, setAvulsaModality] = useState("")
  const [influencerId, setInfluencerId] = useState("")
  const [usesEscrow, setUsesEscrow] = useState(true)
  /**
   * Ligado por padrão: é o fluxo que a regra descreve (assinado → depósito → produção →
   * aprovação → pagamento) sem os cliques entre um passo e outro. Desligar volta ao manual.
   */
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [reviewSlaDays, setReviewSlaDays] = useState("7")
  const [maxResubmissions, setMaxResubmissions] = useState("2")

  const people = useMemo(() => roster.data?.items ?? [], [roster.data])

  const repetidos = useMemo(
    () => campaignId && influencerId
      ? (contratosExistentes.data?.items ?? []).filter(
        (c) => c.campaignId === campaignId && c.influencerId === influencerId && c.status !== "Cancelled")
      : [],
    [contratosExistentes.data, campaignId, influencerId],
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

  const desligaEscrowSeNaoSuporta = (m: string) => {
    if (m && !supportsEscrow(m)) setUsesEscrow(false)
  }

  // Trocar de campanha pode desligar a custódia, porque troca a modalidade junto.
  const changeCampaign = (next: string) => {
    setCampaignId(next)
    if (next === "") desligaEscrowSeNaoSuporta(avulsaModality)
    else desligaEscrowSeNaoSuporta(
      openCampaigns.find((c) => c.campaignId === next)?.modality ?? "")
  }

  const changeModality = (next: string) => {
    setAvulsaModality(next)
    desligaEscrowSeNaoSuporta(next)
  }

  // Sem campanha a modalidade passa a ser obrigatória: é ela que resolve o template.
  const canSubmit = Boolean(modality) && Boolean(influencerId) && !create.isPending

  const submit = () => {
    if (!canSubmit) return
    const body: CreateContractBody = {
      campaignId: campaignId || null,
      influencerId,
      usesEscrow,
      autoAdvanceEscrow: usesEscrow && autoAdvance,
      modality: campaignId ? undefined : avulsaModality,
      reviewSlaDays: Number(reviewSlaDays) || undefined,
      maxResubmissions: Number(maxResubmissions) || undefined,
    }
    create.mutate(body, {
      onSuccess: (res) => {
        toast.success(
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
        toast.error(e instanceof ApiError ? e.message : "Não foi possível criar o contrato.")
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
                  {people.map((p) => (
                    <option key={p.influencerId} value={p.influencerId}>
                      {p.displayName || p.fullName} — {p.email}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Com o rascunho nascendo no aceite do convite, criar pela tela duplicava sem
                  ninguém perceber. Não bloqueia: dois trabalhos na mesma campanha existem. */}
              {repetidos.length > 0 && (
                <div className="rounded-lg p-3 text-[12px]" style={{ background: "#D9770615", color: "#B45309" }}>
                  Este criador já tem {repetidos.length === 1 ? "um contrato" : `${repetidos.length} contratos`} nesta
                  campanha ({repetidos.map((c) => tEnum("contractStatus", c.status).toLowerCase()).join(", ")}).{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => { onClose(); navigate(`/operations/contracts/${repetidos[0].contractId}`) }}
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
                    checked={usesEscrow}
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

