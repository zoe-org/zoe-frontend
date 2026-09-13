import { useMemo, useState } from "react"
import { Plus, X, Loader2, Users, UserPlus, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials, matches } from "@/pages/operations/format"
import {
  Field, Select, TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/pages/operations/shared"
import {
  useRoster, useRosterMutations, useCampaigns, payoutBlockReason, INFLUENCER_INVITE_PATH,
  useCampaign,
  type RosterItem, type AddInfluencerBody, type InviteInfluencerResponse,
  type CampaignBriefing,
} from "@/lib/api/operations"

// Cor por estado do KYC. Verificado é o único verde: os outros três são graus
// diferentes de "ainda não recebe", e recusado precisa saltar aos olhos.
// A primeira entrada é o fallback de valor desconhecido.
const KYC_COLOR: Record<string, string> = {
  NotStarted: "#6B7280",
  Pending: "#D97706",
  Verified: "#00A799",
  Rejected: "#DC2626",
}

export default function OperationsRosterPage() {
  const roster = useRoster()
  const [addOpen, setAddOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const all = useMemo(() => roster.data?.items ?? [], [roster.data])
  const [rel, setRel] = useState<string>("")

  const [busca, setBusca] = useState("")

  const items = useMemo(
    () => (rel ? all.filter((i) => i.relationshipStatus === rel) : all)
      // E-mail entra na busca porque e' o identificador que a pessoa tem em maos quando
      // veio de fora — de uma conversa, de uma planilha — e nem sempre sabe o nome exato
      // com que o criador foi cadastrado aqui.
      .filter((i) => matches(busca, i.displayName, i.fullName, i.email)),
    [all, rel, busca],
  )

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      {/* Hero */}
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
            {all.length > 0 && (
              <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por nome, e-mail…" />
            )}
          <RoleGate minRole="Admin">
            {/* Convidar nao depende de campanha: a marca monta elenco antes de existir
                acao, e o criador e da marca, nao do projeto. */}
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 mr-2 rounded-lg text-[13px] font-medium border border-border-soft"
            >
              <UserPlus className="w-3.5 h-3.5" /> Convidar criador
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar criador
            </button>
          </RoleGate>
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section style={{ background: "var(--surface)" }}>
        {roster.isLoading ? (
          <TableSkeleton />
        ) : roster.isError ? (
          <ErrorState onRetry={() => roster.refetch()} />
        ) : items.length === 0 && busca ? (
          <NoResults query={busca} onClear={() => setBusca("")} />
        ) : items.length === 0 ? (
          <EmptyBlock
            className="py-16"
            icon={<Users className="w-7 h-7" strokeWidth={1.5} />}
            message="Nenhum criador no elenco"
            hint="Adicione um criador para poder contratá-lo. Sem elenco não há contrato."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Criador</th>
                  <th className="text-left py-3 eyebrow font-semibold">País</th>
                  <th className="text-left py-3 eyebrow font-semibold">KYC</th>
                  <th className="text-left py-3 eyebrow font-semibold">Recebimento</th>
                  <th className="text-left py-3 eyebrow font-semibold">Contratos</th>
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Adicionado em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <RosterRow key={it.tenantInfluencerId} item={it} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {addOpen && <AddInfluencerModal onClose={() => setAddOpen(false)} />}
      {inviteOpen && <InviteToRosterModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}

function RosterRow({ item, index }: { item: RosterItem; index: number }) {
  const blocked = payoutBlockReason(item)
  const name = item.displayName || item.fullName
  return (
    <tr className="border-b border-border-soft hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors">
      <td className="px-8 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[12px]"
            style={{ background: `hsl(${index * 47 + 200}, 45%, 60%)` }}
          >
            {initials(item.fullName, item.email)}
          </div>
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-2" style={{ color: "var(--ink)" }}>
              {name}
              {item.status !== "Active" && (
                <span className="chip text-[10px]">{tEnum("rosterStatus", item.status)}</span>
              )}
            </div>
            <div className="font-mono-zoe text-[11.5px] text-ink-muted truncate">{item.email}</div>
          </div>
        </div>
      </td>
      <td className="py-3.5 font-mono-zoe text-ink-2">{item.countryCode ?? "—"}</td>
      <td className="py-3.5">
        <StatusChip status={item.kycStatus} kind="kycStatus" colors={KYC_COLOR} />
      </td>
      <td className="py-3.5 text-ink-muted text-[12.5px]">
        {blocked ?? <span style={{ color: "var(--color-teal-500)" }}>liberado</span>}
      </td>
      <td className="py-3.5 font-mono-zoe text-ink-2">{item.contractCount}</td>
      <td className="px-8 py-3.5 font-mono-zoe text-ink-2">{fmtDate(item.addedAt)}</td>
    </tr>
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

  // Ordem do fluxo, não alfabética: é a jornada do criador com a marca.
  const ORDER = ["Convidado", "Aceito", "Contratado", "Active", "Paused", "ConviteExpirado", "Archived"]
  const present = ORDER.filter((k) => counts.has(k))

  if (present.length <= 1) return null

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
    </div>
  )
}

function TabButton({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors"
      style={
        active
          ? { background: "var(--color-teal-500)", color: "#fff" }
          : { color: "var(--ink-muted)", border: "1px solid var(--border-soft)" }
      }
    >
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  )
}

/**
 * Convite de criador — proposta de trabalho ou chamada para o elenco.
 *
 * A diferença para "Adicionar criador" é quem assume o cadastro: aqui a própria pessoa
 * cria a conta pelo link. É o caminho preferível, porque dados fiscais e conta de
 * recebimento são dela.
 *
 * <p>Duas portas de entrada, um convite só: escolher alguém que já está no elenco só
 * preenche e-mail e nome — o backend reaproveita o registro em vez de duplicar.</p>
 *
 * <p><b>Permuta não é campo.</b> O protótipo mostra um toggle ao lado do cachê, mas a
 * modalidade vem da campanha e o contrato a herda. Aqui ela é derivada: campanha de
 * permuta desliga o cachê e diz por quê, em vez de deixar alguém oferecer dinheiro que o
 * contrato não pode pagar.</p>
 */
function InviteToRosterModal({ onClose }: { onClose: () => void }) {
  const { invite } = useRosterMutations()
  const { data: campaignsData } = useCampaigns()
  const [tab, setTab] = useState<"roster" | "email">("roster")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [message, setMessage] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [deliverables, setDeliverables] = useState("")
  const [fee, setFee] = useState("")
  const [deadline, setDeadline] = useState("")
  const [search, setSearch] = useState("")
  const [sent, setSent] = useState<InviteInfluencerResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: rosterData } = useRoster()
  const people = rosterData?.items ?? []
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) =>
      (p.displayName || p.fullName).toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [people, search])

  // Campanhas encerradas não recebem convite — o domínio recusa, e oferecê-las na lista
  // só produziria um erro depois de a pessoa preencher tudo.
  const campaigns = (campaignsData?.items ?? []).filter(
    (c) => c.status !== "Completed" && c.status !== "Cancelled")
  const campaign = campaigns.find((c) => c.campaignId === campaignId)
  const isBarter = campaign?.modality === "Barter"

  // O briefing não vem na listagem — ele é do detalhe. Buscar sob demanda evita
  // engordar a lista de campanhas por causa de uma caixa que só aparece aqui.
  const { data: campaignDetail } = useCampaign(campaignId || undefined)
  const briefing = campaignDetail?.briefing

  const link = sent ? `${window.location.origin}/${INFLUENCER_INVITE_PATH}/${sent.token}` : ""

  const pick = (p: RosterItem) => {
    setEmail(p.email)
    setFullName(p.fullName)
  }

  const submit = async () => {
    try {
      const cents = fee.trim() ? Math.round(Number(fee.replace(",", ".")) * 100) : undefined

      const res = await invite.mutateAsync({
        campaignId: campaignId || undefined,
        email: email.trim(),
        fullName: fullName.trim(),
        message: message.trim() || undefined,
        // A proposta só existe com campanha. Sem ela o backend nem aceitaria.
        expectedDeliverables: campaignId ? deliverables.trim() || undefined : undefined,
        feeCents: campaignId && !isBarter ? cents : undefined,
        deliveryDeadline: campaignId && deadline
          ? new Date(`${deadline}T12:00:00`).toISOString()
          : undefined,
      })
      setSent(res)
      if (res.emailDelivery === "Sent") toast.success(`Convite enviado para ${res.email}.`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Esse criador já tem um convite pendente neste workspace.")
        return
      }
      toast.error(e instanceof ApiError ? e.message : "Não foi possível convidar.")
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Não foi possível copiar — selecione o link manualmente.")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border-soft shadow-2xl p-6 overflow-y-auto max-h-[88vh]"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Convidar influenciador"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="eyebrow mb-1">Proposta de trabalho</div>
            <h2 className="font-display m-0" style={{ fontSize: 20, color: "var(--ink)" }}>
              {sent ? "Convite criado" : "Convidar influenciador"}
            </h2>
            {!sent && (
              <p className="text-[12.5px] text-ink-muted m-0 mt-1">
                Escolha quem já trabalhou com você ou convide alguém novo por e-mail.
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <>
            {sent.emailDelivery !== "Sent" && (
              <div className="rounded-lg p-3 text-[12px] mb-4" style={{ background: "#D9770615", color: "#D97706" }}>
                {sent.emailDelivery === "Disabled"
                  ? "O envio de e-mail não está configurado neste ambiente."
                  : "O e-mail não saiu."}{" "}
                Mande o link abaixo — o convite já existe e é válido.
              </div>
            )}

            <div className="text-[11px] text-ink-muted mb-1.5">Link do convite</div>
            <div className="flex items-center gap-2 mb-4">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-2.5 py-2 rounded-lg border border-border-soft font-mono-zoe text-[11.5px] bg-transparent"
                style={{ color: "var(--ink)" }}
              />
              <button onClick={copy} className="px-2.5 py-2 rounded-lg border border-border-soft shrink-0" aria-label="Copiar link">
                {copied ? <Check className="w-3.5 h-3.5" style={{ color: "var(--color-teal-500)" }} />
                        : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[11.5px] text-ink-muted mb-5">
              Vence em {fmtDate(sent.expiresAt)}. Ele precisa entrar com o e-mail{" "}
              <span className="font-mono-zoe">{sent.email}</span>.{" "}
              {sent.campaignId
                ? "A proposta aparece na tela que ele abre — o que obriga alguém, porém, é o contrato assinado depois."
                : "As campanhas você amarra depois — este convite não o prende a nenhuma ação."}
            </p>

            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg text-[14px] font-medium text-white"
              style={{ background: "var(--color-teal-500)" }}
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-1 p-1 rounded-lg mb-5" style={{ background: "var(--surface-2, #F3F4F6)" }}>
              {([["roster", "Quem você já trabalhou"], ["email", "Convidar por e-mail"]] as const).map(
                ([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className="flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                    style={
                      tab === id
                        ? { background: "var(--color-teal-500)", color: "#fff" }
                        : { color: "var(--ink-muted)" }
                    }
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            <div className="space-y-4">
              {tab === "roster" ? (
                <>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                         placeholder="Buscar por nome…" />
                  <div
                    className="rounded-lg border border-border-soft overflow-y-auto"
                    style={{ maxHeight: 190 }}
                  >
                    {shown.length === 0 ? (
                      <p className="text-[12.5px] text-ink-muted px-3 py-4 m-0">
                        {people.length === 0
                          ? "Seu elenco está vazio. Use a outra aba para chamar alguém por e-mail."
                          : "Ninguém com esse nome no elenco."}
                      </p>
                    ) : (
                      shown.map((p, i) => {
                        const picked = p.email === email
                        return (
                          <button
                            key={p.tenantInfluencerId}
                            onClick={() => pick(p)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border-soft last:border-b-0 hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                            style={picked ? { background: "var(--color-teal-50, #F0FDFB)" } : undefined}
                          >
                            <div
                              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[11px]"
                              style={{ background: `hsl(${i * 47 + 200}, 45%, 60%)` }}
                            >
                              {initials(p.fullName, p.email)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                                {p.displayName || p.fullName}
                              </div>
                              <div className="font-mono-zoe text-[11px] text-ink-muted truncate">{p.email}</div>
                            </div>
                            {picked && (
                              <Check className="w-4 h-4 shrink-0" style={{ color: "var(--color-teal-500)" }} />
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Field label="Nome">
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                           placeholder="Como ele assina o contrato" />
                  </Field>
                  <Field
                    label="E-mail"
                    hint="Ela ainda não está na Zoe — vai receber um convite para se cadastrar e ver a proposta."
                  >
                    <Input value={email} onChange={(e) => setEmail(e.target.value)}
                           type="email" placeholder="criador@email.com" />
                  </Field>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Campanha" hint="Em branco convida só para o elenco.">
                  <Select value={campaignId} onChange={setCampaignId}>
                    <option value="">Sem campanha</option>
                    {campaigns.map((c) => (
                      <option key={c.campaignId} value={c.campaignId}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Modalidade" hint="Vem da campanha — o contrato herda.">
                  <div
                    className="px-2.5 py-2 rounded-lg border border-border-soft text-[13px]"
                    style={{ color: campaign ? "var(--ink)" : "var(--ink-muted)" }}
                  >
                    {campaign ? tEnum("contractModality", campaign.modality) : "—"}
                  </div>
                </Field>
              </div>

              {campaignId && (
                <>
                  <Field label="Entregáveis esperados">
                    <Input value={deliverables} onChange={(e) => setDeliverables(e.target.value)}
                           placeholder="1 vídeo dedicado, 12-18min" />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Cachê"
                      hint={isBarter ? "Permuta não move dinheiro." : "Valor bruto proposto, em reais."}
                    >
                      <Input
                        value={isBarter ? "" : fee}
                        onChange={(e) => setFee(e.target.value)}
                        disabled={isBarter}
                        inputMode="decimal"
                        placeholder={isBarter ? "permuta" : "12000"}
                      />
                    </Field>
                    <Field label="Prazo de entrega">
                      <Input type="date" value={deadline}
                             onChange={(e) => setDeadline(e.target.value)} />
                    </Field>
                  </div>

                  {briefing?.isAuditable && <BriefingBox briefing={briefing} />}
                </>
              )}

              <Field label="Mensagem pessoal" hint="Opcional. Aparece na tela que o criador abre.">
                <Input value={message} onChange={(e) => setMessage(e.target.value)}
                       placeholder="Adoraria contar com você nessa campanha!" />
              </Field>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[14px] border border-border-soft">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={invite.isPending || !email.trim() || !fullName.trim()}
                title={
                  !email.trim() || !fullName.trim()
                    ? "Escolha alguém do elenco ou preencha nome e e-mail."
                    : undefined
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[14px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-teal-500)" }}
              >
                {invite.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enviar convite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * O briefing auditável da campanha, em leitura.
 *
 * <p>Não é enfeite: são os critérios contra os quais a entrega vai ser medida
 * (RN-O-030). Quem aceita tem direito de ler antes o que vai ser cobrado depois — e a
 * marca, de conferir que está convidando para a campanha certa.</p>
 */
function BriefingBox({ briefing }: { briefing: CampaignBriefing }) {
  const rules = [
    briefing.requiresLogo &&
      `Logo visível${briefing.minLogoSeconds ? ` ≥ ${briefing.minLogoSeconds}s` : ""}`,
    `Sentimento ≥ ${tEnum("briefingSentiment", briefing.minSentiment).toLowerCase()}`,
    briefing.requiresConarDisclosure && "Disclosure CONAR (#publi)",
    briefing.deliverySlaDays && `SLA de ${briefing.deliverySlaDays} dias`,
    `Threshold de auditoria ${briefing.defaultAuditThreshold} pontos`,
  ].filter(Boolean) as string[]

  const tags: string[] = briefing.requiredHashtags ?? []
  const keywords: string[] = briefing.keywords ?? []

  return (
    <div className="rounded-lg border border-border-soft p-3" style={{ background: "var(--surface-2, #FAFBFC)" }}>
      <div className="eyebrow mb-1.5">Briefing auditável (somente leitura)</div>
      <p className="text-[12px] text-ink-2 m-0 leading-relaxed">{rules.join(" · ")}</p>
      {(tags.length > 0 || keywords.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((t) => (
            <span key={t} className="chip font-mono-zoe text-[10.5px]">#{t.replace(/^#/, "")}</span>
          ))}
          {keywords.map((k) => (
            <span key={k} className="chip text-[10.5px]">{k}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function AddInfluencerModal({ onClose }: { onClose: () => void }) {
  const { add } = useRosterMutations()
  const [form, setForm] = useState<AddInfluencerBody>({
    email: "", fullName: "", countryCode: "BR", displayName: "",
  })

  const set = <K extends keyof AddInfluencerBody>(k: K, v: AddInfluencerBody[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const canSubmit = emailOk && form.fullName.trim().length >= 2 && !add.isPending

  const submit = () => {
    if (!canSubmit) return
    add.mutate(
      {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        countryCode: form.countryCode?.trim() || undefined,
        displayName: form.displayName?.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          // `created: false` = a pessoa já existia na plataforma e só ganhou o
          // vínculo. Dizer "criado" nesse caso seria mentira, e é justamente a
          // diferença que explica por que o KYC dela pode já vir verificado.
          toast.success(
            res.created
              ? "Criador cadastrado e adicionado ao elenco."
              : "Criador já existia na plataforma — vínculo criado com este workspace.",
          )
          onClose()
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) {
            toast.error("Esse criador já está no elenco deste workspace.")
            return
          }
          toast.error(e instanceof ApiError ? e.message : "Não foi possível adicionar.")
        },
      },
    )
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
        aria-label="Adicionar criador ao elenco"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <div className="eyebrow mb-1.5">Elenco</div>
            <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
              Adicionar criador
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
          <Field label="E-mail" hint="Identifica a pessoa na plataforma inteira.">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="criador@exemplo.com"
              autoFocus
            />
          </Field>

          <Field label="Nome completo" hint="Como consta no contrato.">
            <Input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Maria Souza"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="País">
              <Input
                value={form.countryCode ?? ""}
                onChange={(e) => set("countryCode", e.target.value.toUpperCase().slice(0, 2))}
                placeholder="BR"
                maxLength={2}
              />
            </Field>
            <Field label="Nome de exibição" hint="Opcional.">
              <Input
                value={form.displayName ?? ""}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="@mariasouza"
              />
            </Field>
          </div>

          <p className="text-[12px] text-ink-muted">
            O KYC começa como não iniciado. Ele trava o recebimento, não a produção —
            o criador pode assinar contrato e gravar antes de concluí-lo.
          </p>
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
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {add.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

