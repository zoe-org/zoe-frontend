import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft, Loader2, AlertCircle, Lock, Send, Save, PenLine, ChevronRight, BookmarkPlus, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { parseBRLToCents } from "@/lib/money"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/pages/operations/format"
import { TableSkeleton } from "@/pages/operations/shared"
import {
  useContract, useContractDetailMutations, useEscrowMutations, useCustomClauseMutations,
  CUSTOM_CONTRACTS_UPGRADE_CODE,
  fieldInputKind, contractProgress, FIELD_SOURCE_LABEL, useUpdateContractDefaults, useContractDefaults,
  useContractTimeline,
  type ContractField, type ContractDetail, type ContractClause,
} from "@/lib/api/operations"


/** Lê `details.missing` de um Problem Details sem confiar no formato. */
function missingFromProblem(err: unknown): string[] {
  if (!(err instanceof ApiError)) return []
  const details = err.problem?.details as { missing?: unknown } | undefined
  const missing = details?.missing
  return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === "string") : []
}

export default function ContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>()
  const contract = useContract(contractId)
  const { saveFields, sendForSignature, markSigned, refreshSignature } = useContractDetailMutations(contractId)

  // Valores editados localmente. Só o que o usuário tocou vai no PATCH — o
  // backend faz merge por placeholder, então mandar o mundo inteiro seria ruído.
  const [edits, setEdits] = useState<Record<string, string>>({})
  /** Faltantes apontados pelo servidor na última tentativa de envio. */
  const [serverMissing, setServerMissing] = useState<string[]>([])
  /**
   * Mostra só os campos ainda vazios. Com o contrato nascendo quase todo preenchido, a
   * pergunta de quem abre deixa de ser "o que tem aqui" e passa a ser "o que falta" — rolar
   * quarenta campos cheios para achar os três vazios devolveria o trabalho que a herança tirou.
   */
  const [soVazios, setSoVazios] = useState(false)
  const salvarPadrao = useUpdateContractDefaults()
  const padroesMarca = useContractDefaults()

  const data = contract.data
  const fields = useMemo<ContractField[]>(
    () => (data?.fields ?? []).map((f) => (f.placeholder in edits ? { ...f, value: edits[f.placeholder] } : f)),
    [data?.fields, edits],
  )
  const progress = useMemo(() => contractProgress(fields), [fields])
  const dirty = Object.keys(edits).length > 0

  if (contract.isLoading) return <TableSkeleton rows={5} />

  if (contract.isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
        <h3 className="text-lg font-semibold mb-1">Contrato não encontrado</h3>
        <Link to="/operations/contracts" className="text-[13px] underline" style={{ color: "var(--color-teal-500)" }}>
          Voltar para contratos
        </Link>
      </div>
    )
  }

  const isDraft = data.status === "Draft"

  // Datas que já passaram, num rascunho. Herdadas de uma campanha antiga, elas pareciam
  // combinadas e iam para a assinatura sem ninguém notar.
  const hoje = new Date().toISOString().slice(0, 10)
  const datasVencidas = isDraft
    ? fields.filter((f) =>
      ["start_date", "end_date", "publish_deadline", "creation_deadline"].includes(f.placeholder)
      && Boolean(f.value) && (f.value ?? "") < hoje)
    : []

  const propostaUsadaEm = isDraft ? data.proposalUsedByContractId ?? null : null

  // Pelo valor SALVO: é dele que a API tira o valor da custódia. "a combinar" passava pela
  // assinatura e só travava depois, com o contrato já assinado e o valor sem poder mudar.
  const campoValorTotal = data.fields.find((f) => f.placeholder === "total_value")
  const valorTotalSalvo = (campoValorTotal?.value ?? "").trim()
  const valorIlegivel = isDraft && data.usesEscrow && valorTotalSalvo !== "" && data.declaredTotalCents == null
  const missing = new Set([...data.missingRequiredFields, ...serverMissing])

  // Vazio pelo valor SALVO, não pelo que está sendo digitado: senão o campo sumiria da lista
  // na primeira tecla e levaria o foco junto. Ele sai do filtro depois de salvar.
  const salvos = new Map(data.fields.map((f) => [f.placeholder, f.value]))
  const vazio = (f: ContractField) => !f.isSystemManaged && !(salvos.get(f.placeholder) ?? "").trim()
  const vazios = fields.filter(vazio)
  // Obrigatório vazio primeiro: é ele que trava o envio.
  const visiveis = soVazios
    ? [...vazios].sort((a, b) => Number(missing.has(b.placeholder)) - Number(missing.has(a.placeholder)))
    : fields

  const padraoAtual = new Map((padroesMarca.data?.fields ?? []).map((c) => [c.placeholder, (c.value ?? "").trim()]))

  const tornarPadrao = (f: ContractField) => {
    const valor = (f.value ?? "").trim()
    if (!valor) return
    salvarPadrao.mutate({ [f.placeholder]: valor }, {
      onSuccess: () => toast.success(`“${f.label}” virou padrão. Os próximos contratos já nascem com ele.`),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar o padrão."),
    })
  }

  const setValue = (placeholder: string, value: string) => {
    setEdits((e) => ({ ...e, [placeholder]: value }))
    setServerMissing((m) => m.filter((p) => p !== placeholder))
  }

  const save = () => {
    if (!dirty) return
    saveFields.mutate(edits, {
      onSuccess: (res) => {
        setEdits({})
        toast.success(
          res.missingRequiredFields.length === 0
            ? "Campos salvos. Nenhum obrigatório pendente."
            : `Campos salvos. Faltam ${res.missingRequiredFields.length} obrigatórios.`,
        )
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar."),
    })
  }

  const send = () => {
    if (dirty) {
      toast.error("Salve os campos alterados antes de enviar.")
      return
    }
    sendForSignature.mutate(undefined, {
      onSuccess: () => toast.success("Contrato enviado para assinatura."),
      onError: (e) => {
        const code = e instanceof ApiError ? e.code : undefined
        if (code === "contract_fields_incomplete") {
          const list = missingFromProblem(e)
          setServerMissing(list)
          toast.error(`Faltam ${list.length} campos obrigatórios — estão marcados na lista.`)
          return
        }
        if (code === "template_not_legally_reviewed") {
          toast.error(
            "O template desta modalidade ainda não passou por revisão jurídica. Isso é liberado pela Zoe, não pelo workspace.",
          )
          return
        }
        toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar.")
      },
    })
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      <Header data={data} progress={progress} />

      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8" style={{ background: "var(--surface)" }}>
        {/* Campos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[15px] font-semibold m-0">Campos do contrato</h2>
              <button
                onClick={() => setSoVazios((v) => !v)}
                aria-pressed={soVazios}
                className="px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-colors"
                style={soVazios
                  ? { background: "var(--color-teal-500)", borderColor: "transparent", color: "#fff" }
                  : { borderColor: "var(--border-soft)", color: "var(--ink-muted)" }}
              >
                Só os vazios ({vazios.length})
              </button>
            </div>
            <RoleGate minRole="Admin">
              <div className="flex items-center gap-2">
                {isDraft && (
                  <button
                    onClick={save}
                    disabled={!dirty || saveFields.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft disabled:opacity-40 hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
                  >
                    {saveFields.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                )}
                {isDraft && (
                  <button
                    onClick={send}
                    disabled={sendForSignature.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--color-teal-500)" }}
                  >
                    {sendForSignature.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Enviar para assinatura
                  </button>
                )}
              </div>
            </RoleGate>
          </div>

          {!isDraft && (
            <p className="text-[12.5px] text-ink-muted mb-4">
              Contrato fora de rascunho: os campos ficam somente leitura.
            </p>
          )}

          {datasVencidas.length > 0 && (
            <div className="rounded-lg p-3 text-[12.5px] mb-4" style={{ background: "#D9770615", color: "#B45309" }}>
              <span className="font-medium">Datas no passado:</span>{" "}
              {datasVencidas.map((f) => f.label).join(", ")}. Confira antes de enviar para assinatura —
              o contrato nasceria com prazos já vencidos.
            </div>
          )}

          {valorIlegivel && (
            <div className="rounded-lg p-3 text-[12.5px] mb-4" style={{ background: "#D9770615", color: "#B45309" }}>
              <span className="font-medium">{campoValorTotal?.label ?? "Valor total"} ilegível:</span>{" "}
              “{valorTotalSalvo}” não é um valor em reais que a custódia consiga ler (ex.: 5.000,00).{" "}
              {data.autoAdvanceEscrow
                ? "Com pagamento automático, o envio para assinatura é recusado até corrigir."
                : "Assim, ela não abre sozinha depois da assinatura — e o valor assinado já não muda."}
            </div>
          )}

          {/* Sem isto o cachê vazio parecia herança quebrada: a proposta vale para um contrato
              só, e outro deste criador nesta campanha já a levou. */}
          {propostaUsadaEm && (
            <div
              className="rounded-lg p-3 text-[12.5px] mb-4 border border-border-soft"
              style={{ background: "var(--bg, #F9FAFB)", color: "var(--ink-2)" }}
            >
              <span className="font-medium" style={{ color: "var(--ink)" }}>Sem a proposta do convite:</span>{" "}
              ela já foi usada em{" "}
              <Link
                to={`/operations/contracts/${propostaUsadaEm}`}
                className="underline"
                style={{ color: "var(--color-teal-500)" }}
              >
                outro contrato deste criador nesta campanha
              </Link>
              . Cada proposta vale para um contrato — cachê, entregáveis e prazo deste ficam para
              você preencher.
            </div>
          )}

          {/* Duas colunas para o que e' curto. Um campo de data ocupando 1300px de
              largura nao ajuda ninguem a ler nem a preencher, e empurrava o formulario
              para uma rolagem que nao precisava existir. Texto longo continua inteiro. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            {visiveis.map((f) => (
              <div key={f.placeholder} className={campoLargo(f) ? "md:col-span-2" : undefined}>
                <FieldRow
                  field={f}
                  readOnly={!isDraft || f.isSystemManaged}
                  isMissing={missing.has(f.placeholder)}
                  edited={f.placeholder in edits}
                  onChange={(v) => setValue(f.placeholder, v)}
                  onMakeDefault={() => tornarPadrao(f)}
                  alreadyDefault={Boolean((f.value ?? "").trim()) && padraoAtual.get(f.placeholder) === (f.value ?? "").trim()}
                  savingDefault={salvarPadrao.isPending && salvarPadrao.variables?.[f.placeholder] !== undefined}
                />
              </div>
            ))}
          </div>

          {soVazios && vazios.length === 0 && (
            <p className="text-[12.5px] text-ink-muted mt-2">
              Nenhum campo vazio — tudo veio herdado ou já foi preenchido.
            </p>
          )}
        </div>

        {/* Coluna lateral */}
        <aside className="flex flex-col gap-6">
          <SignaturePanel
            data={data}
            onMarkSigned={() => markSigned.mutate(undefined, {
              onSuccess: () => toast.success("Contrato marcado como assinado."),
              onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar."),
            })}
            pending={markSigned.isPending}
            onRefreshSignature={() => refreshSignature.mutate(undefined, {
              // "Ainda não assinaram" não é erro: é a resposta do provedor, e diz o que falta.
              onSuccess: (r) => (r.changed ? toast.success(r.message) : toast.info(r.message)),
              onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível consultar a assinatura."),
            })}
            refreshing={refreshSignature.isPending}
          />

          <ContractTimeline contractId={data.contractId} />

          <ClausesPanel contract={data} />
        </aside>
      </div>
    </div>
  )
}

