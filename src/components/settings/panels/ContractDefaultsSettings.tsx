import { useMemo, useState } from "react"
import { Loader2, Save, ChevronDown } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { Input } from "@/components/ui/input"
import { SearchBox } from "@/components/operations/shared"
import { matches } from "@/lib/operations-format"
import {
  useContractDefaults, useUpdateContractDefaults, ESSENTIAL_CONTRACT_DEFAULTS, useCampaigns, useContracts,
  useSetAutoReleaseDefault,
  type ContractDefaultField,
} from "@/lib/api/operations"

/**
 * Sugestões mostradas como exemplo no campo vazio. Nunca são gravadas: texto jurídico é
 * decisão da marca, e um valor que ninguém escolheu não pode ir para o contrato sozinho.
 */
const EXEMPLO: Record<string, string> = {
  jurisdiction: "Ex.: Foro da Comarca de São Paulo/SP",
  applicable_law: "Ex.: Legislação brasileira",
  digital_signature: "Ex.: Assinatura eletrônica via Clicksign",
  contract_object: "Ex.: Criação e publicação de conteúdo publicitário nas redes do contratado",
  company_rep_name: "Ex.: Maria Souza, CPF 000.000.000-00, Diretora de Marketing",
  payment_terms: "Ex.: Pagamento em até 5 dias após a aprovação da entrega",
}

/**
 * Padrões de contrato da marca (RN-O-024, Nível 1).
 *
 * <p>O que a marca repete igual em todo contrato — foro, lei, cessões, multas — escrito uma
 * vez aqui. Todo contrato novo nasce com esses valores, e quem preenche pode trocar naquele
 * contrato. Os essenciais vêm primeiro; o resto do catálogo fica numa lista com busca,
 * porque ninguém quer rolar dezenas de campos para achar o foro.</p>
 */
