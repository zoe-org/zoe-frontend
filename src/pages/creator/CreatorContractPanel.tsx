import { useState } from "react"
import { Loader2, FileText, Lock, Download, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/pages/operations/format"
import { fmtCents } from "@/lib/api/operations"
import { useCreatorContract, creatorApi, type CreatorEngagement } from "@/lib/api/creator"

/**
 * O contrato pela ótica do criador.
 *
 * <p>Existe porque ele não conseguia ler o que assina — os endpoints de contrato exigem
 * tenant, e criador não tem. A tela mostra o mesmo texto que a marca vê e que vai para o
 * PDF: divergir aqui seria mostrar a ele um documento diferente do que ele assina.</p>
 */
export function CreatorContractPanel({ engagements }: { engagements: CreatorEngagement[] }) {
  const [selected, setSelected] = useState<string | null>(
    engagements[0]?.contractId ?? null)

  if (engagements.length === 0) {
    return (
      <div
        className="rounded-xl border border-border-soft p-6 text-center"
        style={{ background: "var(--surface)" }}
      >
        <FileText className="w-7 h-7 mx-auto mb-3 text-ink-muted" strokeWidth={1.5} />
        <p className="text-[13.5px] text-ink-muted m-0">
          Você ainda não tem contrato. Ele aparece aqui quando a marca emitir.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor só quando há mais de um: com um contrato só, a linha seria ruído. */}
      {engagements.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {engagements.map((e) => (
            <button
              key={e.contractId}
              onClick={() => setSelected(e.contractId)}
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft"
              style={selected === e.contractId
                ? { background: "var(--color-teal-500)", color: "#fff", borderColor: "transparent" }
                : undefined}
            >
              {e.campaignName}
            </button>
          ))}
        </div>
      )}

      {selected && <ContractView contractId={selected} />}
    </div>
  )
}

function ContractView({ contractId }: { contractId: string }) {
  const contract = useCreatorContract(contractId)
  const [downloading, setDownloading] = useState(false)

  const openPdf = async () => {
    setDownloading(true)
    try {
      const blob = await creatorApi.contractDocument(contractId)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener")
      // Revoga depois de dar tempo de a aba abrir; segurar para sempre vaza memória.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível abrir o PDF.")
    } finally {
      setDownloading(false)
    }
  }

  if (contract.isLoading) {
    return (
      <div className="flex items-center gap-2 text-ink-muted text-[13px] p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando contrato…
      </div>
    )
  }

  if (contract.isError || !contract.data) {
    return (
      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <AlertCircle className="w-6 h-6 mb-2" style={{ color: "#D97706" }} />
        <p className="text-[13px] text-ink-muted m-0">Não foi possível carregar o contrato.</p>
      </div>
    )
  }

  const c = contract.data

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow mb-1">{c.brandName}</div>
            <h2 className="font-display m-0" style={{ fontSize: 19, color: "var(--ink)" }}>
              {c.campaignName}
            </h2>
            <div className="text-[12.5px] text-ink-muted mt-1">
              {tEnum("contractModality", c.modalityLabel)}
              {" · "}{tEnum("contractStatus", c.status)}
              {c.signedAt && ` · assinado em ${fmtDate(c.signedAt)}`}
            </div>
          </div>

          <button
            onClick={openPdf}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                         : <Download className="w-3.5 h-3.5" />}
            Abrir PDF
          </button>
        </div>

        {/* O criador tem direito de ver quanto a plataforma retém — é o que a cláusula de
            sistema declara às partes, então a tela não pode esconder. */}
        {c.amountCents != null && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <Money label="Valor do contrato" value={c.amountCents} />
            <Money
              label={`Taxa da plataforma${c.takeRateBps ? ` (${(c.takeRateBps / 100).toFixed(0)}%)` : ""}`}
              value={c.takeRateCents ?? 0}
              muted
            />
            <Money label="Você recebe" value={c.netToInfluencerCents ?? 0} highlight />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <div className="eyebrow mb-4">Cláusulas</div>

        <div className="flex flex-col gap-5">
          {c.clauses.map((clause) => (
            <div key={clause.order}>
              <div className="flex items-baseline gap-2 flex-wrap mb-1">
                <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                  {clause.order}. {clause.title}
                </span>
                {/* Marcar é honestidade: cláusula de sistema não entra em negociação, e a
                    parte precisa saber disso ao ler, não ao tentar mudar. */}
                {clause.isSystem && (
                  <span
                    className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded"
                    style={{ background: "var(--bg, #F3F4F6)", color: "var(--ink-muted)" }}
                  >
                    <Lock className="w-2.5 h-2.5" /> cláusula fixa
                  </span>
                )}
              </div>
              <p className="text-[13px] text-ink-muted m-0 whitespace-pre-line">
                {clause.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {c.fields.length > 0 && (
        <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
          <div className="eyebrow mb-3">Dados preenchidos</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {c.fields.map((f) => (
              <div key={f.placeholder} className="flex justify-between gap-3 text-[12.5px]">
                <span className="text-ink-muted">{f.label}</span>
                {/* Campo em branco aparece como pendência, não some: contrato com lacuna
                    invisível é o que a pessoa descobre tarde. */}
                <span style={{ color: f.value ? "var(--ink)" : "#D97706" }}>
                  {f.value ?? "a preencher"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Money({
  label, value, muted, highlight,
}: {
  label: string
  value: number
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div>
      <div className="text-[11px] text-ink-muted mb-0.5">{label}</div>
      <div
        className="font-mono-zoe font-semibold"
        style={{
          fontSize: highlight ? 18 : 15,
          color: highlight ? "var(--color-teal-500)" : muted ? "var(--ink-muted)" : "var(--ink)",
        }}
      >
        {muted ? `− ${fmtCents(value)}` : fmtCents(value)}
      </div>
    </div>
  )
}
