import { useMemo, useState } from "react"
import { X, Loader2, Copy, Check } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { MoneyInput } from "@/components/ui/money-input"
import { parseBRLToCents } from "@/lib/money"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials } from "@/lib/operations-format"
import { Field, Select } from "@/components/operations/shared"
import {
  useRoster, useRosterMutations, useCampaigns, useCampaign, INFLUENCER_INVITE_PATH,
  type RosterItem, type InviteInfluencerResponse, type CampaignBriefing,
} from "@/lib/api/operations"

/*
 * Um convite só, venha de onde vier. Existiam dois: o do elenco, com proposta (cachê,
 * entregas, prazo), e o da campanha, só com nome e e-mail. Quem convidava pela campanha —
 * o caminho mais natural — gerava um contrato sem proposta para herdar, e o trabalho manual
 * que a herança tira voltava inteiro.
 */

/**
 * Convite de criador — proposta de trabalho ou chamada para o elenco.
 *
 * É a única forma de pôr alguém no elenco: a própria pessoa cria a conta pelo link, e é
 * essa conta que conecta o recebimento. Dados fiscais e conta bancária são dela.
 *
 * <p>Duas portas de entrada, um convite só: escolher alguém que já está no elenco só
 * preenche e-mail e nome — o backend reaproveita o registro em vez de duplicar.</p>
 *
 * <p><b>Permuta não é campo.</b> O protótipo mostra um toggle ao lado do cachê, mas a
 * modalidade vem da campanha e o contrato a herda. Aqui ela é derivada: campanha de
 * permuta desliga o cachê e diz por quê, em vez de deixar alguém oferecer dinheiro que o
 * contrato não pode pagar.</p>
 */
export function InviteCreatorModal({
  onClose, initialCampaignId,
}: {
  onClose: () => void
  /**
   * Campanha já escolhida — quando o convite parte da tela da campanha. Continua editável:
   * é ponto de partida, não trava.
   */
  initialCampaignId?: string
}) {
  const { invite, resendInvite } = useRosterMutations()
  const { data: campaignsData } = useCampaigns()
  const [tab, setTab] = useState<"roster" | "email">("roster")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [message, setMessage] = useState("")
  const [campaignId, setCampaignId] = useState(initialCampaignId ?? "")
  const [deliverables, setDeliverables] = useState("")
  const [fee, setFee] = useState("")
  const [deadline, setDeadline] = useState("")
  const [search, setSearch] = useState("")
  const [sent, setSent] = useState<InviteInfluencerResponse | null>(null)
  const [copied, setCopied] = useState(false)
  /** O convite da tela final foi reenviado, não criado. */
  const [resent, setResent] = useState(false)
  /** No reenvio, trocar a proposta pelos valores do formulário. Ligado: é por isso que se reenvia. */
  const [updateProposal, setUpdateProposal] = useState(true)
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()
  /**
   * Convite recusado por já existir. Fica dentro do modal, junto do que a pessoa preencheu: um
   * toast some em segundos e não diz o que fazer.
   */
  const [conflict, setConflict] = useState<{ code: string; message: string } | null>(null)

  const { data: rosterData } = useRoster()
  const people = useMemo(() => rosterData?.items ?? [], [rosterData])
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
    setConflict(null)
  }

  const submit = async () => {
    try {
      const cents = fee.trim() ? parseBRLToCents(fee) : undefined
      if (cents === null) {
        notifyError(null, "Cachê inválido — use o formato 12.000,00.")
        return
      }

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
      if (res.emailDelivery === "Sent") notifySuccess(`Convite enviado para ${res.email}.`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict({ code: e.code ?? "conflict", message: e.message })
        return
      }
      notifyError(e, "Não foi possível convidar.")
    }
  }

  // A saída do convite pendente: mesmo convite, link novo. Sem este botão a mensagem mandava
  // "reenviar o link" e não havia onde clicar.
  const hasProposal = Boolean(campaignId) && Boolean(deliverables.trim() || fee.trim() || deadline)

  const resend = async () => {
    try {
      const cents = fee.trim() && !isBarter ? parseBRLToCents(fee) : undefined
      if (cents === null) {
        notifyError(null, "Cachê inválido — use o formato 12.000,00.")
        return
      }
      const res = await resendInvite.mutateAsync({
        email: email.trim(),
        campaignId: campaignId || undefined,
        proposal: hasProposal && updateProposal
          ? {
            expectedDeliverables: deliverables.trim() || undefined,
            feeCents: cents,
            deliveryDeadline: deadline ? new Date(`${deadline}T12:00:00`).toISOString() : undefined,
          }
          : undefined,
      })
      setConflict(null)
      setResent(true)
      setSent(res)
      if (res.emailDelivery === "Sent") notifySuccess(`Convite reenviado para ${res.email}.`)
    } catch (e) {
      notifyError(e, "Não foi possível reenviar.")
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notifyError(null, "Não foi possível copiar — selecione o link manualmente.")
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Convidar influenciador"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="eyebrow mb-1">Proposta de trabalho</div>
            <h2 className="font-display m-0" style={{ fontSize: 20, color: "var(--ink)" }}>
              {sent ? (resent ? "Convite reenviado" : "Convite criado") : "Convidar influenciador"}
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
                    <Input value={email} onChange={(e) => { setEmail(e.target.value); setConflict(null) }}
                           type="email" placeholder="criador@email.com" />
                  </Field>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Campanha" hint="Em branco convida só para o elenco.">
                  <Select value={campaignId} onChange={(v) => { setCampaignId(v); setConflict(null) }}>
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
                      <MoneyInput
                        value={isBarter ? "" : fee}
                        onChange={setFee}
                        disabled={isBarter}
                        placeholder={isBarter ? "permuta" : "12.000,00"}
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

            {conflict && (
              <div
                className="rounded-lg p-3 text-[12.5px] mt-5"
                style={{ background: "#D9770615", color: "#B45309" }}
                role="alert"
              >
                <div className="font-medium mb-0.5">
                  {conflict.code === "influencer_already_invited" ? "Essa pessoa já aceitou" : "Já existe um convite pendente"}
                </div>
                <div>{conflict.message}</div>
                {conflict.code === "influencer_already_invited" && (
                  <a href="/operations/influencers" className="inline-block mt-1.5 underline">
                    Ver no elenco
                  </a>
                )}
                {conflict.code === "influencer_invite_pending" && (
                  <div className="mt-2.5">
                    <button
                      onClick={resend}
                      disabled={resendInvite.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50"
                      style={{ background: "#D97706" }}
                    >
                      {resendInvite.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Reenviar convite
                    </button>
                    {/* Quem reenviou quase sempre ajustou a proposta: sem esta opção, o novo cachê
                        digitado era descartado e o convite seguia com o antigo. */}
                    {hasProposal && (
                      <label className="flex items-center gap-2 text-[12px] mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={updateProposal}
                          onChange={(e) => setUpdateProposal(e.target.checked)}
                          className="accent-[#D97706]"
                        />
                        Atualizar a proposta com os valores deste formulário
                      </label>
                    )}
                    <div className="text-[11.5px] mt-1.5" style={{ opacity: 0.9 }}>
                      Gera um link novo para o mesmo convite
                      {hasProposal && updateProposal ? ", com a proposta deste formulário" : ", com a proposta enviada antes"}.
                      O link anterior deixa de valer.
                    </div>
                  </div>
                )}
              </div>
            )}

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
