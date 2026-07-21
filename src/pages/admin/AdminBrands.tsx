import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle, Check, Clock, Plus, ShieldCheck, X, Loader2, GitMerge, RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useAuth } from "@/features/auth/AuthContext"
import { EmptyState } from "@/components/ui/empty-state"
import { apiMessage } from "@/lib/api-error"
import {
  usePendingBrands, useBrandVerification, useCurationMutations,
  type MergeAnalysesPolicy, type BrandVerificationDetail,
} from "@/lib/api/admin"

/** Mesmo padrão do domínio (`ChannelIdPattern`). */
const CHANNEL_ID_RE = /^UC[0-9A-Za-z_-]{22}$/
function parseChannelId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (CHANNEL_ID_RE.test(s)) return s
  const fromUrl = s.match(/\/channel\/(UC[0-9A-Za-z_-]{22})/)
  return fromUrl ? fromUrl[1] : null
}

/**
 * Curadoria admin de brands (ADR-021). É o **mecanismo de cura** do modelo de
 * brand global (ADR-019): sem alguém verificando, brands ficam presas em NER
 * conservador pra sempre e duplicatas se acumulam.
 *
 * O que o admin decide aqui:
 * - quais aliases sugeridos pelos tenants viram `canonical_aliases` GLOBAIS
 *   (entram na análise base de todo mundo — daí a curadoria humana);
 * - se a brand é legítima (verificar) ou spam (rejeitar);
 * - se é duplicata de uma já verificada (mesclar).
 */
