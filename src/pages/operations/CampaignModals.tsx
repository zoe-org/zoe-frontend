import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { X, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { MoneyInput } from "@/components/ui/money-input"
import { parseBRLToCents, centsToBRLInput } from "@/lib/money"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { useFeature } from "@/features/auth/useFeature"
import { useTenantBrands } from "@/lib/api/brands"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/pages/operations/format"
import { Field, Select } from "@/pages/operations/shared"
import {
  useCampaignMutations, CAMPAIGN_MODALITIES, escrowRejectionReason, supportsEscrow,
  type CreateCampaignBody, type CampaignDetail,
  type CampaignBriefingInput, type BriefingSentiment, BRIEFING_SENTIMENTS,
} from "@/lib/api/operations"

/**
 * Edição do que ainda faz sentido mudar depois de criada. Modalidade fica fora: os
 * contratos já a herdaram, e trocá-la deixaria contrato e campanha discordando sobre que
 * acordo foi firmado — é a mesma razão pela qual o comando no backend não a aceita.
 */
export function EditCampaignModal({
  campaign, onClose,
}: {
  campaign: CampaignDetail
  onClose: () => void
}) {
  const { update } = useCampaignMutations(campaign.campaignId)
  const [name, setName] = useState(campaign.name)
  const [startsAt, setStartsAt] = useState(campaign.startsAt?.slice(0, 10) ?? "")
  const [endsAt, setEndsAt] = useState(campaign.endsAt?.slice(0, 10) ?? "")
  const [budget, setBudget] = useState(
    campaign.budgetCents > 0 ? centsToBRLInput(campaign.budgetCents) : "")
  const [notes, setNotes] = useState(campaign.notes ?? "")
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()

  // Briefing: texto separado por vírgula na tela, lista na API. É o formato que as pessoas
  // já usam para listar palavras, e evita um editor de tags só para isto.
  const b = campaign.briefing
  const [keywords, setKeywords] = useState(b.keywords.join(", "))
  const [hashtags, setHashtags] = useState(b.requiredHashtags.join(" "))
  const [requiresLogo, setRequiresLogo] = useState(b.requiresLogo)
  const [logoSeconds, setLogoSeconds] = useState(b.minLogoSeconds?.toString() ?? "")
  const [minSentiment, setMinSentiment] = useState<BriefingSentiment>(b.minSentiment)
  const [conar, setConar] = useState(b.requiresConarDisclosure)
  const [slaDays, setSlaDays] = useState(b.deliverySlaDays?.toString() ?? "")
  const [threshold, setThreshold] = useState(String(b.defaultAuditThreshold))

  const parseList = (raw: string) =>
    raw.split(/[,\s]+/).map((v) => v.trim()).filter((v) => v.length > 0)

  const briefing: CampaignBriefingInput = {
    keywords: parseList(keywords),
    requiredHashtags: parseList(hashtags),
    requiresLogo,
    // Enviar nulo quando logo não é exigido: é o que o domínio faz de qualquer forma, e
    // manter o número aqui deixaria a tela discordando do que foi salvo.
    minLogoSeconds: requiresLogo && logoSeconds ? Number(logoSeconds) : null,
    minSentiment,
    requiresConarDisclosure: conar,
    deliverySlaDays: slaDays ? Number(slaDays) : null,
    defaultAuditThreshold: threshold ? Number(threshold) : undefined,
  }

  const submit = () => {
    const budgetCents = budget.trim() ? parseBRLToCents(budget) : 0
    if (budgetCents === null) {
      toast.error("Orçamento inválido — use o formato 15.000,00.")
      return
    }
    update.mutate({
      name: name.trim(),
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      budgetCents,
      notes: notes.trim() || undefined,
      briefing,
    }, {
      onSuccess: () => {
        toast.success("Campanha atualizada.")
        onClose()
      },
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar."),
    })
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        /* Rolagem interna: com o briefing o formulário passa da altura da tela, e o
           botão de salvar não pode ficar fora de alcance. */
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface)" }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Editar campanha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="eyebrow mb-1">Campanhas</div>
            <h2 className="font-display m-0" style={{ fontSize: 20, color: "var(--ink)" }}>
              Editar campanha
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Fim">
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Orçamento (R$)" hint="Deixe vazio em permuta.">
            {/* Texto, não número: o campo de número recusa "15.000,00" e devolvia vazio, e o
                orçamento ia como zero sem ninguém ver. */}
            <MoneyInput value={budget} onChange={setBudget} placeholder="15.000,00" />
          </Field>
          <Field label="Observações">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="pt-2 border-t border-border-soft">
            <div className="eyebrow mb-1">Briefing auditável</div>
            <p className="text-[11.5px] text-ink-muted mb-3.5 mt-0">
              É a régua da conferência automática. O que ficar vazio não é verificado.
            </p>

            <div className="space-y-4">
              <Field label="Menções esperadas" hint="Separe por vírgula.">
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Nubank, Ultravioleta"
                />
              </Field>

              <Field label="Hashtags obrigatórias" hint="O # é adicionado se faltar.">
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="publi ultravioleta"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Logo obrigatório">
                  <Select
                    value={requiresLogo ? "sim" : "nao"}
                    onChange={(v) => setRequiresLogo(v === "sim")}
                  >
                    <option value="nao">Não exigir</option>
                    <option value="sim">Exigir</option>
                  </Select>
                </Field>
                <Field label="Segundos mínimos" hint={requiresLogo ? undefined : "só com logo exigido"}>
                  <Input
                    type="number"
                    min="1"
                    value={requiresLogo ? logoSeconds : ""}
                    disabled={!requiresLogo}
                    onChange={(e) => setLogoSeconds(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Tom esperado">
                <Select
                  value={minSentiment}
                  onChange={(v) => setMinSentiment(v as BriefingSentiment)}
                >
                  {BRIEFING_SENTIMENTS.map((sv) => (
                    <option key={sv} value={sv}>{tEnum("briefingSentiment", sv)}</option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Disclosure de publicidade"
                hint="Conteúdo pago sem identificação é irregular no Brasil."
              >
                <Select value={conar ? "sim" : "nao"} onChange={(v) => setConar(v === "sim")}>
                  <option value="sim">Exigir #publi</option>
                  <option value="nao">Não exigir</option>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="SLA de entrega (dias)">
                  <Input
                    type="number"
                    min="1"
                    value={slaDays}
                    onChange={(e) => setSlaDays(e.target.value)}
                  />
                </Field>
                {/* O número vive aqui em vez de na tela de entregas: é decisão da marca,
                    e cada contrato pode divergir dele depois (RN-O-057). */}
                <Field label="Nota mínima" hint="1 a 100. Padrão dos contratos.">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11.5px] text-ink-muted mt-4 mb-0">
          A modalidade não muda: os contratos desta campanha já a herdaram.
        </p>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[13.5px] border border-border-soft">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={update.isPending || name.trim().length < 3}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/** Cota vinda no `details` do Problem Details. Tudo opcional: a tela não pode quebrar
 *  se o formato mudar — o essencial é a mensagem, não o número. */
type Allowance = { limit?: number; used?: number; resetsAt?: string }

function readAllowance(e: ApiError): Allowance {
  const d = e.problem?.details
  if (d && typeof d === "object") {
    const { limit, used, resetsAt } = d as Record<string, unknown>
    return {
      limit: typeof limit === "number" ? limit : undefined,
      used: typeof used === "number" ? used : undefined,
      resetsAt: typeof resetsAt === "string" ? resetsAt : undefined,
    }
  }
  return {}
}

/**
 * Convite de upgrade, não mensagem de erro (RN-O-021). Duas coisas o texto precisa deixar
 * claras, porque são o ponto da regra: a campanha **não foi descartada**, e o limite volta
 * a zerar numa data conhecida — quem não quer pagar agora tem uma saída.
 */
function AllowanceModal({
  allowance, campaignName, onBack, onClose,
}: {
  allowance: Allowance
  campaignName: string
  onBack: () => void
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl p-6"
        style={{ background: "var(--surface)" }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Limite de campanhas do plano"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />
            <div className="eyebrow">Seu plano</div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 className="font-display m-0 mb-2" style={{ fontSize: 22, color: "var(--ink)" }}>
          Você usou as {allowance.limit ?? 5} campanhas deste mês
        </h2>

        <p className="text-[13.5px] text-ink-muted mb-4">
          {campaignName
            ? <>A campanha <span style={{ color: "var(--ink)" }}>“{campaignName}”</span> não
               foi descartada — ela só não foi criada ainda.</>
            : "Nada do que você preencheu foi descartado."}
          {" "}Com o plano Pro as campanhas passam a ser ilimitadas.
        </p>

        {allowance.resetsAt && (
          <div
            className="rounded-lg p-3 text-[12.5px] mb-5"
            style={{ background: "var(--bg, #F9FAFB)", color: "var(--ink-muted)" }}
          >
            Sem fazer upgrade, sua cota volta a {allowance.limit ?? 5} em{" "}
            <span style={{ color: "var(--ink)" }}>{fmtDate(allowance.resetsAt)}</span>.
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="flex-1 px-4 py-2.5 rounded-lg text-[13.5px] border border-border-soft"
          >
            Voltar ao rascunho
          </button>
          {/* Não existe fluxo de upgrade self-service: mandar para as configurações é o
              caminho honesto, em vez de um botão que não faz nada. */}
          <Link
            to="/plan"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-[13.5px] font-medium text-white"
            style={{ background: "var(--color-teal-500)" }}
          >
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  )
}

export function CreateCampaignModal({ onClose }: { onClose: () => void }) {
  const { create } = useCampaignMutations()
  const hasIntelligence = useFeature("intelligence")
  const brands = useTenantBrands()

  const [name, setName] = useState("")
  const [modality, setModality] = useState("Publipost")
  const [tenantBrandId, setTenantBrandId] = useState("")
  const [brandLabel, setBrandLabel] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [budget, setBudget] = useState("")
  const [limit, setLimit] = useState<Allowance | null>(null)
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()

  const brandList = useMemo(() => brands.data?.items ?? [], [brands.data])
  const useBrandPicker = hasIntelligence && brandList.length > 0

  const canSubmit = name.trim().length >= 3 && !create.isPending

  const submit = () => {
    if (!canSubmit) return
    const budgetCents = budget.trim() ? parseBRLToCents(budget) : 0
    if (budgetCents === null) {
      toast.error("Orçamento inválido — use o formato 15.000,00.")
      return
    }
    const body: CreateCampaignBody = {
      name: name.trim(),
      modality,
      tenantBrandId: useBrandPicker && tenantBrandId ? tenantBrandId : undefined,
      brandLabel: !useBrandPicker && brandLabel.trim() ? brandLabel.trim() : undefined,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      budgetCents,
    }
    create.mutate(body, {
      onSuccess: (res) => {
        toast.success(`Campanha "${res.name}" criada.`)
        onClose()
      },
      onError: (e) => {
        // RN-O-021 é explícita: o limite é soft-block **com modal de upgrade**. Cair no
        // toast genérico transformaria um convite de upgrade em mensagem de erro — e a
        // regra diz que a campanha não foi descartada, o que um toast não consegue dizer.
        if (e instanceof ApiError && e.code === "campaign_monthly_limit_reached") {
          setLimit(readAllowance(e))
          return
        }
        toast.error(e instanceof ApiError ? e.message : "Não foi possível criar a campanha.")
      },
    })
  }

  // A cota estourada substitui o formulário em vez de fechá-lo: o que a pessoa digitou
  // continua ali atrás, e ela volta ao rascunho se decidir não fazer upgrade agora.
  if (limit) {
    return (
      <AllowanceModal
        allowance={limit}
        campaignName={name.trim()}
        onBack={() => setLimit(null)}
        onClose={onClose}
      />
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nova campanha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <div className="eyebrow mb-1.5">Campanhas</div>
            <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
              Nova campanha
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
          <Field label="Nome">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lançamento Verão"
              autoFocus
            />
          </Field>

          <Field label="Marca" hint={useBrandPicker ? "Marcas assinadas no workspace." : "Sem Intelligence, o nome vai como texto."}>
            {useBrandPicker ? (
              <Select value={tenantBrandId} onChange={setTenantBrandId}>
                <option value="">Selecione…</option>
                {brandList.map((b) => (
                  <option key={b.tenantBrandId} value={b.tenantBrandId}>
                    {b.displayName ?? b.brandName}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={brandLabel} onChange={(e) => setBrandLabel(e.target.value)} placeholder="Nome da marca" />
            )}
          </Field>

          <Field label="Modalidade" hint="Todos os contratos da campanha herdam esta escolha.">
            <Select value={modality} onChange={setModality}>
              {CAMPAIGN_MODALITIES.map((m) => (
                <option key={m} value={m}>{tEnum("contractModality", m)}</option>
              ))}
            </Select>
          </Field>

          {!supportsEscrow(modality) && (
            <div
              className="rounded-lg p-3 text-[11.5px]"
              style={{ background: "#D9770615", color: "#D97706" }}
            >
              <span className="font-semibold">Sem custódia nesta modalidade.</span>{" "}
              {escrowRejectionReason(modality)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Prazo">
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>

          <Field label="Orçamento (R$)" hint="Zero para permuta.">
            <MoneyInput value={budget} onChange={setBudget} placeholder="15.000,00" />
          </Field>
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
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Criar campanha
          </button>
        </div>
      </div>
    </div>
  )
}