const COR_LINHA: Record<string, string> = {
  contract: "#6B7280",
  draft: "#D97706",
  delivery: "#2563EB",
  escrow: "#00A799",
}

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

/**
 * O que aconteceu com o contrato, em ordem. Antes era preciso juntar este detalhe, a fila de
 * entregas e o quadro de custódia para contar essa história — e as correções anteriores, com o
 * motivo de cada uma, não apareciam em lugar nenhum.
 */
function ContractTimeline({ contractId }: { contractId: string }) {
  const timeline = useContractTimeline(contractId)
  const itens = timeline.data?.items ?? []

  // Só "rascunho criado" não conta história nenhuma.
  if (timeline.isLoading || itens.length <= 1) return null

  return (
    <div className="rounded-xl border border-border-soft p-4" style={{ background: "var(--surface)" }}>
      <div className="eyebrow mb-3">Linha do tempo</div>
      <ol className="m-0 p-0 list-none">
        {itens.map((it, i) => (
          <li key={`${it.at}-${i}`} className="relative pl-5 pb-3 last:pb-0">
            {i < itens.length - 1 && (
              <span className="absolute left-[4px] top-3 bottom-0 w-px" style={{ background: "var(--border-soft)" }} />
            )}
            <span
              className="absolute left-0 top-1.5 w-[9px] h-[9px] rounded-full"
              style={{ background: COR_LINHA[it.kind] ?? "#6B7280" }}
            />
            <div className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>{it.title}</div>
            <div className="text-[11px] text-ink-muted">{fmtDataHora(it.at)}</div>
            {it.detail && (
              <div className="text-[11.5px] text-ink-muted mt-0.5 break-words">{it.detail}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Header({
  data, progress,
}: { data: ContractDetail; progress: { required: number; filled: number } }) {
  const pct = progress.required === 0 ? 100 : Math.round((progress.filled / progress.required) * 100)
  return (
    <section className="px-8 pt-6 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
      <Link
        to="/operations/contracts"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Contratos
      </Link>

      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">
            {tEnum("contractModality", data.modality ?? "")} · template v{data.templateVersion}
            {data.hybridCode && ` · ${data.hybridCode}`}
          </div>
          <h1 className="font-display m-0" style={{ fontSize: 30, lineHeight: 1.1, color: "var(--ink)" }}>
            {data.influencerName}
          </h1>
          <div className="text-[13px] text-ink-muted mt-1.5">
            {tEnum("contractStatus", data.status)}
            {data.signedAt && ` · assinado em ${fmtDate(data.signedAt)}`}
            {" · "}
            {data.usesEscrow ? "com custódia" : "sem custódia"}
            {" · revisão em "}{data.reviewSlaDays} dias
            {" · "}{data.maxResubmissions} correções
          </div>
        </div>

        <div className="min-w-52">
          <div className="flex items-center justify-between text-[12px] text-ink-muted mb-1.5">
            <span>Obrigatórios</span>
            <span className="font-mono-zoe">{progress.filled}/{progress.required}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: pct === 100 ? "var(--color-teal-500)" : "#D97706" }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Campos que pedem a linha inteira: texto corrido nao cabe em meia largura. */
function campoLargo(f: ContractField) {
  return f.dataType === "LongText"
    || f.dataType === "Text" && (f.helpText?.length ?? 0) > 40
}

function FieldRow({
  field, readOnly, isMissing, edited, onChange, onMakeDefault, savingDefault, alreadyDefault,
}: {
  field: ContractField
  readOnly: boolean
  isMissing: boolean
  /** Alterado nesta tela e ainda não salvo: a origem herdada deixou de ser verdade. */
  edited: boolean
  onChange: (v: string) => void
  onMakeDefault: () => void
  savingDefault: boolean
  /** O valor do campo já é o padrão salvo da marca: salvar de novo não mudaria nada. */
  alreadyDefault: boolean
}) {
  // Campo do registro já tem o cadeado "do registro": uma segunda etiqueta dizendo a mesma
  // coisa com outras palavras só faz a linha parecer mais complicada do que é.
  const origem = !edited && !field.isSystemManaged && field.source ? FIELD_SOURCE_LABEL[field.source] : null
  // Compara com o padrão salvo, não com a origem: depois de um clique em "usar como padrão"
  // o botão tem de sumir, mesmo com o campo ainda marcado como digitado neste contrato.
  const podeVirarPadrao = field.defaultable
    && Boolean((field.value ?? "").trim())
    && !alreadyDefault
  const kind = fieldInputKind(field.dataType)
  const value = field.value ?? ""

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
        {field.label}
        {/* Campo que o sistema preenche nunca falta — o asterisco ali seria cobrança de
            algo que ninguém tem como digitar. */}
        {field.isRequired && !field.isSystemManaged && <span style={{ color: "#DC2626" }}>*</span>}
        {/* A origem diz de onde o valor veio sem obrigar a pessoa a reler tudo para confiar
            nele. Some quando ela edita: a partir daí o valor é dela. */}
        {origem && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: "#00A79914", color: "var(--color-teal-500)" }}
          >
            {origem}
          </span>
        )}
        {field.isSystemManaged ? (
          <span
            className="chip text-[10px]"
            title="Identidade do registro. Vem do próprio contrato ou da campanha — não se digita."
          >
            <Lock className="w-2.5 h-2.5" /> do registro
          </span>
        ) : field.kind === "MachineActionable" && (
          <span
            className="chip text-[10px]"
            title="Campo que o sistema usa — alimenta auditoria, prazos ou valores. Não é só texto do documento."
          >
            usado pelo sistema
          </span>
        )}
      </span>

      {kind === "checkbox" ? (
        <input
          type="checkbox"
          checked={value === "true"}
          disabled={readOnly}
          onChange={(e) => onChange(String(e.target.checked))}
          className="w-4 h-4 accent-[var(--color-teal-500)] disabled:opacity-50"
        />
      ) : (
        <Input
          type={field.isSystemManaged ? "text" : kind}
          value={value}
          disabled={readOnly}
          readOnly={field.isSystemManaged}
          // Fonte monoespaçada no identificador: é para conferir caractere a caractere
          // contra o rodapé do PDF, não para ler como frase.
          className={field.isSystemManaged ? "font-mono-zoe text-[12px]" : undefined}
          step={field.dataType === "Currency" ? "0.01" : undefined}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={isMissing || undefined}
          // Pendencia nao e' erro. Antes todo campo obrigatorio vazio nascia com borda
          // vermelha e a frase "obrigatorio e ainda vazio" embaixo — a tela abria como um
          // alarme por algo que a pessoa simplesmente ainda nao fez. Agora e' uma marca
          // ambar discreta na lateral; o vermelho fica para quando o envio for tentado.
          style={isMissing ? { borderLeft: "3px solid #D97706" } : undefined}
        />
      )}

      {field.helpText && <span className="text-[11.5px] text-ink-muted">{field.helpText}</span>}

      {podeVirarPadrao && (
        <RoleGate minRole="Admin">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onMakeDefault() }}
            disabled={savingDefault}
            className="self-start inline-flex items-center gap-1 text-[11.5px] font-medium hover:opacity-70 disabled:opacity-50"
            style={{ color: "var(--color-teal-500)" }}
            title="Todo contrato novo desta marca passa a nascer com este valor."
          >
            {savingDefault ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
            Usar como padrão da marca
          </button>
        </RoleGate>
      )}
    </label>
  )
}

function SignaturePanel({
  data, onMarkSigned, pending, onRefreshSignature, refreshing,
}: {
  data: ContractDetail
  onMarkSigned: () => void
  pending: boolean
  onRefreshSignature: () => void
  refreshing: boolean
}) {
  return (
    <div className="rounded-xl border border-border-soft p-4">
      <div className="eyebrow mb-2">Assinatura</div>

      {!data.templateLegalReviewed && (
        <p className="text-[12px] text-[#D97706] mb-2.5">
          Template ainda sem revisão jurídica — o envio para assinatura é recusado até a Zoe liberar.
        </p>
      )}

      {data.signatureProviderRef && (
        <p className="font-mono-zoe text-[11px] text-ink-muted break-all mb-2.5">
          {data.signatureProviderRef}
        </p>
      )}

      {data.status === "SentForSignature" && (
        <RoleGate minRole="Admin">
          {/* A confirmação chega pelo webhook — mas webhook se perde, e em ambiente local
              ele nem chega. Sem este botão o contrato assinado ficava preso em "aguardando"
              e a única saída era chamar a API à mão. */}
          <button
            onClick={onRefreshSignature}
            disabled={refreshing}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border border-border-soft disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Já assinaram? Confirmar assinatura
          </button>
          <p className="text-[11px] text-ink-muted mt-2 mb-3">
            Enviado para a marca e para o criador. A confirmação costuma chegar sozinha;
            se demorar, consulte o provedor por aqui.
          </p>
        </RoleGate>
      )}

      {/* O atalho só existe sem provedor real: com a Clicksign ligada a API o recusa, e
          oferecer um botão que sempre falha era pior do que não ter botão. */}
      {data.status === "SentForSignature" && data.signatureProviderLive === false && (
        <RoleGate minRole="Admin">
          <button
            onClick={onMarkSigned}
            disabled={pending}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border border-dashed disabled:opacity-50"
            style={{ borderColor: "#D97706", color: "#D97706" }}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
            Marcar como assinado
          </button>
          <p className="text-[11px] text-ink-muted mt-2">
            Atalho de desenvolvimento. No produto quem dispara isto é o webhook do
            provedor de assinatura — este botão some quando o adapter existir.
          </p>
        </RoleGate>
      )}

      {data.status === "Signed" && data.usesEscrow && !data.escrowAccountId && (
        aguardandoAutomacao(data)
          ? (
            <p className="text-[12.5px] text-ink-muted flex items-start gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />
              <span>
                Assinado. A custódia abre sozinha pelo valor do contrato e a reserva é pedida
                em seguida — esta tela se atualiza sozinha.
              </span>
            </p>
          )
          : (
            <OpenEscrowPanel
              contractId={data.contractId}
              automationStalled={data.autoAdvanceEscrow}
              declaredTotalCents={data.declaredTotalCents ?? null}
            />
          )
      )}

      {data.status === "Signed" && data.escrowAccountId && (
        <p className="text-[12.5px]" style={{ color: "var(--color-teal-500)" }}>
          Assinado, com custódia aberta.{" "}
          {data.autoAdvanceEscrow && "Reserva e pagamento seguem sozinhos. "}
          <Link to="/operations/escrow" className="underline">Ver no quadro</Link>
        </p>
      )}

      {data.status === "Signed" && !data.usesEscrow && (
        <p className="text-[12.5px] text-ink-muted">
          Assinado. Este contrato não usa custódia — não há fluxo financeiro a abrir.
        </p>
      )}
    </div>
  )
}

/**
 * Abre a custódia de um contrato assinado.
 *
 * <p>Existe aqui, e não no quadro de custódia, porque é aqui que a pergunta aparece: o
 * contrato acabou de ser assinado e o próximo passo é reservar o dinheiro. A ordem
 * contrato assinado → depósito → produção é imutável (RN-O-034).</p>
 *
 * <p>A taxa da plataforma NÃO é pedida: ela é termo do contrato e a custódia herda. Pedir
 * de novo abriria espaço para divergir do que foi assinado.</p>
 */
/**
 * Janela em que a abertura automática ainda é esperada. Passado isso sem custódia, algo a
 * impediu (valor ilegível, teto do provedor) e a tela devolve o botão manual em vez de
 * deixar a pessoa esperando um passo que não vai acontecer.
 */
const AUTOMACAO_JANELA_MS = 5 * 60_000

function aguardandoAutomacao(data: ContractDetail): boolean {
  if (!data.autoAdvanceEscrow || !data.signedAt) return false
  return Date.now() - Date.parse(data.signedAt) < AUTOMACAO_JANELA_MS
}

/** Valor com centavos: é o que vai ser reservado, e arredondar aqui esconderia diferença. */
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function OpenEscrowPanel({
  contractId, automationStalled = false, declaredTotalCents = null,
}: { contractId: string; automationStalled?: boolean; declaredTotalCents?: number | null }) {
  const { open } = useEscrowMutations()
  const [amount, setAmount] = useState("")

  // O valor do contrato assinado é o único que a custódia aceita: com ele legível, não há o
  // que digitar. O campo só aparece quando o contrato não traz valor que dê para ler.
  const temValorDoContrato = declaredTotalCents != null && declaredTotalCents > 0

  const cents = parseBRLToCents(amount)
  const valid = temValorDoContrato || (cents !== null && cents > 0)

  const submit = async () => {
    if (!valid) return
    try {
      await open.mutateAsync(temValorDoContrato ? { contractId } : { contractId, amountCents: cents ?? undefined })
      toast.success("Custódia aberta. O próximo passo é o depósito.")
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível abrir a custódia.")
    }
  }

  return (
    <RoleGate allow={["Owner", "Admin", "Manager"]}>
      <div
        className="rounded-xl border p-4"
        style={{ background: "var(--surface)", borderColor: "var(--color-teal-500)" }}
      >
        <div className="text-[13.5px] font-medium mb-1" style={{ color: "var(--color-teal-500)" }}>
          Assinado — abra a custódia
        </div>
        <p className="text-[12.5px] text-ink-muted m-0 mb-3">
          {automationStalled
            ? "A abertura automática não aconteceu — confira se o valor total do contrato está legível, ou abra por aqui."
            : "O valor fica reservado no provedor antes de o criador começar a produzir. Nenhum centavo passa por conta da Zoe."}
        </p>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {temValorDoContrato ? (
            <div className="flex-1 min-w-[160px]">
              <div className="text-[11px] text-ink-muted mb-1.5">Valor do contrato assinado</div>
              <div
                className="h-9 flex items-center font-mono-zoe text-[15px] font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {brl(declaredTotalCents!)}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-[160px]">
              <div className="text-[11px] text-ink-muted mb-1.5">Valor bruto do contrato</div>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="15000,00"
              />
            </div>
          )}
          <button
            onClick={submit}
            disabled={!valid || open.isPending}
            className="self-end inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50 shrink-0"
            style={{ background: "var(--color-teal-500)" }}
          >
            {open.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {temValorDoContrato ? `Abrir custódia de ${brl(declaredTotalCents!)}` : "Abrir custódia"}
          </button>
        </div>

        <p className="text-[11.5px] text-ink-muted mt-2 mb-0">
          {temValorDoContrato
            ? "Valor e taxa vêm do contrato assinado e não mudam depois da assinatura."
            : "O contrato não tem valor total legível — informe o valor combinado. A taxa da plataforma vem do contrato."}
        </p>
      </div>
    </RoleGate>
  )
}

/**
 * Cláusulas do contrato, com edição das próprias — Nível 2 da personalização (RN-O-024).
 *
 * <p>Cláusula de sistema aparece com cadeado e sem qualquer controle: escrow, disclosure
 * CONAR e auditoria são imutáveis em todos os níveis. Não é o front decidindo isso — o
 * domínio recusa de qualquer forma; aqui a tela apenas não oferece o que seria negado.</p>
 *
 * <p>Sem o add-on, a resposta do backend traz <code>custom_contracts_required</code> e a
 * tela abre o convite de upgrade. Esconder o recurso converteria zero.</p>
 */
/**
 * Uma cláusula que abre no lugar.
 *
 * <p>O texto é o mesmo que vai para o PDF e para a tela do criador — a mesma composição
 * alimenta os três. Ler aqui e assinar outra coisa seria a divergência que o desenho do
 * contrato existe para impedir.</p>
 */
function ClausulaItem({ c }: { c: ContractClause }) {
  const [aberta, setAberta] = useState(false)

  return (
    <li className="border-b border-border-soft last:border-b-0">
      <button
        onClick={() => setAberta((v) => !v)}
        className="w-full text-left py-2 flex items-start gap-1.5 text-[12.5px]"
      >
        <ChevronRight
          className="w-3 h-3 mt-0.5 shrink-0 transition-transform"
          style={{
            color: "var(--ink-muted)",
            transform: aberta ? "rotate(90deg)" : undefined,
          }}
        />
        {c.isSystem && (
          <Lock className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--color-teal-500)" }} />
        )}
        <span className="flex-1" style={{ color: c.isSystem ? "var(--ink)" : "var(--ink-muted)" }}>
          {c.title}
        </span>
      </button>

      {aberta && (
        <p className="text-[12px] text-ink-2 leading-relaxed whitespace-pre-line pl-[18px] pb-3 m-0">
          {c.body?.trim()
            ? c.body
            : "Esta cláusula ainda não tem texto — ela é composta quando os campos do "
              + "contrato forem preenchidos."}
        </p>
      )}
    </li>
  )
}

function ClausesPanel({ contract }: { contract: ContractDetail }) {
  const clauses = contract.clauses
  const isDraft = contract.status === "Draft"

  const update = useCustomClauseMutations(contract.contractId)
  const [editing, setEditing] = useState(false)
  const [upgrade, setUpgrade] = useState(false)
  const [drafts, setDrafts] = useState<{ title: string; body: string }[]>([])

  // A faixa 50–89 identifica as próprias. Não há flag no DTO: a ordem É a semântica,
  // e derivar daqui evita um campo que pode divergir do que o domínio impõe.
  const isCustom = (order: number) => order >= 50 && order < 90

  const startEditing = () => {
    setDrafts(clauses.filter((c) => isCustom(c.order)).map((c) => ({ title: c.title, body: c.body })))
    setEditing(true)
  }

  const save = async () => {
    const clean = drafts.filter((d) => d.title.trim() && d.body.trim())
    try {
      await update.mutateAsync(clean)
      setEditing(false)
      toast.success(clean.length === 0 ? "Cláusulas próprias removidas." : "Cláusulas salvas.")
    } catch (e) {
      if (e instanceof ApiError && e.problem?.code === CUSTOM_CONTRACTS_UPGRADE_CODE) {
        setEditing(false)
        setUpgrade(true)
        return
      }
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar.")
    }
  }

  return (
    <div className="rounded-xl border border-border-soft p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="eyebrow">Cláusulas ({clauses.length})</div>
        {isDraft && !editing && (
          <RoleGate allow={["Owner", "Admin", "Manager"]}>
            <button
              onClick={startEditing}
              className="text-[11.5px] font-medium inline-flex items-center gap-1"
              style={{ color: "var(--color-teal-500)" }}
            >
              <PenLine className="w-3 h-3" /> Cláusulas próprias
            </button>
          </RoleGate>
        )}
      </div>

      {upgrade && (
        <div
          className="rounded-lg p-3 mb-3 text-[12.5px]"
          style={{ background: "#00A79912", border: "1px solid var(--color-teal-500)" }}
        >
          <div className="font-medium mb-0.5" style={{ color: "var(--color-teal-500)" }}>
            Cláusulas próprias são um add-on
          </div>
          <p className="m-0 text-ink-2">
            Preencher valores e ocultar campos você já pode. Acrescentar cláusulas ao
            contrato faz parte do pacote de contratos personalizados — fale com o time
            comercial para habilitar.
          </p>
          <button
            onClick={() => setUpgrade(false)}
            className="text-[11.5px] mt-2 underline text-ink-muted"
          >
            Entendi
          </button>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-2.5 mb-3">
          {drafts.map((d, i) => (
            <div key={i} className="rounded-lg border border-border-soft p-2.5 flex flex-col gap-2">
              <Input
                value={d.title}
                onChange={(e) =>
                  setDrafts((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
                placeholder="Título da cláusula"
              />
              <textarea
                value={d.body}
                onChange={(e) =>
                  setDrafts((p) => p.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))
                }
                placeholder="Texto da cláusula"
                rows={3}
                className="w-full px-2.5 py-2 rounded-lg border border-border-soft text-[13px] bg-transparent resize-y"
                style={{ color: "var(--ink)" }}
              />
              <button
                onClick={() => setDrafts((p) => p.filter((_, j) => j !== i))}
                className="self-start text-[11.5px] text-ink-muted underline"
              >
                Remover
              </button>
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setDrafts((p) => [...p, { title: "", body: "" }])}
              className="px-3 py-1.5 rounded-lg text-[12.5px] border border-border-soft"
            >
              + Adicionar cláusula
            </button>
            <button
              onClick={save}
              disabled={update.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--color-teal-500)" }}
            >
              {update.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Salvar
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg text-[12.5px] border border-border-soft"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* O corpo ja' vinha na resposta e a tela mostrava so' o titulo — quem quisesse ler
          o que esta' assinando tinha de baixar o PDF. Agora abre no lugar. */}
      <ol className="flex flex-col m-0 p-0 list-none">
        {clauses.map((c) => (
          <ClausulaItem key={c.order} c={c} />
        ))}
      </ol>
      <p className="text-[11px] text-ink-muted mt-3">
        As cláusulas com cadeado são de sistema (custódia, identificação publicitária,
        auditoria) e não são editáveis em nenhum plano.
      </p>
    </div>
  )
}
