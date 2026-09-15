import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useContractTimeline } from "@/lib/api/operations"

const COR_LINHA: Record<string, string> = {
  contract: "#6B7280",
  draft: "#D97706",
  delivery: "#2563EB",
  escrow: "#00A799",
}

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

/**
 * O que aconteceu com o contrato, em ordem. Antes era preciso juntar o detalhe do contrato, a fila
 * de entregas e o quadro de custódia para contar essa história — e as correções anteriores, com o
 * motivo de cada uma, não apareciam em lugar nenhum.
 *
 * <p>Recolhível no painel de revisão: lá ela é consulta ("o que foi pedido da outra vez?"), não o
 * assunto da tela, e aberta empurraria os botões de decisão para longe.</p>
 */
export function ContractTimeline({
  contractId, recolhivel = false,
}: {
  contractId: string
  recolhivel?: boolean
}) {
  const timeline = useContractTimeline(contractId)
  const [aberta, setAberta] = useState(!recolhivel)
  const itens = timeline.data?.items ?? []

  // Só "rascunho criado" não conta história nenhuma.
  if (timeline.isLoading || itens.length <= 1) return null

  return (
    <div className="rounded-xl border border-border-soft p-4" style={{ background: "var(--surface)" }}>
      {recolhivel ? (
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
          className="w-full flex items-center justify-between eyebrow"
        >
          <span>Linha do tempo do contrato ({itens.length})</span>
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform"
            style={{ transform: aberta ? "rotate(180deg)" : undefined }}
          />
        </button>
      ) : (
        <div className="eyebrow mb-3">Linha do tempo</div>
      )}

      {aberta && (
        <ol className={`m-0 p-0 list-none ${recolhivel ? "mt-3" : ""}`}>
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
      )}
    </div>
  )
}