export function ContractDefaultsTab({ isAdmin }: { isAdmin: boolean }) {
  const defaults = useContractDefaults()
  const salvar = useUpdateContractDefaults()
  const salvarLiberacao = useSetAutoReleaseDefault()

  const [edits, setEdits] = useState<Record<string, string>>({})
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [busca, setBusca] = useState("")
  const [todasModalidades, setTodasModalidades] = useState(false)

  // Modalidades que a marca de fato usa, pelas campanhas e contratos. O catálogo traz campos de
  // todos os templates publicados, e quem só faz publipost rolava dezenas de campos de permuta
  // e eventos que nunca vão aparecer num contrato seu.
  const campanhas = useCampaigns()
  const contratos = useContracts()
  const usadas = useMemo(() => new Set<string>([
    ...(campanhas.data?.items ?? []).map((c) => c.modality),
    ...(contratos.data?.items ?? []).map((c) => c.modality).filter((m): m is string => Boolean(m)),
  ]), [campanhas.data, contratos.data])

  const campos = useMemo(() => defaults.data?.fields ?? [], [defaults.data])

  const essenciais = useMemo(() => {
    const porNome = new Map(campos.map((c) => [c.placeholder, c]))
    return ESSENTIAL_CONTRACT_DEFAULTS
      .map((p) => porNome.get(p))
      .filter((c): c is ContractDefaultField => Boolean(c))
  }, [campos])

  const naoEssenciais = useMemo(() => {
    const essenciaisSet = new Set<string>(ESSENTIAL_CONTRACT_DEFAULTS)
    return campos.filter((c) => !essenciaisSet.has(c.placeholder))
  }, [campos])

  // Sem modalidade conhecida (marca nova, nada criado ainda) mostra tudo: esconder por falta de
  // dado faria o catálogo parecer vazio.
  const daMarca = naoEssenciais.filter((c) => !c.modalities?.length || c.modalities.some((m) => usadas.has(m)))
  const visiveis = usadas.size > 0 && !todasModalidades ? daMarca : naoEssenciais
  const outros = visiveis.filter((c) => matches(busca, c.label, c.helpText, c.placeholder))

  const definidos = campos.filter((c) => (c.value ?? "").trim()).length
  const dirty = Object.keys(edits).length > 0

  const valorDe = (c: ContractDefaultField) =>
    c.placeholder in edits ? edits[c.placeholder] : (c.value ?? "")

  const mudar = (c: ContractDefaultField, v: string) =>
    setEdits((atual) => {
      const proximo = { ...atual }
      // Voltou ao valor salvo: sai da lista de alterações, senão o botão ficaria ativo por
      // uma mudança que não existe mais.
      if (v === (c.value ?? "")) delete proximo[c.placeholder]
      else proximo[c.placeholder] = v
      return proximo
    })

  const enviar = async () => {
    try {
      await salvar.mutateAsync(edits)
      const n = Object.keys(edits).length
      setEdits({})
      notifySuccess(n === 1
        ? "Padrão salvo. Os próximos contratos já nascem com ele."
        : `${n} padrões salvos. Os próximos contratos já nascem com eles.`)
    } catch (e) {
      notifyError(e, "Não foi possível salvar os padrões.")
    }
  }

  if (defaults.isLoading) {
    return (
      <div className="flex items-center gap-2 text-ink-muted text-[13px]">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando padrões…
      </div>
    )
  }

  if (defaults.isError) {
    return <p className="text-[13px] text-ink-muted">Não foi possível carregar os padrões de contrato.</p>
  }

  return (
    <div>
      {/* Sem título próprio: o cabeçalho do diálogo de configurações já diz de que seção
          isto é, e um segundo <h2> logo abaixo dele competia com o primeiro. */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
            Padrões de contrato
          </div>
          <p className="text-[12.5px] text-ink-muted mt-0.5 mb-0 max-w-[600px]">
            Todo contrato novo nasce com estes valores, e dá para trocar em cada um. Contratos
            já criados não mudam — alguém pode ter ajustado o texto de propósito.
          </p>
          <p className="text-[12px] text-ink-muted mt-1.5 mb-0">
            <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{definidos}</span>{" "}
            {definidos === 1 ? "padrão definido" : "padrões definidos"}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={enviar}
            disabled={!dirty || salvar.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-45"
            style={{ background: "var(--color-teal-500)" }}
          >
            {salvar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {dirty ? `Salvar ${Object.keys(edits).length}` : "Salvar"}
          </button>
        )}
      </div>

      {!isAdmin && (
        <p className="text-[12.5px] text-ink-muted mb-4">
          Só Owner e Admin alteram os padrões. Você está vendo os valores atuais.
        </p>
      )}

      {/* Fora da lista de campos: não é texto do documento, é como o prazo de revisão age. Salva na
          hora, como um interruptor. */}
      <div className="rounded-xl border border-border-soft p-5 mb-5" style={{ background: "var(--surface)" }}>
        <label className={`flex items-start gap-2.5 ${isAdmin ? "cursor-pointer" : ""}`}>
          <input
            type="checkbox"
            checked={defaults.data?.autoReleaseOnTimeout ?? true}
            disabled={!isAdmin || salvarLiberacao.isPending}
            onChange={(e) => salvarLiberacao.mutate(e.target.checked, {
              onSuccess: (res) => notifySuccess(res.autoReleaseOnTimeout === false
                ? "Contratos novos passam a esperar a revisão mesmo depois do prazo."
                : "Contratos novos passam a aprovar a entrega quando o prazo de revisão vencer."),
              onError: (err) => notifyError(err, "Não foi possível salvar."),
            })}
            className="mt-0.5 accent-[var(--color-teal-500)] disabled:opacity-60"
          />
          <span>
            <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              Aprovar a entrega quando o prazo de revisão vencer
            </span>
            <span className="block text-[12px] text-ink-muted mt-0.5">
              Padrão dos contratos novos. Protege o criador de esperar sem resposta e nunca vale para entrega
              com auditoria reprovada. Cada contrato pode mudar no rascunho; os já criados não mudam.
            </span>
          </span>
        </label>
      </div>

      <div
        className="rounded-xl border border-border-soft p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5"
        style={{ background: "var(--surface)" }}
      >
        {essenciais.map((c) => (
          <CampoPadrao
            key={c.placeholder}
            campo={c}
            valor={valorDe(c)}
            onChange={(v) => mudar(c, v)}
            readOnly={!isAdmin}
            alterado={c.placeholder in edits}
          />
        ))}
      </div>

      {campos.length > essenciais.length && (
        <div className="mt-5">
          <button
            onClick={() => setMostrarTodos((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: "var(--color-teal-500)" }}
            aria-expanded={mostrarTodos}
          >
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform"
              style={{ transform: mostrarTodos ? "rotate(180deg)" : undefined }}
            />
            {mostrarTodos ? "Esconder os demais campos" : `Mostrar os demais campos (${visiveis.length})`}
          </button>

          {mostrarTodos && (
            <div
              className="mt-3 rounded-xl border border-border-soft p-5"
              style={{ background: "var(--surface)" }}
            >
              <SearchBox value={busca} onChange={setBusca} placeholder="Buscar campo…" className="w-full sm:max-w-[320px] mb-3" />
              {usadas.size > 0 && naoEssenciais.length > daMarca.length && (
                <label className="flex items-center gap-2 text-[12px] text-ink-muted mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={todasModalidades}
                    onChange={(e) => setTodasModalidades(e.target.checked)}
                    className="accent-[var(--color-teal-500)]"
                  />
                  Incluir campos de modalidades que você não usa ({naoEssenciais.length - daMarca.length})
                </label>
              )}
              {outros.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted m-0">Nenhum campo com esse nome.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  {outros.map((c) => (
                    <CampoPadrao
                      key={c.placeholder}
                      campo={c}
                      valor={valorDe(c)}
                      onChange={(v) => mudar(c, v)}
                      readOnly={!isAdmin}
                      alterado={c.placeholder in edits}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CampoPadrao({
  campo, valor, onChange, readOnly, alterado,
}: {
  campo: ContractDefaultField
  valor: string
  onChange: (v: string) => void
  readOnly: boolean
  alterado: boolean
}) {
  const longo = campo.dataType === "FreeText"

  return (
    <label className={`flex flex-col gap-1.5 ${longo ? "md:col-span-2" : ""}`}>
      <span className="text-[12.5px] font-medium flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
        {campo.label}
        {alterado && <span className="chip text-[10px]">não salvo</span>}
      </span>

      {campo.dataType === "Boolean" ? (
        // Três estados de propósito: "sem padrão" é diferente de "não". Um checkbox não
        // distinguiria a marca que decidiu "sem NDA" da que ainda não pensou nisso.
        <select
          value={valor}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full max-w-[220px] rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none disabled:opacity-60"
          style={{ color: "var(--ink)" }}
        >
          <option value="">Sem padrão</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      ) : longo ? (
        <textarea
          value={valor}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder={EXEMPLO[campo.placeholder] ?? ""}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-[13px] outline-none transition-colors focus-visible:border-ring resize-y disabled:opacity-60"
          style={{ color: "var(--ink)" }}
        />
      ) : (
        <Input
          value={valor}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          inputMode={campo.dataType === "Currency" || campo.dataType === "Percentage" ? "decimal" : undefined}
          placeholder={EXEMPLO[campo.placeholder] ?? ""}
        />
      )}

      {campo.helpText && <span className="text-[11.5px] text-ink-muted">{campo.helpText}</span>}
    </label>
  )
}
