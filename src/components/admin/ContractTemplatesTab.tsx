import { useState } from "react"
import { AlertCircle, Loader2, ScrollText, ShieldCheck } from "lucide-react"
import { tEnum } from "@/i18n/enums"
import { apiMessage } from "@/lib/api-error"
import { notifyError, notifySuccess } from "@/lib/feedback"
import {
  useContractTemplates, useMarkTemplateLegalReviewed, type AdminContractTemplate,
} from "@/lib/api/admin"

/**
 * Aba de contratos da curadoria: o gate jurídico do módulo Operations (§4.3).
 *
 * Os textos dos templates vieram do PDF de referência — são **estrutura, não
 * parecer**. Enquanto a modalidade não tem parecer registrado, o domínio recusa
 * enviar qualquer contrato dela para assinatura, e do lado do contratante isso
 * aparece como um erro que ele não pode resolver. Esta tela é onde a Zoe resolve.
 *
 * <p>Registrar é **irreversível** no domínio: não existe "desrevisar" um template
 * que já ancorou contrato assinado — o caminho é publicar versão nova. Por isso a
 * ação é de dois passos, com o efeito escrito antes do clique que vale.</p>
 */
export function ContractTemplatesTab() {
  const list = useContractTemplates(true)
  const items = list.data?.items ?? []

  if (list.isLoading) return <div className="px-8 py-10"><PanelSkeleton /></div>

  if (list.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="w-10 h-10 mb-3" style={{ color: "var(--color-neg)" }} />
        <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>Não foi possível carregar</h3>
        <p className="text-sm text-ink-muted mb-4 max-w-100">
          {apiMessage(list.error, "Não foi possível carregar os templates.")}
        </p>
        <button
          onClick={() => list.refetch()}
          className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors cursor-pointer"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  const pending = list.data?.pendingLegalReview ?? 0
  const waiting = list.data?.draftContractsWaiting ?? 0

  return (
    <>
      <div className="px-8 pt-5 pb-2">
        <p className="text-[13.5px] text-ink-muted max-w-160 m-0 leading-relaxed">
          O texto que veio do documento de referência é estrutura, não parecer. Até a revisão ser registrada aqui,
          nenhum contrato daquela modalidade sai para assinatura — e quem contrata vê só o bloqueio, sem poder
          resolver.
        </p>
      </div>

      {items.length > 0 && (
        <div className="px-8 pb-5 pt-3">
          <div className="rounded-lg border border-border-soft grid grid-cols-3">
            {[
              {
                l: "Esperando parecer",
                v: pending,
                h: pending > 0 ? "modalidades bloqueadas para assinatura" : "nenhuma modalidade bloqueada",
                tone: pending > 0,
              },
              {
                l: "Liberadas",
                v: items.filter((t) => t.isLegalReviewed).length,
                h: "podem ir para assinatura",
              },
              {
                l: "Rascunhos parados",
                v: waiting,
                h: waiting > 0 ? "contratos travados pelo gate, somando os workspaces" : "nenhum contrato preso",
                tone: waiting > 0,
              },
            ].map((k, i) => (
              <div key={k.l} className={`px-5 py-4 ${i < 2 ? "border-r border-border-soft" : ""}`}>
                <div className="eyebrow">{k.l}</div>
                <div
                  className="font-display mt-1.5"
                  style={{ fontSize: 28, lineHeight: 1, color: k.tone ? "var(--color-warn)" : "var(--ink)" }}
                >
                  {k.v}
                </div>
                <div className="text-[11.5px] text-ink-muted mt-1.5">{k.h}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-8 pb-8">
        <div className="rounded-lg border border-border-soft overflow-hidden">
          {items.length === 0 ? (
            <div className="py-14 text-center text-[13.5px] text-ink-muted max-w-140 mx-auto leading-relaxed">
              Nenhum template no catálogo. Eles são semeados junto com o banco de campos — se a lista está vazia
              neste ambiente, o seed não rodou aqui, e não há o que liberar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 860 }}>
                <thead>
                  <tr className="border-b border-border-soft">
                    <Th>Modalidade</Th>
                    <Th align="right">Versão</Th>
                    <Th align="right">Campos</Th>
                    <Th>Custódia</Th>
                    <Th align="right">Rascunhos parados</Th>
                    <Th>Parecer jurídico</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => <TemplateRow key={t.templateId} template={t} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function TemplateRow({ template }: { template: AdminContractTemplate }) {
  const [confirming, setConfirming] = useState(false)
  const [notes, setNotes] = useState("")
  const mark = useMarkTemplateLegalReviewed()

  const label = tEnum("contractModality", template.modality)

  const registrar = () => {
    mark.mutate(
      { modality: template.modality, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          setConfirming(false)
          setNotes("")
          notifySuccess(`${label} liberada. Os contratos dessa modalidade já podem ir para assinatura.`)
        },
        onError: (e) => notifyError(e, `Não foi possível registrar o parecer de ${label}.`),
      },
    )
  }

  return (
    <>
      <tr className="border-b border-border-soft last:border-0">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ScrollText className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
            <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{label}</span>
          </div>
        </td>

        <td className="px-4 py-3 font-mono-zoe text-[12.5px] text-right" style={{ color: "var(--ink-2)" }}>
          v{template.version}
        </td>
        <td className="px-4 py-3 font-mono-zoe text-[12.5px] text-right" style={{ color: "var(--ink-2)" }}>
          {template.fieldsCount}
        </td>

        <td className="px-4 py-3 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
          {/* Sem custódia o pagamento corre fora da plataforma — quem revisa precisa
              saber disso antes de ler as cláusulas, porque muda o que o texto promete. */}
          {template.supportsEscrow ? "com escrow" : <span className="text-ink-muted">fora do escrow</span>}
        </td>

        <td className="px-4 py-3 font-mono-zoe text-[12.5px] text-right">
          <span style={{ color: template.draftContractsWaiting > 0 && !template.isLegalReviewed ? "var(--color-warn)" : "var(--ink-2)" }}>
            {template.draftContractsWaiting}
          </span>
        </td>

        <td className="px-4 py-3">
          {template.isLegalReviewed ? (
            <span className="chip chip-pos text-[10.5px] inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> registrado
            </span>
          ) : (
            <span className="chip chip-warn text-[10.5px]">pendente</span>
          )}
        </td>

        <td className="px-4 py-3 text-right">
          {template.isLegalReviewed ? (
            <span className="text-[12px] text-ink-muted">—</span>
          ) : (
            <button
              onClick={() => setConfirming((v) => !v)}
              className="h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors cursor-pointer"
            >
              {confirming ? "Cancelar" : "Registrar parecer"}
            </button>
          )}
        </td>
      </tr>

      {confirming && !template.isLegalReviewed && (
        <tr className="border-b border-border-soft">
          <td colSpan={7} className="px-4 pb-4 pt-0">
            <div className="rounded-lg border border-border-soft p-4" style={{ background: "#D9770608" }}>
              <div className="flex items-start gap-2.5 mb-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#D97706" }} />
                <p className="text-[12.5px] text-ink-2 m-0 leading-relaxed max-w-160">
                  Confirme só depois que o parecer existir de fato. Isto não tem volta: o texto de {label} v
                  {template.version} passa a ser imutável e qualquer correção exige publicar uma versão nova.
                  {template.draftContractsWaiting > 0 && (
                    <> Ao confirmar, {template.draftContractsWaiting} rascunho(s) desta modalidade ficam livres para ir
                      para assinatura.</>
                  )}
                </p>
              </div>

              <label className="eyebrow block mb-1.5">Referência do parecer (opcional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: parecer do escritório X, 21/09/2026"
                className="w-full max-w-140 h-9 px-3 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500"
              />
              <p className="text-[11.5px] text-ink-muted mt-1.5 mb-3">
                Fica na trilha de auditoria junto com quem registrou — é o que permite reconstruir depois em que
                parecer aquele contrato se apoiou.
              </p>

              <button
                onClick={registrar}
                disabled={mark.isPending}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {mark.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Confirmar revisão de {label}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className="eyebrow px-4 py-2.5 font-semibold" style={{ textAlign: align, whiteSpace: "nowrap" }}>
      {children}
    </th>
  )
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-4 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" style={{ width: `${85 - i * 12}%` }} />
      ))}
    </div>
  )
}
