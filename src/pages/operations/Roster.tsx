import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Users, X, ExternalLink, Loader2, Mail, FileText, Plus } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { EmptyBlock } from "@/components/ui/empty-block"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StatusChip } from "@/components/ui/status-chip"
import { DELIVERY_STATUS_COLOR } from "@/lib/status-colors"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials, matches, campaignLabel } from "@/lib/operations-format"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/components/operations/shared"
import { InviteCreatorModal } from "@/components/operations/InviteCreatorModal"
import {
  useRoster, useContracts, useRosterMutations, canReceivePayout, fmtCents,
  useDeliveries, useEscrowAccounts,
  type RosterItem,
} from "@/lib/api/operations"
import { AUDIENCE_SIZES } from "@/lib/api/creator"
import { SelectField } from "@/components/ui/select-field"
import { stagger } from "@/lib/motion"

/** Valor da aba do filtro de pagamento travado — não é um estado de relacionamento. */
const PAYMENT_STUCK = "pagamento-travado"

/** A situação da conta de recebimento numa só coluna, com o que fazer. */
function payoutState(it: RosterItem): { label: string; color: string; explanation: string } {
  if (canReceivePayout(it)) {
    return { label: "pode receber", color: "#00A799", explanation: "Conta de recebimento conectada e verificada." }
  }
  if (it.kycStatus === "Rejected") {
    return {
      label: "verificação recusada",
      color: "var(--color-neg)",
      explanation: "O provedor recusou a verificação. O criador revisa os dados pela área dele — daqui não há o que fazer além de avisá-lo.",
    }
  }
  if (it.hasStripeAccount || it.kycStatus === "Pending") {
    return {
      label: "em verificação",
      color: "var(--color-warn)",
      explanation: "A conta existe e está em verificação pelo provedor. O criador conclui pela área dele.",
    }
  }
  return {
    label: "sem conta",
    color: "var(--ink-muted)",
    explanation: "O criador ainda não conectou a conta de recebimento. Ele faz isso pela área dele; sem ela, pagamento aprovado espera.",
  }
}

/** Dinheiro já aprovado para ele, parado porque a conta não está pronta. */
const isPaymentStuck = (it: RosterItem) => (it.releasableCents ?? 0) > 0 && !canReceivePayout(it)

const NETWORKS: Record<string, { abbreviation: string; url: (handle: string) => string }> = {
  YouTube: { abbreviation: "YT", url: (h) => `https://www.youtube.com/@${h}` },
  Instagram: { abbreviation: "IG", url: (h) => `https://www.instagram.com/${h}` },
  TikTok: { abbreviation: "TT", url: (h) => `https://www.tiktok.com/@${h}` },
}

/**
 * Limpa o que vem antes do @ digitado pelo criador.
 *
 * Era só `^@`, e um valor salvo como "~@fulano" virava "@~@fulano" na tela,
 * porque o template prefixa o @ de novo. Tira tudo que não pode começar um
 * handle — @, ~, espaço — em vez de um caractere específico.
 */
const stripAt = (h: string) => h.trim().replace(/^[^A-Za-z0-9_.-]+/, "")

