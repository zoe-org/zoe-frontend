import { Modal, ModalFooter } from "@/components/ui/modal"
import { useMemo, useState } from "react"
import { Sparkles } from "lucide-react"
import { useOpenSettings } from "@/components/settings/useSettings"
import { PLAN_TAB_PARAM } from "@/lib/plans"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { MoneyInput } from "@/components/ui/money-input"
import { parseBRLToCents, centsToBRLInput } from "@/lib/money"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { useFeature } from "@/features/auth/useFeature"
import { useTenantBrands } from "@/lib/api/brands"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/lib/operations-format"
import { Field } from "@/components/operations/shared"
import { SelectField } from "@/components/ui/select-field"
import {
  useCampaignMutations, CAMPAIGN_MODALITIES, escrowRejectionReason, supportsEscrow,
  type CreateCampaignBody, type CampaignDetail,
  type CampaignBriefingInput, type BriefingSentiment, BRIEFING_SENTIMENTS,
} from "@/lib/api/operations"

/** Edita o que ainda pode mudar; modalidade fica fora porque os contratos já a herdaram. */
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
      notifyError(null, "Orçamento inválido — use o formato 15.000,00.")
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
        notifySuccess("Campanha atualizada.")
        onClose()
      },
      onError: (e) =>
        notifyError(e, "Não foi possível salvar."),
    })
  }

  return (
    <Modal
      eyebrow="Campanhas"
      title="Editar campanha"
      description="A modalidade não muda: os contratos desta campanha já a herdaram."
      onClose={onClose}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Salvar"
          pending={update.isPending}
          disabled={name.trim().length < 3}
        />
      }
    >
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
                  <SelectField
                    value={requiresLogo ? "sim" : "nao"}
                    onChange={(v) => setRequiresLogo(v === "sim")}
                    ariaLabel="Logo obrigatório"
                    options={[
                      { key: "nao", label: "Não exigir" },
                      { key: "sim", label: "Exigir" },
                    ]}
                  />
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
                <SelectField
                  value={minSentiment}
                  onChange={(v) => setMinSentiment(v as BriefingSentiment)}
                  ariaLabel="Tom esperado"
                  options={BRIEFING_SENTIMENTS.map((sv) => ({
                    key: sv,
                    label: tEnum("briefingSentiment", sv),
                  }))}
                />
              </Field>

              <Field
                label="Disclosure de publicidade"
                hint="Conteúdo pago sem identificação é irregular no Brasil."
              >
                <SelectField
                  value={conar ? "sim" : "nao"}
                  onChange={(v) => setConar(v === "sim")}
                  ariaLabel="Disclosure de publicidade"
                  options={[
                    { key: "sim", label: "Exigir #publi" },
                    { key: "nao", label: "Não exigir" },
                  ]}
                />
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

    </Modal>
  )
}

/** Cota vinda no `details` do Problem Details. Tudo opcional: a tela não pode quebrar
 *  se o formato mudar — o essencial é a mensagem, não o número. */
type Allowance = { limit?: number; used?: number; resetsAt?: string; noPlan?: boolean }

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