export default function AdminBrandsPage() {
  const { isZoeAdmin } = useAuth()
  const pending = usePendingBrands(isZoeAdmin)
  const items = useMemo(() => pending.data?.items ?? [], [pending.data])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((b) => b.brandId === selectedId) ?? items[0] ?? null

  // A brand sai da fila ao ser curada — solta a seleção pra cair na próxima.
  useEffect(() => {
    if (selectedId && !items.some((b) => b.brandId === selectedId)) setSelectedId(null)
  }, [items, selectedId])

  if (!isZoeAdmin) {
    return (
      <EmptyState
        title="Área restrita"
        description="A curadoria de marcas é exclusiva de administradores da Zoe."
      />
    )
  }

  if (pending.isLoading) return <PageSkeleton />
  if (pending.isError) {
    return <ErrorState message={apiMessage(pending.error, "Não foi possível carregar a fila.")} onRetry={() => pending.refetch()} />
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="eyebrow mb-2.5">Admin Zoe · Curadoria</div>
        <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
          Verificação de marcas
        </h1>
        <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
          {items.length === 0
            ? "Nenhuma marca aguardando verificação."
            : <>
                <span className="font-mono-zoe">{items.length}</span>{" "}
                {items.length === 1 ? "marca aguardando" : "marcas aguardando"} — mais antigas primeiro.
                Enquanto não verificadas, rodam em NER conservador.
              </>}
        </div>
      </section>

      {items.length === 0 ? (
        <div className="py-20">
          <EmptyState
            title="Fila vazia"
            description="Todas as marcas criadas pelos tenants já foram verificadas, rejeitadas ou mescladas."
          />
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 220px)" }}>
          {/* Fila */}
          <div className="border-r border-border-soft" style={{ background: "var(--surface)" }}>
            {items.map((b) => {
              const active = selected?.brandId === b.brandId
              return (
                <button
                  key={b.brandId}
                  onClick={() => setSelectedId(b.brandId)}
                  className={`w-full text-left px-4 py-3.5 border-b border-border-soft transition-colors ${
                    active ? "bg-[#F0FDFB] dark:bg-teal-900/20" : "hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[14px] font-medium truncate" style={{ color: "var(--ink)" }}>{b.name}</span>
                    <span className="chip chip-warn text-[10px] shrink-0"><Clock className="w-2.5 h-2.5" /> pendente</span>
                  </div>
                  <div className="text-[11.5px] text-ink-muted truncate">
                    {b.createdByTenantName ?? "tenant desconhecido"} ·{" "}
                    {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true, locale: ptBR })}
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[11px] text-ink-muted-2 font-mono-zoe">
                    <span>{b.suggestedAliasesCount} aliases</span>
                    <span>{b.videosCollectedCount} vídeos</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detalhe */}
          {selected && <VerificationPanel key={selected.brandId} brandId={selected.brandId} />}
        </div>
      )}
    </div>
  )
}

function VerificationPanel({ brandId }: { brandId: string }) {
  const detail = useBrandVerification(brandId)
  const m = useCurationMutations(brandId)

  const [aliases, setAliases] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [channelDraft, setChannelDraft] = useState("")
  const [channelError, setChannelError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [reprocess, setReprocess] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const d = detail.data

  // Semeia o formulário quando o detalhe chega: aliases já canônicos + canais
  // atuais. O admin adiciona os sugeridos por cima.
  useEffect(() => {
    if (!d) return
    setAliases(d.canonicalAliases)
    setChannels(d.officialChannelIds)
  }, [d])

  if (detail.isLoading) return <div className="p-8"><PanelSkeleton /></div>
  if (detail.isError || !d) {
    return (
      <div className="p-8">
        <ErrorState message={apiMessage(detail.error, "Não foi possível carregar o detalhe.")} onRetry={() => detail.refetch()} />
      </div>
    )
  }

  const toggleAlias = (keyword: string) => {
    setAliases((prev) =>
      prev.some((a) => a.toLowerCase() === keyword.toLowerCase())
        ? prev.filter((a) => a.toLowerCase() !== keyword.toLowerCase())
        : [...prev, keyword])
  }
  const isPromoted = (keyword: string) => aliases.some((a) => a.toLowerCase() === keyword.toLowerCase())

  const addChannel = () => {
    const id = parseChannelId(channelDraft)
    if (!id) {
      setChannelError("Use o ID do canal (UC…, 24 caracteres) ou o link youtube.com/channel/…")
      return
    }
    if (!channels.includes(id)) setChannels([...channels, id])
    setChannelDraft("")
    setChannelError(null)
  }

  const busy = m.verify.isPending || m.reject.isPending || m.merge.isPending || m.reprocess.isPending
  const actionError = m.verify.error ?? m.reject.error ?? m.merge.error ?? m.reprocess.error

  return (
    <div className="p-8 overflow-y-auto">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display m-0" style={{ fontSize: 28, lineHeight: 1.1, color: "var(--ink)" }}>{d.name}</h2>
          <div className="text-[13px] text-ink-muted mt-1">
            <span className="font-mono-zoe">{d.slug}</span> · criada por {d.createdByTenantName ?? "tenant desconhecido"} ·{" "}
            {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true, locale: ptBR })}
          </div>
        </div>
        <div className="flex-1" />
        <span className="chip chip-warn"><Clock className="w-3 h-3" /> {d.status}</span>
      </div>

      {/* Aliases sugeridos — o coração da curadoria */}
      <Section
        title="Aliases sugeridos pelos tenants"
        hint="Promovidos viram canonical_aliases GLOBAIS — entram na análise base de todos os tenants. Promova só o que é inequivocamente a marca."
      >
        {d.suggestedAliases.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nenhum alias sugerido.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {d.suggestedAliases.map((s) => {
              const on = isPromoted(s.keyword)
              return (
                <button
                  key={`${s.tenantId}-${s.keyword}`}
                  onClick={() => toggleAlias(s.keyword)}
                  title={`Sugerido por ${s.tenantName ?? "tenant"} · ${s.occurrences}×`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] border transition-colors ${
                    on
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-900/25 text-teal-700 dark:text-teal-300"
                      : "border-border-soft text-ink-2 hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
                  }`}
                >
                  {on ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {s.keyword}
                  <span className="font-mono-zoe text-[10.5px] text-ink-muted">{s.occurrences}×</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-3.5 text-[12px] text-ink-muted">
          Serão gravados: {aliases.length === 0
            ? <span className="italic">nenhum alias</span>
            : aliases.map((a) => <span key={a} className="chip chip-primary mr-1.5">{a}</span>)}
        </div>
      </Section>

      {/* Canais oficiais */}
      <Section title="Canais oficiais" hint="Sinal mais forte de identidade — usado no auto-link do subscribe.">
        <div className="flex gap-2">
          <input
            value={channelDraft}
            onChange={(e) => { setChannelDraft(e.target.value); setChannelError(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChannel() } }}
            placeholder="UCxxxxxxxx… ou link /channel/…"
            className="flex-1 h-9 px-3 text-[13px] font-mono-zoe rounded-lg border bg-transparent outline-none focus:border-teal-500"
            style={{ borderColor: channelError ? "var(--color-neg)" : "var(--border-soft)" }}
          />
          <button
            type="button"
            onClick={addChannel}
            disabled={!channelDraft.trim()}
            className="h-9 px-3 rounded-lg border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {channelError && <p className="text-[11.5px] text-neg mt-1.5">{channelError}</p>}
        {channels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {channels.map((ch) => (
              <span key={ch} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md text-[12px] font-mono-zoe bg-[#F3F4F6] dark:bg-[#1A1D2D]" style={{ color: "var(--ink-2)" }}>
                {ch}
                <button onClick={() => setChannels(channels.filter((x) => x !== ch))} aria-label={`Remover ${ch}`} className="text-ink-muted hover:text-neg">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Duplicatas */}
      {d.similarBrands.length > 0 && (
        <Section title="Possíveis duplicatas" hint="Se for a mesma marca, mescle em vez de verificar — merge é transacional e preserva o histórico.">
          <div className="flex flex-col gap-2">
            {d.similarBrands.map((s) => (
              <div key={s.brandId} className="flex items-center gap-3 p-3 rounded-lg border border-border-soft">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
                    {s.name}
                    {s.verified && <ShieldCheck className="inline w-3.5 h-3.5 ml-1.5 text-[#16A34A]" />}
                  </div>
                  <div className="text-[11.5px] text-ink-muted font-mono-zoe">{s.slug} · match {s.matchType}</div>
                </div>
                <button
                  onClick={() => m.merge.mutate({ targetId: s.brandId, policy: "PreferTarget" as MergeAnalysesPolicy })}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50 shrink-0"
                >
                  <GitMerge className="w-3.5 h-3.5" /> Mesclar nesta
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Análises já coletadas (contexto pra decidir) */}
      {d.recentAnalyses.length > 0 && (
        <Section title={`Análises coletadas (${d.videosCollectedCount})`} hint="Rodadas em NER conservador — verificar promove para full.">
          <div className="flex flex-col">
            {d.recentAnalyses.slice(0, 5).map((a) => (
              <div key={a.analysisId} className="flex items-center gap-3 py-2 border-b border-border-soft last:border-0">
                <span className="text-[13px] truncate flex-1" style={{ color: "var(--ink-2)" }}>{a.videoTitle}</span>
                <span className="font-mono-zoe text-[11px] text-ink-muted shrink-0">{a.nerMode}</span>
                <span className="font-mono-zoe text-[12px] shrink-0" style={{ color: "var(--ink)" }}>
                  {a.score != null ? a.score.toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Ações */}
      <div className="mt-8 pt-6 border-t border-border-soft">
        <label className="block text-[12.5px] text-ink-2 mb-1.5">Notas da verificação (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Por que aprovou/quais aliases descartou…"
          className="w-full px-3 py-2 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500 resize-y"
        />

        <label className="flex items-center gap-2 mt-3 text-[13px] text-ink-2 cursor-pointer">
          <input type="checkbox" checked={reprocess} onChange={(e) => setReprocess(e.target.checked)} className="accent-teal-500" />
          Reprocessar análises antigas com os aliases confirmados
        </label>

        {actionError && (
          <p className="text-[13px] text-neg mt-3">{apiMessage(actionError, "Não foi possível concluir a ação.")}</p>
        )}

        <div className="flex items-center gap-2.5 mt-4 flex-wrap">
          <button
            onClick={() => m.verify.mutate({
              canonicalAliases: aliases,
              officialChannelIds: channels,
              notes: notes.trim() || null,
              reprocessExisting: reprocess,
            })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50"
          >
            {m.verify.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Verificar marca
          </button>

          <button
            onClick={() => m.reprocess.mutate()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Só reprocessar
          </button>

          <div className="flex-1" />

          {rejecting ? (
            <div className="flex items-center gap-2">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição"
                autoFocus
                className="h-9 px-3 text-[13px] rounded-md border border-border-soft bg-transparent outline-none focus:border-neg w-56"
              />
              <button
                onClick={() => m.reject.mutate(rejectReason.trim())}
                disabled={!rejectReason.trim() || busy}
                className="h-9 px-3.5 text-[13px] rounded-md text-white bg-[#DC2626] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {m.reject.isPending ? "Rejeitando…" : "Confirmar"}
              </button>
              <button onClick={() => { setRejecting(false); setRejectReason("") }} className="h-9 px-2 text-[13px] text-ink-muted hover:text-ink">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-md border border-border-soft text-neg hover:bg-[#FEF2F2] dark:hover:bg-[#2A1517] transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Rejeitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── auxiliares ─────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{title}</h3>
      {hint && <p className="text-[12px] text-ink-muted-2 mt-1 mb-3 max-w-160">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="-m-6 animate-pulse">
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
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4 max-w-100">{message}</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}

export type { BrandVerificationDetail }