export default function OperationsRosterPage() {
  const roster = useRoster()
  const [inviteOpen, setInviteOpen] = useState(false)

  // O criador aberto vive na URL: é assim que a custódia e o funil da campanha trazem a pessoa
  // direto para cá, e o voltar do navegador fecha a gaveta.
  const [params, setParams] = useSearchParams()
  const selectedId = params.get("creator")
  /**
   * O id continua mandando (link direto e botão voltar), mas o item fica em
   * estado: ao fechar, o parâmetro some e o `Sheet` ainda precisa do conteúdo
   * para animar a saída. Sem isto a gaveta esvaziava antes de terminar de sair.
   */
  const [lastOpened, setLastOpened] = useState<RosterItem | null>(null)
  const openCreator = (item: RosterItem | null) => {
    if (item) setLastOpened(item)
    setParams((p) => {
      if (item) p.set("creator", item.influencerId)
      else p.delete("creator")
      return p
    })
  }

  const all = useMemo(() => roster.data?.items ?? [], [roster.data])
  const [rel, setRel] = useState<string>("")
  const [search, setSearch] = useState("")
  const [area, setArea] = useState("")
  const [audience, setAudience] = useState("")

  // Só as áreas que existem no elenco: oferecer as quinze do cadastro faria a maioria dar vazio.
  const areas = useMemo(
    () => [...new Set(all.map((i) => i.primaryArea).filter((a): a is string => Boolean(a)))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [all],
  )

  // Só as faixas que existem no elenco, na ordem de tamanho do cadastro.
  const audienceOptions = useMemo(
    () => AUDIENCE_SIZES.filter((a) => all.some((i) => i.audienceSize === a.value)),
    [all],
  )

  const items = useMemo(
    () => (rel === PAYMENT_STUCK ? all.filter(isPaymentStuck) : rel ? all.filter((i) => i.relationshipStatus === rel) : all)
      // E-mail também entra na busca.
      .filter((i) => !area || i.primaryArea === area)
      .filter((i) => !audience || i.audienceSize === audience)
      // Tópicos entram na busca: procurar criador para uma campanha é procurar
      // por assunto ("skincare", "review"), não pelo nome de quem você ainda
      // não sabe que existe.
      .filter((i) => matches(
        search, i.displayName, i.fullName, i.email, i.primaryArea, ...(i.topics ?? []))),
    [all, rel, search, area, audience],
  )

  const selectedCreator = selectedId ? all.find((i) => i.influencerId === selectedId) ?? null : null
  // Link direto resolve pelo id; o fechamento cai no último aberto.
  const drawerItem = selectedCreator ?? lastOpened

  const temRecorte = Boolean(search || area || audience || rel)
  const limparRecorte = () => { setSearch(""); setArea(""); setAudience(""); setRel("") }

  return (
    <div className="-m-6" style={{ color: "var(--ink)" }}>
      {/* Abertura: só o enquadramento. A contagem foi pra barra, ao lado do
          recorte que a muda — repetida aqui ela envelhecia a cada filtro. */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex-1 max-w-200 min-w-70">
            <div className="eyebrow mb-3">Operations · Elenco</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Criadores
            </h1>
            <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-200">
              A pessoa é única na plataforma — se ela já trabalha com outra marca, o cadastro
              só cria o vínculo com você.
            </p>
          </div>
          <RoleGate minRole="Admin">
            {/* Única entrada no elenco é o convite, que dá ao criador a conta que conecta o recebimento. */}
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium text-white transition-colors shrink-0 cursor-pointer"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Convidar criador
            </button>
          </RoleGate>
        </div>
      </section>

      {/* Barra de trabalho: o recorte à esquerda, o resultado e os filtros à
          direita. Gruda no topo porque o elenco cresce e rola. */}
      <section
        className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-x-4 gap-y-2.5 flex-wrap sticky top-0 z-10"
        style={{ background: "var(--surface)" }}
      >
        <RelationshipTabs items={all} value={rel} onChange={setRel} />

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-[12px] text-ink-muted whitespace-nowrap">
            {items.length === all.length
              ? `${all.length} ${all.length === 1 ? "criador" : "criadores"}`
              : `${items.length} de ${all.length} criadores`}
          </span>
          {temRecorte && (
            <button
              onClick={limparRecorte}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12px] rounded-lg text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
          {areas.length > 1 && (
            <SelectField
              value={area}
              onChange={setArea}
              ariaLabel="Filtrar por área"
              className="data-[size=default]:h-8 px-3 text-[12.5px] rounded-lg border-border-soft max-w-[190px]"
              options={[
                { key: "", label: "Todas as áreas" },
                ...areas.map((a) => ({ key: a, label: a })),
              ]}
            />
          )}
          {audienceOptions.length > 1 && (
            <SelectField
              value={audience}
              onChange={setAudience}
              ariaLabel="Filtrar por audiência"
              className="data-[size=default]:h-8 px-3 text-[12.5px] rounded-lg border-border-soft max-w-[190px]"
              options={[
                { key: "", label: "Qualquer audiência" },
                ...audienceOptions.map((a) => ({ key: a.value, label: a.label })),
              ]}
            />
          )}
          {all.length > 0 && (
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nome, e-mail, área…"
              className="w-44 sm:w-56"
            />
          )}
        </div>
      </section>

      <section style={{ background: "var(--surface)" }}>
        {roster.isLoading ? (
          <TableSkeleton />
        ) : roster.isError ? (
          <ErrorState onRetry={() => roster.refetch()} />
        ) : items.length === 0 && (search || area || audience) ? (
          <NoResults
            query={search || area || AUDIENCE_SIZES.find((a) => a.value === audience)?.label || ""}
            onClear={() => { setSearch(""); setArea(""); setAudience("") }}
          />
        ) : items.length === 0 ? (
          <EmptyBlock
            className="py-16"
            icon={<Users className="w-7 h-7" strokeWidth={1.5} />}
            message="Nenhum criador no elenco"
            hint="Convide um criador: ele entra no elenco ao aceitar e passa a poder ser contratado."
          />
        ) : (
          // `overflow-y-clip`: com só `overflow-x-auto` a spec promove o eixo Y
          // a `auto`, e o `z-rise` das linhas abriria uma barra fantasma.
          <div className="overflow-x-auto overflow-y-clip">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-soft">
                  {/* `px-3` nas colunas do meio: sem padding lateral os rótulos
                      encostavam um no outro — "RECEBIMENTOCONTRATOS". */}
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Criador</th>
                  <th className="text-left px-3 py-3 eyebrow font-semibold">Redes e audiência</th>
                  <th className="text-left px-3 py-3 eyebrow font-semibold">Atuação</th>
                  <th className="text-left px-3 py-3 eyebrow font-semibold">Recebimento</th>
                  <th className="text-right px-3 py-3 eyebrow font-semibold">Contratos</th>
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Última campanha</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <RosterRow key={it.tenantInfluencerId} item={it} index={i} onOpen={() => openCreator(it)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CreatorDrawer
        item={drawerItem}
        open={selectedCreator !== null}
        onClose={() => openCreator(null)}
      />
      {inviteOpen && <InviteCreatorModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}

function RosterRow({ item, index, onOpen }: { item: RosterItem; index: number; onOpen: () => void }) {
  const name = item.displayName || item.fullName
  const rec = payoutState(item)
  const networks = Object.entries(item.handles ?? {})
  const audiencia = AUDIENCE_SIZES.find((a) => a.value === item.audienceSize)?.label ?? null
  const topicos = item.topics ?? []

  return (
    // A linha inteira abre a gaveta; o nome é o botão, para teclado e leitor de tela.
    <tr
      onClick={onOpen}
      className="border-b border-border-soft hover:bg-hover transition-colors cursor-pointer z-rise"
      style={stagger(Math.min(index, 12))}
    >
      <td className="px-8 py-3.5 align-top">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[12px]"
            style={{ background: `hsl(${index * 47 + 200}, 45%, 60%)` }}
          >
            {initials(item.fullName, item.email)}
          </div>
          <div className="min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); onOpen() }}
              className="font-medium flex items-center gap-2 text-left hover:underline"
              style={{ color: "var(--ink)" }}
            >
              {name}
              {item.status !== "Active" && (
                <span className="chip text-[10px]">{tEnum("rosterStatus", item.status)}</span>
              )}
            </button>
            <div className="font-mono-zoe text-[11.5px] text-ink-muted truncate">{item.email}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5 text-[12px] text-ink-2 align-top">
        {networks.length === 0
          ? <span className="text-ink-muted">—</span>
          : networks.map(([network, handle]) => (
            <span key={network} className="mr-2 whitespace-nowrap">
              <span className="text-ink-muted">{NETWORKS[network]?.abbreviation ?? network}</span> @{stripAt(handle)}
            </span>
          ))}
        {/* A audiência era filtrável e invisível: dava para recortar por "50 mil
            a 200 mil" e nenhuma coluna dizia em qual faixa cada um estava. */}
        {audiencia && (
          <div className="text-[11.5px] text-ink-muted mt-0.5">{audiencia}</div>
        )}
      </td>
      <td className="px-3 py-3.5 text-[12.5px] text-ink-2 align-top">
        {item.primaryArea ?? <span className="text-ink-muted">—</span>}
        {/* Tópicos são o que se procura ao montar uma campanha. Três, porque a
            coluna é estreita e o resto vive na gaveta. */}
        {topicos.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {topicos.slice(0, 3).map((t) => (
              <span key={t} className="chip text-[10px]">{t}</span>
            ))}
            {topicos.length > 3 && (
              <span className="text-[10.5px] text-ink-muted-2 self-center">
                +{topicos.length - 3}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-3.5 text-[12.5px] align-top">
        <span style={{ color: rec.color }}>{rec.label}</span>
        {isPaymentStuck(item) && (
          <div className="text-[11px] font-medium" style={{ color: "var(--color-neg)" }}>
            {fmtCents(item.releasableCents ?? 0)} esperando
          </div>
        )}
      </td>
      <td className="px-3 py-3.5 font-mono-zoe text-ink-2 text-right align-top">{item.contractCount}</td>
      <td className="px-8 py-3.5 text-[12.5px] text-ink-2 align-top">
        {item.lastContractAt
          ? <>{campaignLabel(item.lastCampaignName)} <span className="text-ink-muted">· {fmtDate(item.lastContractAt)}</span></>
          : <span className="text-ink-muted">—</span>}
      </td>
    </tr>
  )
}

/** O criador por inteiro: conta, cadastro declarado e contratos com este workspace. */
function CreatorDrawer({ item, open, onClose }: {
  item: RosterItem | null
  open: boolean
  onClose: () => void
}) {
  // Hooks antes do guard: a gaveta fica montada enquanto anima a saída, e um
  // retorno adiantado aqui mudaria a ordem deles entre renders.
  const contracts = useContracts()
  const deliveries = useDeliveries()
  const escrows = useEscrowAccounts()

  if (!item) return null

  const creatorContracts = (contracts.data?.items ?? []).filter((c) => c.influencerId === item.influencerId)

  // Histórico do trabalho com este criador. As entregas vêm pela lista de contratos dele (a fila
  // não traz o id do criador); os pagamentos, pelas custódias já liberadas.
  const contractIds = new Set(creatorContracts.map((c) => c.contractId))
  const creatorDeliveries = (deliveries.data?.items ?? [])
    .filter((d) => contractIds.has(d.contractId))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const creatorPayments = (escrows.data?.items ?? [])
    .filter((e) => e.influencerId === item.influencerId && e.state === "Released")

  const rec = payoutState(item)
  const audience = AUDIENCE_SIZES.find((a) => a.value === item.audienceSize)?.label
  const networks = Object.entries(item.handles ?? {})
  const topics = item.topics ?? []

  return (
    // `Sheet`, como o drawer de menções: mesmo overlay, mesma animação e o foco
    // resolvido pelo Radix. Era uma casca à mão, com `useFocusTrap` e
    // `useEscapeKey` próprios — dois drawers com comportamentos parecidos, mas
    // não idênticos.
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        // X embutido desligado: ele é absoluto e some sob o cabeçalho fixo.
        showCloseButton={false}
        // Inline porque o `SheetContent` embute `sm:max-w-sm`, que vence
        // utilitário por especificidade.
        style={{ width: 520, maxWidth: "94vw" }}
        className="p-0 overflow-y-auto gap-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Criador {item.fullName}</SheetTitle>
        </SheetHeader>

        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border-soft"
          style={{ background: "var(--surface)" }}
        >
          <div className="eyebrow">Criador</div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-border-soft text-ink-muted hover:text-ink hover:bg-tint transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* Identidade com a mesma inicial colorida da lista: abrir a gaveta
              não deveria fazer duvidar se é a mesma pessoa da linha clicada. */}
          <div className="flex items-start gap-3.5">
            <div
              className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[14px]"
              style={{ background: `hsl(${(item.fullName.length * 47 + 200) % 360}, 45%, 60%)` }}
              aria-hidden
            >
              {initials(item.fullName, item.email)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display m-0" style={{ fontSize: 21, lineHeight: 1.15, color: "var(--ink)" }}>
                {item.displayName || item.fullName}
              </h2>
              <div className="font-mono-zoe text-[12px] text-ink-muted mt-1 truncate">{item.email}</div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <span className="chip text-[10.5px]">{tEnum("relationshipStatus", item.relationshipStatus)}</span>
                {item.countryCode && <span className="chip text-[10.5px]">{item.countryCode}</span>}
                {item.primaryArea && <span className="chip text-[10.5px]">{item.primaryArea}</span>}
              </div>
            </div>
          </div>

          {/* O dinheiro da relação num relance, sempre em líquido — o que chega
              nele. Estava dentro de "Contratos com você", três seções abaixo:
              é a manchete da relação, não um detalhe da lista. */}
          {((item.paidCents ?? 0) > 0 || (item.inEscrowCents ?? 0) > 0 || (item.releasableCents ?? 0) > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {([
                ["Pago", item.paidCents ?? 0],
                ["Em custódia", item.inEscrowCents ?? 0],
                ["Liberável", item.releasableCents ?? 0],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border-soft px-3 py-2.5">
                  <div className="text-[10.5px] text-ink-muted">{label}</div>
                  <div className="font-mono-zoe text-[13px] font-semibold mt-0.5" style={{ color: "var(--ink)" }}>
                    {fmtCents(value)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Seção, não cartão. A gaveta tinha cinco caixas com borda e nenhuma
              hierarquia entre elas — no drawer de menções só o veredito é
              cartão, e o resto se separa por rótulo e respiro. */}
          <div>
            <div className="eyebrow mb-2">Recebimento</div>
            <div className="text-[13px] font-medium" style={{ color: rec.color }}>{rec.label}</div>
            <p className="text-[12px] text-ink-muted m-0 mt-1">{rec.explanation}</p>
            {isPaymentStuck(item) && (
              <div className="rounded-md p-2.5 mt-2.5 text-[12px]" style={{ background: "var(--neg-bg)", color: "var(--color-neg)" }}>
                {fmtCents(item.releasableCents ?? 0)} já aprovados para este criador esperam esta conta.{" "}
                <Link to="/operations/escrow" className="underline">Ver na custódia</Link>
              </div>
            )}
            {!canReceivePayout(item) && (
              <RoleGate minRole="Admin">
                <RemindCreatorButton influencerId={item.influencerId} name={item.displayName || item.fullName} />
              </RoleGate>
            )}
          </div>

          <div>
            <div className="eyebrow mb-2.5">Cadastro</div>
            {!item.profileComplete && (
              <p className="text-[12px] text-ink-muted m-0 mb-3">
                Ainda não completou o cadastro — o que estiver abaixo pode estar incompleto.
              </p>
            )}
            {/* Pares rótulo/valor em vez de uma pilha de frases: eram área,
                audiência, redes, tópicos, bio e portfólio num fluxo só, e nada
                dizia onde um assunto terminava e o outro começava. */}
            <div className="text-[12.5px] flex flex-col gap-3" style={{ color: "var(--ink-2)" }}>
              <div className="flex gap-3">
                <span className="text-ink-muted w-20 shrink-0">Audiência</span>
                <span>{audience ?? "—"}</span>
              </div>
              {networks.length > 0 && (
                <div className="flex gap-3">
                  <span className="text-ink-muted w-20 shrink-0">Redes</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 min-w-0">
                  {networks.map(([network, handle]) => (
                    <a
                      key={network}
                      href={NETWORKS[network]?.url(stripAt(handle)) ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1"
                      style={{ color: "var(--color-teal-500)" }}
                    >
                      {network} @{stripAt(handle)} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                  </div>
                </div>
              )}
              {topics.length > 0 && (
                <div className="flex gap-3">
                  <span className="text-ink-muted w-20 shrink-0 pt-0.5">Tópicos</span>
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {topics.map((t) => <span key={t} className="chip text-[10.5px]">{t}</span>)}
                  </div>
                </div>
              )}
              {item.bio && (
                <div className="flex gap-3">
                  <span className="text-ink-muted w-20 shrink-0">Bio</span>
                  <p className="m-0 min-w-0">{item.bio}</p>
                </div>
              )}
              {item.portfolioUrl && (
                <div className="flex gap-3">
                  <span className="text-ink-muted w-20 shrink-0">Portfólio</span>
                  <a
                    href={item.portfolioUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 break-all min-w-0"
                    style={{ color: "var(--color-teal-500)" }}
                  >
                    Abrir <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="eyebrow mb-2">Contratos com você ({creatorContracts.length})</div>
            {creatorContracts.length === 0 ? (
              <p className="text-[12.5px] text-ink-muted m-0">Nenhum contrato com este criador ainda.</p>
            ) : (
              <div className="flex flex-col">
                {creatorContracts.map((c) => (
                  <Link
                    key={c.contractId}
                    to={`/operations/contracts/${c.contractId}`}
                    className="flex items-center gap-2 py-2.5 border-b border-border-soft last:border-b-0 text-[12.5px] hover:bg-hover transition-colors"
                  >
                    <span className="flex-1 truncate" style={{ color: "var(--ink)" }}>{campaignLabel(c.campaignName)}</span>
                    {c.escrowState && (
                      <span className="text-[11px] text-ink-muted">{tEnum("escrowState", c.escrowState)}</span>
                    )}
                    <span className="chip text-[10.5px]">{tEnum("contractStatus", c.status)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {creatorDeliveries.length > 0 && (
            <div>
              <div className="eyebrow mb-2">Entregas ({creatorDeliveries.length})</div>
              <div className="flex flex-col">
                {creatorDeliveries.slice(0, 5).map((d) => (
                  <Link
                    key={d.deliveryId}
                    to={`/operations/deliveries?contract=${d.contractId}`}
                    className="flex items-center gap-2 py-2.5 border-b border-border-soft last:border-b-0 text-[12.5px] hover:bg-hover transition-colors"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ color: "var(--ink)" }}>{campaignLabel(d.campaignName)}</span>
                      <span className="text-[11px] text-ink-muted">
                        {fmtDate(d.submittedAt)}
                        {d.submissionAttempt > 1 && ` · ${d.submissionAttempt}ª tentativa`}
                      </span>
                    </span>
                    <StatusChip status={d.status} kind="deliveryStatus" colors={DELIVERY_STATUS_COLOR} small />
                  </Link>
                ))}
              </div>
              {creatorDeliveries.length > 5 && (
                <p className="text-[11.5px] text-ink-muted m-0 mt-1.5">
                  Mostrando as 5 mais recentes. As demais estão na fila de entregas.
                </p>
              )}
            </div>
          )}

          {creatorPayments.length > 0 && (
            <div>
              <div className="eyebrow mb-2">Pagamentos feitos ({creatorPayments.length})</div>
              <div className="flex flex-col">
                {creatorPayments.map((e) => (
                  <Link
                    key={e.escrowAccountId}
                    to="/operations/escrow"
                    className="flex items-center gap-2 py-2.5 border-b border-border-soft last:border-b-0 text-[12.5px] hover:bg-hover transition-colors"
                  >
                    <span className="flex-1 truncate" style={{ color: "var(--ink)" }}>{campaignLabel(e.campaignName)}</span>
                    {/* Líquido: o que chegou nele, como no resumo acima. */}
                    <span className="font-mono-zoe text-[12px]" style={{ color: "var(--ink)" }}>
                      {fmtCents(e.netToInfluencerCents)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo com a ação seguinte do fluxo — elenco existe para virar
            contrato. A rota já aceita `creator`, então o formulário abre com
            ele escolhido. */}
        <RoleGate minRole="Admin">
          <div
            className="sticky bottom-0 mt-auto px-6 py-4 border-t border-border-soft"
            style={{ background: "var(--surface)" }}
          >
            <Link
              to={`/operations/contracts?new=1&creator=${item.influencerId}`}
              className="flex items-center justify-center gap-2 h-10 rounded-lg text-[13.5px] font-semibold text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <FileText className="w-4 h-4" /> Criar contrato com {item.displayName || item.fullName.split(" ")[0]}
            </Link>
          </div>
        </RoleGate>
      </SheetContent>
    </Sheet>
  )
}

/** Lembra o criador de concluir a conta de recebimento; o servidor limita e recusa conta pronta. */
function RemindCreatorButton({ influencerId, name }: { influencerId: string; name: string }) {
  const { remindPayout } = useRosterMutations()
  const [sent, setSent] = useState(false)

  const remind = async () => {
    try {
      const res = await remindPayout.mutateAsync(influencerId)
      setSent(true)
      if (res.emailDelivery === "Sent") notifySuccess(`Lembrete enviado para ${name}.`)
      else notifyError(null, "O e-mail não saiu — o envio está desligado ou falhou neste ambiente.")
    } catch (e) {
      notifyError(e, "Não foi possível lembrar o criador.")
    }
  }

  return (
    <button
      onClick={remind}
      disabled={remindPayout.isPending || sent}
      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft disabled:opacity-50"
      style={{ color: "var(--color-teal-500)" }}
    >
      {remindPayout.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
      {sent ? "Lembrete enviado" : "Lembrar criador por e-mail"}
    </button>
  )
}

/**
 * Abas do relacionamento geradas dos dados, sem "Recusou" (o convite não tem recusa). "Pagamento travado" vem por último.
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
  const stuckCount = items.filter(isPaymentStuck).length

  // Ordem do fluxo, não alfabética: é a jornada do criador com a marca.
  const ORDER = ["Convidado", "Aceito", "Contratado", "Active", "Paused", "ConviteExpirado", "Archived"]
  const present = ORDER.filter((k) => counts.has(k))

  if (present.length <= 1 && stuckCount === 0) return null

  return (
    <div className="flex gap-1.5 flex-wrap">
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
      {stuckCount > 0 && (
        <TabButton
          label="Pagamento travado"
          count={stuckCount}
          active={value === PAYMENT_STUCK}
          onClick={() => onChange(PAYMENT_STUCK)}
          warning
        />
      )}
    </div>
  )
}

function TabButton({
  label, count, active, onClick, warning = false,
}: { label: string; count: number; active: boolean; onClick: () => void; warning?: boolean }) {
  // Token, e não hex fixo: `#DC2626` não acompanhava o modo escuro.
  const color = warning ? "var(--color-neg)" : "var(--color-teal-500)"
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer"
      style={
        active
          ? { background: color, color: "#fff" }
          : {
            color: warning ? color : "var(--ink-muted)",
            border: `1px solid ${warning ? "color-mix(in srgb, var(--color-neg) 35%, transparent)" : "var(--border-soft)"}`,
          }
      }
    >
      {label}
      <span className="font-mono-zoe text-[11px]" style={{ opacity: active ? 0.85 : 0.65 }}>{count}</span>
    </button>
  )
}