/** Convite de upgrade (RN-O-021): a campanha não foi descartada e o limite zera numa data conhecida. */
function AllowanceModal({
  allowance, campaignName, noPlan = false, onBack, onClose,
}: {
  allowance: Allowance
  campaignName: string
  /** Workspace sem plano de Operations: o convite é para assinar, não para subir. */
  noPlan?: boolean
  onBack: () => void
  onClose: () => void
}) {
  const openSettings = useOpenSettings()
  return (
    <Modal
      eyebrow={<><Sparkles className="w-3 h-3" style={{ color: "var(--color-teal-500)" }} /> Seu plano</>}
      title={noPlan
        ? "Escolha um plano de Operations"
        : `Você usou as ${allowance.limit ?? 5} campanhas deste mês`}
      size="sm"
      onClose={onClose}
      footer={
        <ModalFooter
          onCancel={onBack}
          cancelLabel="Voltar ao rascunho"
          onSubmit={() => {
            onClose()
            openSettings("plano", { [PLAN_TAB_PARAM]: "operations" })
          }}
          submitLabel="Ver planos"
        />
      }
    >
      <p className="text-[13.5px] text-ink-muted m-0">
        {campaignName
          ? <>A campanha <span style={{ color: "var(--ink)" }}>“{campaignName}”</span> não
             foi descartada — ela só não foi criada ainda.</>
          : "Nada do que você preencheu foi descartado."}
        {noPlan
          ? " Campanhas fazem parte dos planos de Operations, que incluem contrato digital e custódia."
          : " Com o Operations Pro as campanhas passam a ser ilimitadas."}
      </p>

      {!noPlan && allowance.resetsAt && (
        // `bg-inset` e não `var(--bg, #F9FAFB)`: o fallback claro fixo não ia
        // para o modo escuro.
        <div className="rounded-lg p-3 text-[12.5px] bg-inset text-ink-muted">
          Sem fazer upgrade, sua cota volta a {allowance.limit ?? 5} em{" "}
          <span style={{ color: "var(--ink)" }}>{fmtDate(allowance.resetsAt)}</span>.
        </div>
      )}
    </Modal>
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

  const brandList = useMemo(() => brands.data?.items ?? [], [brands.data])
  const useBrandPicker = hasIntelligence && brandList.length > 0

  const canSubmit = name.trim().length >= 3 && !create.isPending

  const submit = () => {
    if (!canSubmit) return
    const budgetCents = budget.trim() ? parseBRLToCents(budget) : 0
    if (budgetCents === null) {
      notifyError(null, "Orçamento inválido — use o formato 15.000,00.")
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
        notifySuccess(`Campanha "${res.name}" criada.`)
        onClose()
      },
      onError: (e) => {
        // RN-O-021: cota estourada abre o modal de upgrade, não um toast de erro.
        if (e instanceof ApiError && e.code === "campaign_monthly_limit_reached") {
          setLimit(readAllowance(e))
          return
        }
        if (e instanceof ApiError && e.code === "operations_plan_required") {
          setLimit({ noPlan: true })
          return
        }
        notifyError(e, "Não foi possível criar a campanha.")
      },
    })
  }

  // A cota estourada substitui o formulário em vez de fechá-lo: o que a pessoa digitou
  // continua ali atrás, e ela volta ao rascunho se decidir não fazer upgrade agora.
  if (limit) {
    return (
      <AllowanceModal
        allowance={limit}
        noPlan={limit.noPlan}
        campaignName={name.trim()}
        onBack={() => setLimit(null)}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal
      eyebrow="Campanhas"
      title="Nova campanha"
      description="Os contratos nascem dentro dela e herdam a modalidade escolhida aqui."
      onClose={onClose}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Criar campanha"
          pending={create.isPending}
          disabled={!canSubmit}
        />
      }
    >
      <div className="flex flex-col gap-3.5">
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
              <SelectField
                value={tenantBrandId}
                onChange={setTenantBrandId}
                ariaLabel="Marca"
                placeholder="Selecione…"
                options={brandList.map((b) => ({
                  key: b.tenantBrandId,
                  label: b.displayName ?? b.brandName,
                }))}
              />
            ) : (
              <Input value={brandLabel} onChange={(e) => setBrandLabel(e.target.value)} placeholder="Nome da marca" />
            )}
          </Field>

          <Field label="Modalidade" hint="Todos os contratos da campanha herdam esta escolha.">
            <SelectField
              value={modality}
              onChange={setModality}
              ariaLabel="Modalidade"
              options={CAMPAIGN_MODALITIES.map((m) => ({
                key: m,
                label: tEnum("contractModality", m),
              }))}
            />
          </Field>

          {!supportsEscrow(modality) && (
            <div
              className="rounded-lg p-3 text-[11.5px]"
              style={{ background: "var(--warn-bg)", color: "var(--color-warn)" }}
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

    </Modal>
  )
}
