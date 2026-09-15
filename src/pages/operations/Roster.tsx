import { useMemo, useState } from "react"
import { Users, UserPlus } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials, matches } from "@/pages/operations/format"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/pages/operations/shared"
import { InviteCreatorModal } from "@/pages/operations/InviteCreatorModal"
import {
  useRoster, payoutBlockReason,
  type RosterItem,
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
                acao, e o criador e da marca, nao do projeto.

                E' a unica porta de entrada. Existia tambem "Adicionar criador", que
                cadastrava sem avisar a pessoa: ela entrava no elenco sem conta, e sem
                conta nao conecta o recebimento — o contrato andava e o pagamento travava
                no fim. */}
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Convidar criador
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
            hint="Convide um criador: ele entra no elenco ao aceitar e passa a poder ser contratado."
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

      {inviteOpen && <InviteCreatorModal onClose={() => setInviteOpen(false)} />}
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
