import { useState } from "react"
import { Link } from "react-router-dom"
import { Download, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { creatorApi, type DataDeletionResult } from "@/lib/api/creator"
import { useConfirm } from "@/features/confirm/context"

/**
 * Os direitos do titular, na própria área do criador (LGPD, art. 18): baixar o que a Zoe guarda
 * sobre ele e pedir a exclusão. Fica no fim da página — não é tarefa do dia, mas precisa estar a
 * um clique, e não escondida atrás de um e-mail para o suporte.
 */
export function CreatorPrivacyCard() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result, setResult] = useState<DataDeletionResult | null>(null)

  const exportar = async () => {
    setExporting(true)
    try {
      const data = await creatorApi.exportMyData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
      const a = document.createElement("a")
      a.href = url
      a.download = "meus-dados-zoe.json"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      notifyError(e, "Não foi possível baixar seus dados.")
    } finally {
      setExporting(false)
    }
  }

  const excluir = async () => {
    const ok = await confirm({
      title: "Pedir a exclusão dos seus dados?",
      description: (
        <>
          Sua área de atuação, audiência, temas, apresentação, portfólio e redes declaradas são
          apagados agora. Nome, e-mail, CPF/CNPJ e o histórico de contratos e pagamentos ficam
          guardados pelo prazo que a lei exige. Não dá para desfazer.
        </>
      ),
      confirmLabel: "Pedir exclusão",
      tone: "danger",
    })
    if (!ok) return

    setDeleting(true)
    try {
      const res = await creatorApi.requestDataDeletion()
      setResult(res)
      await qc.invalidateQueries({ queryKey: ["creator-workspace"] })
      notifySuccess("Pedido de exclusão registrado.")
    } catch (e) {
      // A recusa com contrato em andamento traz a explicação — é ela que a pessoa precisa ler.
      notifyError(e, "Não foi possível registrar o pedido.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section
      className="mt-8 rounded-xl border border-border-soft p-5"
      style={{ background: "var(--surface)" }}
      aria-labelledby="seus-dados"
    >
      <div className="flex items-start gap-2.5 mb-3">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" />
        <div>
          <h2 id="seus-dados" className="text-[13.5px] font-semibold m-0" style={{ color: "var(--ink)" }}>
            Seus dados
          </h2>
          <p className="text-[12.5px] text-ink-muted m-0 mt-0.5">
            Baixe tudo o que a Zoe guarda sobre você ou peça a exclusão. Como tratamos seus dados
            está na <Link to="/privacy" target="_blank" className="text-teal-500 hover:underline">Política
            de Privacidade</Link>.
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={exportar}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium border border-border-soft disabled:opacity-50"
          style={{ color: "var(--ink)" }}
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Baixar meus dados
        </button>
        <button
          onClick={excluir}
          disabled={deleting || result !== null}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium border disabled:opacity-50"
          style={{ color: "#DC2626", borderColor: "#DC262640" }}
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Pedir exclusão dos dados
        </button>
      </div>

      {result && (
        <div className="mt-4 text-[12.5px] flex flex-col gap-2">
          <div>
            <div className="font-medium mb-1" style={{ color: "var(--ink)" }}>Apagado</div>
            <ul className="m-0 pl-5 list-disc text-ink-muted">{result.erased.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <div className="font-medium mb-1" style={{ color: "var(--ink)" }}>Guardado, e por quê</div>
            <ul className="m-0 pl-5 list-disc text-ink-muted">{result.retained.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      )}
    </section>
  )
}
