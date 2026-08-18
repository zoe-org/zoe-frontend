import { useMemo, useState } from "react"
import {
  AlertCircle, AlertTriangle, Clock, Loader2, GitMerge, RefreshCw, Search, ShieldCheck, X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useAuth } from "@/features/auth/context"
import { EmptyState } from "@/components/ui/empty-state"
import { BrandAvatar } from "@/components/ui/brand-avatar"
import { StatBand } from "@/components/ui/stat-band"
import { TabPill } from "@/components/ui/tab-pill"
import { apiMessage } from "@/lib/api-error"
import {
  usePendingBrands, usePendingSummary, useAdminBrands, useBrandVerification, useCurationMutations,
  type MergeAnalysesPolicy, type BrandVerificationDetail, type PendingBrand, type AdminBrand,
} from "@/lib/api/admin"
import { SLA_LABEL, describeSlaCountdown, describeSubscribers } from "@/lib/admin-sla"
import { looksMisconfigured } from "@/lib/admin-curation"
import { useCurationDraft } from "@/components/admin/curation-draft"
import { CurationCard, CurationEditor } from "@/components/admin/CurationEditor"
import { BrandEditModal } from "@/components/admin/BrandEditModal"

/**
 * Curadoria admin de brands (ADR-021). É o **mecanismo de cura** do modelo de
 * brand global (ADR-019): sem alguém verificando, brands ficam presas em NER
 * conservador pra sempre e duplicatas se acumulam.
 *
 * Duas abas, espelhando as duas telas do design (`src-admin/curadoria.jsx` e
 * `src-admin/marcas-globais.jsx`) — e a divisão não é só de layout: a fila é uma
 * bancada de trabalho (uma marca por vez, com prazo), o catálogo é um índice
 * (muitas marcas, varredura por coluna). Por isso uma é master-detail e a outra
 * é tabela com modal.
 */
type Tab = "queue" | "global"

export default function AdminBrandsPage() {
  const { isZoeAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>("queue")
  const summary = usePendingSummary(isZoeAdmin)

  if (!isZoeAdmin) {
    return (
      <EmptyState
        title="Área restrita"
        description="A curadoria de marcas é exclusiva de administradores da Zoe."
      />
    )
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-5 border-b border-border-soft">
        <div className="eyebrow mb-2.5">Curadoria · núcleo global</div>
        <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
          Marcas
        </h1>
        <div className="text-[14px] text-ink-muted mt-1.5 max-w-160">
          O núcleo verificado que parametriza a análise base compartilhada. Marca criada por tenant nasce pendente e
          roda em NER conservador — só o nome, sem aliases — até alguém verificar.
        </div>
      </section>

      <section className="px-8 py-4 border-b border-border-soft flex items-center gap-1.5">
        <TabPill
          active={tab === "queue"}
          onClick={() => setTab("queue")}
          label="Fila de verificação"
          count={summary.data?.total}
          badge={summary.data?.breached}
        />
        <TabPill active={tab === "global"} onClick={() => setTab("global")} label="Marcas globais" />
      </section>

      {tab === "queue" ? <VerificationQueueTab /> : <GlobalBrandsTab />}
    </div>
  )
}

// ── Aba 1: fila de verificação ─────────────────────────────────────────

function VerificationQueueTab() {
  const pending = usePendingBrands(true)
  const summary = usePendingSummary(true)
  const items = useMemo(() => pending.data?.items ?? [], [pending.data])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // A brand sai da fila ao ser curada — o fallback pra `items[0]` já cobre o
  // selectedId ficar apontando pra uma brand que saiu da lista.
  const selected = items.find((b) => b.brandId === selectedId) ?? items[0] ?? null

  if (pending.isLoading) return <PageSkeleton />
  if (pending.isError) {
    return <ErrorState message={apiMessage(pending.error, "Não foi possível carregar a fila.")} onRetry={() => pending.refetch()} />
  }

  return (
    <>
      {/* Faixa de números do backlog inteiro, não da página — a fila vem
          limitada, e contar o que voltou mentiria sobre o tamanho do problema.
          O design pede também "tempo médio de verificação" e "sugestões de
          merge": nenhum dos dois existe na API, e número de destaque inventado
          é o que alguém repassa numa reunião. */}
      {summary.data && (
        <StatBand
          items={[
            { label: "Na fila", value: summary.data.total, hint: "aguardando decisão de admin" },
            { label: "Vencendo em 24h", value: summary.data.dueSoon, hint: "entram no prazo curto", tone: summary.data.dueSoon > 0 ? "warn" : undefined },
            { label: "Fora do SLA de 72h", value: summary.data.breached, hint: "prioridade máxima", tone: summary.data.breached > 0 ? "neg" : undefined },
          ]}
        />
      )}

      {items.length === 0 ? (
        <div className="py-20">
          <EmptyState
            title="Fila vazia"
            description="Todas as marcas criadas pelos tenants já foram verificadas, rejeitadas ou mescladas."
          />
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 340px)" }}>
          <div className="border-r border-border-soft">
            {items.map((b) => (
              <QueueRow
                key={b.brandId}
                brand={b}
                active={selected?.brandId === b.brandId}
                onClick={() => setSelectedId(b.brandId)}
              />
            ))}
          </div>

          {selected && <VerificationPanel key={selected.brandId} brandId={selected.brandId} queueItem={selected} />}
        </div>
      )}
    </>
  )
}

/**
 * Chip de SLA na forma do design: o texto já distingue os três estados
 * ("8h restantes" vs. "3h fora do SLA"), então a cor reforça em vez de ser a
 * única portadora do significado. O `title` carrega o rótulo e o prazo absoluto.
 */
function SlaChip({ brand, big = false }: { brand: PendingBrand; big?: boolean }) {
  const countdown = describeSlaCountdown(brand.pendingForHours)
  const cls = brand.slaStatus === "Breached" ? "chip chip-neg"
    : brand.slaStatus === "DueSoon" ? "chip chip-warn"
      : "chip"
  return (
    <span
      className={`${cls} ${big ? "" : "text-[10.5px]"} shrink-0`}
      title={`${SLA_LABEL[brand.slaStatus]} · prazo ${new Date(brand.slaDeadline).toLocaleString("pt-BR")}`}
    >
      {big && <Clock className="w-3 h-3" />}
      <span className="font-mono-zoe">{countdown}</span>
    </span>
  )
}

function QueueRow({ brand, active, onClick }: { brand: PendingBrand; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 border-b border-border-soft transition-colors cursor-pointer"
      style={{
        background: active ? "var(--color-teal-50)" : "transparent",
        // A barra à esquerda é o que marca a seleção sem depender só do fundo,
        // que quase some no tema escuro.
        borderLeft: `3px solid ${active ? "var(--color-teal-500)" : "transparent"}`,
      }}
    >
      <div className="flex items-center gap-3">
        <BrandAvatar name={brand.name} seed={brand.slug} size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>{brand.name}</div>
          <div className="text-[11.5px] text-ink-muted truncate mt-0.5">
            {brand.createdByTenantName ?? "tenant desconhecido"} ·{" "}
            {formatDistanceToNow(new Date(brand.createdAt), { addSuffix: true, locale: ptBR })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <SlaChip brand={brand} />
        {brand.officialChannelIds.length === 0 && <span className="chip text-[10.5px]">sem canal</span>}
        {brand.subscriberTenantsCount > 1 && (
          <span className="chip text-[10.5px]" title={describeSubscribers(brand.subscriberTenantsCount)}>
            <span className="font-mono-zoe">{brand.subscriberTenantsCount}</span> assinantes
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * `queueItem` vem da fila, não do endpoint de detalhe: o
 * `GET /{id}/verification` não carrega os campos de SLA, e duplicá-los lá só
 * criaria duas fontes que podem discordar entre si na mesma tela.
 */
function VerificationPanel({ brandId, queueItem }: { brandId: string; queueItem: PendingBrand }) {
  const detail = useBrandVerification(brandId)
  const m = useCurationMutations(brandId)
  const draft = useCurationDraft()

  const [notes, setNotes] = useState("")
  const [reprocess, setReprocess] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const d = detail.data

  // Semeia o formulário quando o detalhe chega. Ajuste durante o render (e não
  // em efeito) evita um commit extra — o componente já remonta por `key` quando
  // o brandId muda, então isto só dispara uma vez por marca.
  const [seeded, setSeeded] = useState<BrandVerificationDetail | null>(null)
  if (d && seeded !== d) {
    setSeeded(d)
    draft.reset(d.canonicalAliases, d.officialChannelIds)
  }

  if (detail.isLoading) return <div className="p-7"><PanelSkeleton /></div>
  if (detail.isError || !d) {
    return (
      <div className="p-7">
        <ErrorState message={apiMessage(detail.error, "Não foi possível carregar o detalhe.")} onRetry={() => detail.refetch()} />
      </div>
    )
  }

  const busy = m.verify.isPending || m.reject.isPending || m.merge.isPending || m.reprocess.isPending
  const actionError = m.verify.error ?? m.reject.error ?? m.merge.error ?? m.reprocess.error

  return (
    <div className="p-7 overflow-y-auto">
      <div className="flex items-start gap-4 mb-4 flex-wrap">
        <BrandAvatar name={d.name} seed={d.slug} size={56} radius={12} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-display m-0" style={{ fontSize: 26, lineHeight: 1.1, color: "var(--ink)" }}>{d.name}</h2>
            <span className="chip chip-warn text-[10.5px]"><span className="font-mono-zoe">pending_verification</span></span>
          </div>
          <div className="text-[12.5px] text-ink-muted mt-1">
            Criada por <strong style={{ color: "var(--ink-2)" }}>{d.createdByTenantName ?? "tenant desconhecido"}</strong>
            {" · "}<span className="font-mono-zoe">{d.slug}</span>
            {queueItem.subscriberTenantsCount > 0 && <> · {describeSubscribers(queueItem.subscriberTenantsCount)}</>}
          </div>
        </div>
        <SlaChip brand={queueItem} big />
      </div>

      {/* Por que a fila importa, dito onde a decisão acontece. */}
      <div
        className="flex gap-3 rounded-lg border px-4 py-3 mb-5"
        style={{ background: "var(--warn-bg)", borderColor: "rgba(217,119,6,.25)" }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warn)" }} />
        <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-warn)" }}>
          Modo conservador ativo. A detecção usa apenas <span className="font-mono-zoe">"{d.name.toLowerCase()}"</span> e
          ignora os aliases sugeridos — por isso o volume de menções do tenant está baixo. Dado não-verificado nunca
          entra na análise base compartilhada.
        </div>
      </div>

      <CurationEditor
        draft={draft}
        suggestions={d.suggestedAliases}
        aliasTitle="1 · Aliases sugeridos pelo tenant"
        channelTitle="2 · Canais oficiais"
      />

      {d.similarBrands.length > 0 && (
        <CurationCard
          title="3 · Possíveis duplicatas"
          tone="warn"
          hint="Se for a mesma marca, mescle em vez de verificar — merge é transacional e preserva o histórico."
        >
          <div className="flex flex-col">
            {d.similarBrands.map((s, i) => (
              <div key={s.brandId} className={`flex items-center gap-3 py-2.5 ${i ? "border-t border-border-soft" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                    {s.name}
                    {s.verified && <ShieldCheck className="inline w-3.5 h-3.5 ml-1.5" style={{ color: "var(--color-pos)" }} />}
                  </div>
                  <div className="text-[11.5px] text-ink-muted font-mono-zoe">{s.slug} · match {s.matchType}</div>
                </div>
                <button
                  onClick={() => m.merge.mutate({ targetId: s.brandId, policy: "PreferTarget" as MergeAnalysesPolicy })}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <GitMerge className="w-3.5 h-3.5" /> Mesclar nesta
                </button>
              </div>
            ))}
          </div>
        </CurationCard>
      )}

      {d.recentAnalyses.length > 0 && (
        <CurationCard
          title={`${d.similarBrands.length > 0 ? "4" : "3"} · Análises coletadas (${d.videosCollectedCount})`}
          hint="Rodadas em NER conservador — verificar promove para full."
        >
          <div className="flex flex-col">
            {d.recentAnalyses.slice(0, 5).map((a, i) => (
              <div key={a.analysisId} className={`flex items-center gap-3 py-2 ${i ? "border-t border-border-soft" : ""}`}>
                <span className="text-[13px] truncate flex-1" style={{ color: "var(--ink-2)" }}>{a.videoTitle}</span>
                <span className="font-mono-zoe text-[11px] text-ink-muted shrink-0">{a.nerMode}</span>
                <span className="font-mono-zoe text-[12px] shrink-0" style={{ color: "var(--ink)" }}>
                  {a.score != null ? a.score.toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>
        </CurationCard>
      )}

      <CurationCard title="Notas de verificação">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Contexto para o próximo curador ou para o tenant, em caso de rejeição."
          className="w-full px-3 py-2 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500 resize-y"
        />
        <label className="flex items-center gap-2 mt-3 text-[13px] text-ink-2 cursor-pointer">
          <input type="checkbox" checked={reprocess} onChange={(e) => setReprocess(e.target.checked)} className="accent-teal-500" />
          Reprocessar as análises conservadoras com os aliases confirmados
        </label>
      </CurationCard>

      {actionError && (
        <p className="text-[13px] text-neg mb-3">{apiMessage(actionError, "Não foi possível concluir a ação.")}</p>
      )}

      {/* Barra de ação grudada no rodapé: o painel é longo e a decisão não pode
          exigir rolagem até o fim para aparecer. */}
      <div
        className="sticky bottom-4 flex items-center gap-4 flex-wrap rounded-lg border border-border-soft p-4 shadow-lg"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex-1 min-w-60 text-[12.5px] text-ink-muted leading-relaxed">
          Verificar libera a análise completa com <strong style={{ color: "var(--ink)" }}>{draft.aliases.length}{" "}
          {draft.aliases.length === 1 ? "alias" : "aliases"}</strong> e afeta todos os tenants inscritos nesta marca.
        </div>

        {rejecting ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo enviado ao tenant"
              autoFocus
              className="h-9 px-3 text-[13px] rounded-md border border-border-soft bg-transparent outline-none focus:border-neg w-60"
            />
            <button
              onClick={() => m.reject.mutate(rejectReason.trim())}
              disabled={!rejectReason.trim() || busy}
              className="h-9 px-3.5 text-[13px] rounded-md text-white bg-neg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {m.reject.isPending ? "Rejeitando…" : "Rejeitar e notificar"}
            </button>
            <button
              onClick={() => { setRejecting(false); setRejectReason("") }}
              className="h-9 px-2 text-[13px] text-ink-muted hover:text-ink cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => m.reprocess.mutate()}
              disabled={busy}
              title="Reprocessa as análises conservadoras sem verificar a marca."
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Só reprocessar
            </button>
            <button
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-md border border-border-soft text-neg hover:bg-[#FEF2F2] dark:hover:bg-[#2A1517] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Rejeitar
            </button>
            <button
              onClick={() => m.verify.mutate({
                canonicalAliases: draft.aliases,
                officialChannelIds: draft.channels,
                notes: notes.trim() || null,
                reprocessExisting: reprocess,
              })}
              disabled={busy}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {m.verify.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verificar e ativar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Aba 2: marcas globais ──────────────────────────────────────────────

function GlobalBrandsTab() {
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<AdminBrand | null>(null)
  const list = useAdminBrands({ status: "Active", q: search }, true)

  const items = useMemo(() => list.data?.items ?? [], [list.data])
  const suspeitas = items.filter(looksMisconfigured).length

  return (
    <>
      <div className="px-8 pt-5 pb-2">
        <p className="text-[13.5px] text-ink-muted max-w-160 m-0 leading-relaxed">
          Editar aqui muda a análise base de todos os tenants inscritos — e, quando muda a detecção, exige decisão
          sobre reprocessar o histórico.
        </p>
      </div>

      {items.length > 0 && (
        <div className="px-8 pb-5 pt-3">
          <div className="rounded-lg border border-border-soft grid grid-cols-3">
            {[
              { l: "Marcas verificadas", v: items.length, h: "parametrizando a análise base" },
              {
                l: "Tenants inscritos",
                v: items.reduce((acc, b) => acc + b.subscriberTenantsCount, 0),
                h: "somados nas marcas listadas",
              },
              {
                l: "Canal suspeito",
                v: suspeitas,
                h: suspeitas > 0 ? "declara canal e não tem mídia própria" : "nenhuma inconsistência aparente",
                tone: suspeitas > 0,
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
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border-soft">
            <div className="relative w-70">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou slug…"
                className="w-full h-8 pl-9 pr-3 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500"
              />
            </div>
            <span className="text-[12px] text-ink-muted">
              {/* Sem filtro de status por enquanto: a API lista por status e a
                  fila já tem aba própria; "mescladas" viraria uma terceira lista
                  sem ação possível (merge é terminal). */}
              somente verificadas
            </span>
          </div>

          {list.isLoading ? (
            <div className="p-8"><PanelSkeleton /></div>
          ) : list.isError ? (
            <ErrorState message={apiMessage(list.error, "Não foi possível carregar as marcas.")} onRetry={() => list.refetch()} />
          ) : items.length === 0 ? (
            <div className="py-14 text-center text-[13.5px] text-ink-muted">
              {search
                ? <>Nenhuma marca verificada bate com “{search}”.</>
                : "Marcas aparecem aqui depois de passarem pela fila de verificação."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 860 }}>
                <thead>
                  <tr className="border-b border-border-soft">
                    <Th>Marca</Th>
                    <Th>Aliases canônicos</Th>
                    <Th align="right">Tenants</Th>
                    <Th align="right">Análises</Th>
                    <Th align="right">Owned</Th>
                    <Th>Verificada</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <GlobalBrandRow key={b.brandId} brand={b} onEdit={() => setEditing(b)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && <BrandEditModal brand={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="eyebrow px-4 py-2.5 font-semibold"
      style={{ textAlign: align, whiteSpace: "nowrap" }}
    >
      {children}
    </th>
  )
}

function GlobalBrandRow({ brand, onEdit }: { brand: AdminBrand; onEdit: () => void }) {
  const suspeita = looksMisconfigured(brand)

  return (
    <tr className="border-b border-border-soft last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <BrandAvatar name={brand.name} seed={brand.slug} size={28} radius={7} />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>{brand.name}</div>
            <div className="font-mono-zoe text-[11px] text-ink-muted truncate">
              {brand.slug} · {brand.officialChannelIds.length}{" "}
              {brand.officialChannelIds.length === 1 ? "canal" : "canais"}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1" style={{ maxWidth: 260 }}>
          {brand.canonicalAliases.length === 0 && <span className="text-[11.5px] text-ink-muted-2 italic">só o nome</span>}
          {brand.canonicalAliases.slice(0, 3).map((a) => (
            <span key={a} className="font-mono-zoe text-[11px] px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" style={{ color: "var(--ink-2)" }}>
              {a}
            </span>
          ))}
          {brand.canonicalAliases.length > 3 && (
            <span className="text-[11px] text-ink-muted">+{brand.canonicalAliases.length - 3}</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 font-mono-zoe text-[12.5px] text-right" style={{ color: "var(--ink-2)" }}>
        {brand.subscriberTenantsCount}
      </td>
      <td className="px-4 py-3 font-mono-zoe text-[12.5px] text-right" style={{ color: "var(--ink-2)" }}>
        {brand.analysesCount.toLocaleString("pt-BR")}
      </td>
      <td className="px-4 py-3 text-right">
        {/* A coluna que denuncia channel id errado: declara canal, tem análise,
            e nada ficou owned. Era sinal que só existia no audit log. */}
        <span
          className="font-mono-zoe text-[12.5px]"
          style={{ color: suspeita ? "var(--color-warn)" : "var(--ink-2)" }}
          title={suspeita ? "Declara canal oficial e tem análises, mas nenhuma classificada como mídia própria — provável channel id errado." : undefined}
        >
          {suspeita && <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" />}
          {brand.ownedAnalysesCount.toLocaleString("pt-BR")}
        </span>
      </td>

      <td className="px-4 py-3 text-[12.5px] text-ink-muted" style={{ whiteSpace: "nowrap" }}>
        {brand.verifiedAt
          ? formatDistanceToNow(new Date(brand.verifiedAt), { addSuffix: true, locale: ptBR })
          : "—"}
      </td>

      <td className="px-4 py-3 text-right">
        <button
          onClick={onEdit}
          className="h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors cursor-pointer"
        >
          Editar
        </button>
      </td>
    </tr>
  )
}

// ── auxiliares ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="h-9 w-96 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      </div>
      <div className="p-8"><PanelSkeleton /></div>
    </div>
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

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 mb-3" style={{ color: "var(--color-neg)" }} />
      <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4 max-w-100">{message}</p>
      <button
        onClick={onRetry}
        className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors cursor-pointer"
      >
        Tentar de novo
      </button>
    </div>
  )
}

export type { BrandVerificationDetail }
