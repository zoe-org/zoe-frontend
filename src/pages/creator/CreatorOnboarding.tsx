import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Check, Loader2, ExternalLink, ShieldCheck } from "lucide-react"
import { notifyError, notifyInfo } from "@/lib/feedback"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/context"
import {
  useCreatorWorkspace, useUpdateCreatorProfile, usePayoutMutations,
  CHANNEL_PLATFORMS, AUDIENCE_SIZES, CREATOR_AREAS, TOPICS_BY_AREA, MAX_TOPICS,
  type ChannelPlatform, type AudienceSize, type UpdateCreatorProfileBody,
} from "@/lib/api/creator"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const PASSOS = [
  { n: 1, titulo: "Dados pessoais" },
  { n: 2, titulo: "Redes e atuação" },
  { n: 3, titulo: "Recebimento" },
] as const

/**
 * Cadastro do criador, em três passos.
 *
 * <p>Existe porque o convite pede só e-mail e nome — de propósito: exigir documento e
 * portfólio antes do aceite afastaria quem só quer ver a proposta. O que o cadastro
 * coleta é pedido <b>depois</b>, quando já serve para alguma coisa.</p>
 *
 * <p>Um passo por vez, e cada um só avança com o que ele exige. A alternativa — uma
 * página só com dezoito campos — é a que faz a pessoa fechar a aba.</p>
 */
export default function CreatorOnboardingPage() {
  const nav = useNavigate()
  const { user } = useAuth()
  const workspace = useCreatorWorkspace()
  const salvar = useUpdateCreatorProfile()

  const d = workspace.data
  const perfil = d?.profile

  const [params] = useSearchParams()
  // Volta do provedor de pagamentos: o retorno aponta para o passo 3. Sem ler isto a
  // pessoa reabriria o cadastro no passo 1, como se não tivesse feito nada.
  const [passo, setPasso] = useState(() => (params.get("step") === "3" ? 3 : 1))

  // Dados pessoais
  const [fullName, setFullName] = useState("")
  const [taxId, setTaxId] = useState("")

  // Redes e atuação
  const [handles, setHandles] = useState<Partial<Record<ChannelPlatform, string>>>({})
  const [area, setArea] = useState("")
  const [audiencia, setAudiencia] = useState<AudienceSize | "">("")
  const [temas, setTemas] = useState<string[]>([])
  const [bio, setBio] = useState("")
  const [portfolio, setPortfolio] = useState("")

  const [hidratado, setHidratado] = useState(false)

  // Pré-preenche uma vez, quando os dados chegam. Quem volta para editar não deve
  // reencontrar o formulário vazio — e uma vez só porque, depois disso, quem manda no
  // campo é o que a pessoa está digitando.
  if (d && perfil && !hidratado) {
    setFullName(d.fullName)
    setTaxId(d.taxId ?? "")
    setHandles(perfil.handles ?? {})
    setArea(perfil.primaryArea ?? "")
    setAudiencia((perfil.audienceSize ?? "") as AudienceSize | "")
    setTemas(perfil.topics ?? [])
    setBio(perfil.bio ?? "")
    setPortfolio(perfil.portfolioUrl ?? "")
    setHidratado(true)
  }

  const sugestoes = useMemo(
    () => TOPICS_BY_AREA[area] ?? [],
    [area],
  )

  const toggleTema = (t: string) => {
    setTemas((atual) =>
      atual.includes(t)
        ? atual.filter((x) => x !== t)
        // Teto silencioso seria pior: o clique não faria nada e a pessoa acharia que a
        // tela travou. O aviso diz o motivo.
        : atual.length >= MAX_TOPICS
          ? (notifyInfo(`Escolha até ${MAX_TOPICS} temas — os que mais te representam.`), atual)
          : [...atual, t])
  }

  const salvarPasso = async (corpo: UpdateCreatorProfileBody, proximo: number) => {
    try {
      await salvar.mutateAsync(corpo)
      setPasso(proximo)
    } catch (e) {
      notifyError(e, "Não foi possível salvar.")
    }
  }

  if (workspace.isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center" style={{ background: "var(--bg, #FAFBFC)" }}>
        <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row" style={{ background: "var(--bg, #FAFBFC)" }}>
      <Sidebar passo={passo} />

      <main className="flex-1 px-6 sm:px-10 lg:px-14 py-10 lg:py-14">
        <div className="max-w-[720px]">
          {passo === 1 && (
            <StepDadosPessoais
              fullName={fullName}
              onFullName={setFullName}
              email={d?.email ?? user?.email ?? ""}
              taxId={taxId}
              onTaxId={setTaxId}
              salvando={salvar.isPending}
              onNext={() => salvarPasso({ fullName, taxId: taxId || undefined }, 2)}
            />
          )}

          {passo === 2 && (
            <StepRedes
              handles={handles}
              onHandle={(p, v) => setHandles((h) => ({ ...h, [p]: v }))}
              area={area}
              onArea={(v) => {
                setArea(v)
                // Trocar de área troca as sugestões. Os temas escolhidos ficam: eles são
                // dele, não da lista — apagar o que ele já marcou por causa de um clique
                // no seletor ao lado seria perder trabalho sem avisar.
              }}
              audiencia={audiencia}
              onAudiencia={setAudiencia}
              sugestoes={sugestoes}
              temas={temas}
              onToggleTema={toggleTema}
              bio={bio}
              onBio={setBio}
              portfolio={portfolio}
              onPortfolio={setPortfolio}
              salvando={salvar.isPending}
              onBack={() => setPasso(1)}
              onNext={() => salvarPasso({
                primaryArea: area || undefined,
                audienceSize: audiencia || undefined,
                topics: temas,
                bio: bio || undefined,
                portfolioUrl: portfolio || undefined,
                // Manda as três sempre: plataforma com arroba vazio remove o canal, que
                // é como ele corrige ter digitado o perfil errado.
                handles: Object.fromEntries(
                  CHANNEL_PLATFORMS.map((p) => [p, handles[p]?.trim() ?? ""])),
              }, 3)}
            />
          )}

          {passo === 3 && (
            <StepRecebimento
              onBack={() => setPasso(2)}
              onFinish={() => nav("/creator", { replace: true })}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// ───────────────────────────────── Barra lateral ─────────────────────────────────

function Sidebar({ passo }: { passo: number }) {
  return (
    <aside
      className="lg:w-[380px] shrink-0 relative overflow-hidden px-8 sm:px-10 py-9 lg:py-12 lg:min-h-dvh"
      style={{
        background:
          "linear-gradient(155deg, #0E7C70 0%, #0A5F58 45%, #063F3B 100%)",
      }}
    >
      {/* Brilho de canto: dá profundidade ao gradiente sem virar imagem para carregar. */}
      <div
        className="absolute -top-24 -left-16 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(93,224,212,.28), transparent 65%)" }}
      />

      <div className="relative z-10 flex flex-col h-full">
        <ZoeLogo className="h-7 w-auto text-white" />

        <div className="mt-9">
          <div
            className="text-[10.5px] font-semibold uppercase"
            style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,.62)" }}
          >
            Cadastro de influenciador
          </div>
          <h1
            className="font-display text-white m-0 mt-2"
            style={{ fontSize: 26, lineHeight: 1.2 }}
          >
            Complete seu cadastro para ver a proposta
          </h1>
          <p className="text-[13px] mt-2.5 m-0" style={{ color: "rgba(255,255,255,.68)" }}>
            Leva poucos minutos. Você pode editar tudo depois em “Meu perfil”.
          </p>
        </div>

        <ol className="mt-10 m-0 p-0 list-none flex flex-col gap-7">
          {PASSOS.map((p, i) => {
            const feito = passo > p.n
            const atual = passo === p.n

            return (
              <li key={p.n} className="relative flex items-start gap-3.5">
                {/* Linha ligando os passos: mostra que é uma sequência, não três botões. */}
                {i < PASSOS.length - 1 && (
                  <span
                    className="absolute left-[15px] top-8 w-[2px] h-7"
                    style={{ background: feito ? "#fff" : "rgba(255,255,255,.18)" }}
                  />
                )}

                <span
                  className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-[12.5px] font-bold border-2 transition-colors"
                  style={
                    feito
                      ? { background: "#fff", borderColor: "#fff", color: "#0A5F58" }
                      : atual
                        ? { background: "rgba(255,255,255,.18)", borderColor: "#fff", color: "#fff" }
                        : { background: "transparent", borderColor: "rgba(255,255,255,.25)", color: "rgba(255,255,255,.45)" }
                  }
                >
                  {feito ? <Check className="w-4 h-4" strokeWidth={3} /> : p.n}
                </span>

                <span className="pt-0.5">
                  <span
                    className="block text-[10px] font-semibold uppercase"
                    style={{
                      letterSpacing: "0.14em",
                      color: atual || feito ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.35)",
                    }}
                  >
                    Passo {p.n}
                  </span>
                  <span
                    className="block text-[13.5px] font-semibold mt-0.5"
                    style={{ color: atual || feito ? "#fff" : "rgba(255,255,255,.4)" }}
                  >
                    {p.titulo}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>

        <p
          className="text-[11.5px] mt-auto pt-10 m-0"
          style={{ color: "rgba(255,255,255,.5)" }}
        >
          Seus dados ficam com você. A marca só vê o que ajuda a te encontrar.
        </p>
      </div>
    </aside>
  )
}

// ───────────────────────────────── Passo 1 ─────────────────────────────────

function StepDadosPessoais({
  fullName, onFullName, email, taxId, onTaxId, salvando, onNext,
}: {
  fullName: string
  onFullName: (v: string) => void
  email: string
  taxId: string
  onTaxId: (v: string) => void
  salvando: boolean
  onNext: () => void
}) {
  // Nome completo, não uma palavra: o provedor de assinatura recusa signatário de um
  // nome só, e a recusa aparece lá na frente, quando o contrato já foi montado.
  const nomeOk = fullName.trim().split(/\s+/).filter(Boolean).length >= 2

  return (
    <>
      <Titulo
        titulo="Dados pessoais"
        subtitulo="É o que vai identificar você no contrato."
      />

      <div className="flex flex-col gap-5">
        <Campo label="Nome completo" hint={!nomeOk && fullName ? "Informe nome e sobrenome." : undefined}>
          <Input
            value={fullName}
            onChange={(e) => onFullName(e.target.value)}
            placeholder="Maria Oliveira"
            autoComplete="name"
          />
        </Campo>

        <Campo label="E-mail" hint="É o e-mail do seu convite — não muda por aqui.">
          <Input value={email} readOnly className="bg-[#F3F4F6] text-[#6B7280]" />
        </Campo>

        <Campo
          label="CPF ou CNPJ"
          opcional
          hint="Necessário para o contrato ser emitido. Dá para informar depois."
        >
          <Input
            value={taxId}
            onChange={(e) => onTaxId(e.target.value)}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="max-w-[280px]"
          />
        </Campo>
      </div>

      <Acoes
        onNext={onNext}
        proximoHabilitado={nomeOk}
        salvando={salvando}
      />
    </>
  )
}

// ───────────────────────────────── Passo 2 ─────────────────────────────────

function StepRedes({
  handles, onHandle, area, onArea, audiencia, onAudiencia, sugestoes, temas,
  onToggleTema, bio, onBio, portfolio, onPortfolio, salvando, onBack, onNext,
}: {
  handles: Partial<Record<ChannelPlatform, string>>
  onHandle: (p: ChannelPlatform, v: string) => void
  area: string
  onArea: (v: string) => void
  audiencia: AudienceSize | ""
  onAudiencia: (v: AudienceSize | "") => void
  sugestoes: string[]
  temas: string[]
  onToggleTema: (t: string) => void
  bio: string
  onBio: (v: string) => void
  portfolio: string
  onPortfolio: (v: string) => void
  salvando: boolean
  onBack: () => void
  onNext: () => void
}) {
  // Pelo menos uma rede: é por ela que a marca te encontra, e um cadastro sem nenhuma
  // não cumpre o que a tela promete no subtítulo.
  const temRede = CHANNEL_PLATFORMS.some((p) => (handles[p] ?? "").trim().length > 0)

  // Tema que ele escreveu e não está na lista da área continua visível — some daqui
  // seria a pessoa marcar algo e ver o chip desaparecer.
  const chips = useMemo(() => {
    const vistos = new Set(sugestoes)
    return [...sugestoes, ...temas.filter((t) => !vistos.has(t))]
  }, [sugestoes, temas])

  return (
    <>
      <Titulo
        titulo="Redes e atuação"
        subtitulo="Isso ajuda marcas a te encontrar para as propostas certas."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {CHANNEL_PLATFORMS.map((p) => (
          <Campo key={p} label={p} icone={<PlatformIcon platform={p} />}>
            <Input
              value={handles[p] ?? ""}
              onChange={(e) => onHandle(p, e.target.value)}
              placeholder="@seuhandle"
              className="font-mono-zoe text-[13px]"
              autoComplete="off"
              spellCheck={false}
            />
          </Campo>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-5">
        <Campo label="Área principal">
          <Selecao value={area} onChange={onArea}>
            <option value="">Selecione…</option>
            {CREATOR_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Selecao>
        </Campo>

        <Campo label="Tamanho da audiência">
          <Selecao value={audiencia} onChange={(v) => onAudiencia(v as AudienceSize | "")}>
            <option value="">Selecione…</option>
            {AUDIENCE_SIZES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Selecao>
        </Campo>
      </div>

      <div className="mt-6">
        <div className="text-[13px] font-medium mb-2" style={{ color: "var(--ink)" }}>
          Temas que você aborda{" "}
          <span className="text-ink-muted font-normal">
            {area ? `(até ${MAX_TOPICS})` : "(escolha a área primeiro)"}
          </span>
        </div>

        {chips.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted m-0">
            Escolha a área principal acima e os temas aparecem aqui.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {chips.map((t) => {
              const ativo = temas.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggleTema(t)}
                  aria-pressed={ativo}
                  className="px-3 py-1.5 rounded-full text-[12.5px] border transition-colors"
                  style={ativo
                    ? { background: "var(--color-teal-500)", borderColor: "transparent", color: "#fff" }
                    : { background: "var(--surface)", borderColor: "var(--border-soft)", color: "var(--ink)" }}
                >
                  {t}
                </button>
              )
            })}
          </div>
        )}

        {temas.length > 0 && (
          <p className="text-[11.5px] text-ink-muted mt-2 mb-0">
            {temas.length} de {MAX_TOPICS} escolhidos.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <Campo label="Bio curta" opcional>
          <textarea
            value={bio}
            onChange={(e) => onBio(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="Ex: Falo sobre bancos digitais e educação financeira há 5 anos."
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-[13px] outline-none transition-colors focus-visible:border-ring resize-y"
            style={{ color: "var(--ink)" }}
          />
        </Campo>

        <Campo label="Portfólio ou mídia kit" opcional>
          <Input
            value={portfolio}
            onChange={(e) => onPortfolio(e.target.value)}
            placeholder="https://…"
            inputMode="url"
            className="font-mono-zoe text-[13px] max-w-[420px]"
            spellCheck={false}
          />
        </Campo>
      </div>

      <Acoes
        onBack={onBack}
        onNext={onNext}
        proximoHabilitado={temRede}
        salvando={salvando}
        aviso={temRede ? undefined : "Informe pelo menos uma rede."}
      />
    </>
  )
}

// ───────────────────────────────── Passo 3 ─────────────────────────────────

function StepRecebimento({
  onBack, onFinish,
}: { onBack: () => void; onFinish: () => void }) {
  const workspace = useCreatorWorkspace()
  const { start, sync } = usePayoutMutations()
  const [params, setParams] = useSearchParams()
  const retorno = params.get("status")
  // Capturado na montagem: a URL é limpa logo depois, e o aviso precisa sobreviver a isso.
  const [linkVenceu] = useState(() => params.get("status") === "expired")

  // Pergunta ao provedor ao entrar no passo — inclusive voltando dele. A verificação
  // acontece lá sem avisar ninguém; sem perguntar, a tela diria "não conectada" para quem
  // acabou de concluir. Uma vez por visita, porque o comando escreve.
  const sincronizado = useRef(false)
  useEffect(() => {
    if (sincronizado.current) return
    sincronizado.current = true
    sync.mutate(undefined, {
      onError: (e) => {
        notifyError(null, e instanceof ApiError
          ? `Não foi possível checar sua conta de recebimento: ${e.message}`
          : "Não foi possível checar sua conta de recebimento agora.")
      },
      // Tira passo e status da URL: recarregar não deve repetir a volta que já passou.
      onSettled: () => { if (retorno) setParams({}, { replace: true }) },
    })
  }, [retorno, sync, setParams])

  const d = workspace.data
  const kyc = d?.kycStatus ?? "NotStarted"
  const conectada = d?.canReceivePayout ?? false
  const emVerificacao = !conectada && kyc === "Pending"
  const recusada = !conectada && kyc === "Rejected"
  const conferindo = sync.isPending

  const conectar = async () => {
    try {
      // "onboarding": o provedor devolve para este passo, e não para a tela de recebimento.
      const res = await start.mutateAsync("onboarding")
      if (!res.onboardingUrl) {
        notifyError(null, res.message ?? "O provedor não devolveu o link de cadastro.")
        return
      }
      window.location.href = res.onboardingUrl
    } catch (e) {
      notifyError(e, "Não foi possível iniciar o cadastro.")
    }
  }

  const titulo = conferindo ? "Conferindo sua conta…"
    : conectada ? "Conta conectada"
    : emVerificacao ? "Conta criada — em verificação"
    : recusada ? "O provedor pediu mais dados"
    : "Conecte sua conta de recebimento"

  const texto = conectada
    ? "Tudo certo. O valor da entrega aprovada vai direto para ela."
    : emVerificacao
      ? "O provedor está conferindo seus dados. Leva de alguns minutos a alguns dias, e "
        + "você não precisa esperar aqui para concluir."
      : recusada
        ? (d?.payoutBlockedReason ?? "Faltou alguma informação. Continue de onde parou.")
        : "O cadastro é feito no Stripe, que é quem guarda o dinheiro e seus dados "
          + "bancários — a Zoe nunca os recebe."

  return (
    <>
      <Titulo
        titulo="Recebimento"
        subtitulo="Onde o dinheiro cai quando a entrega for aprovada."
      />

      {linkVenceu && !conectada && (
        <p className="text-[12.5px] mb-4 m-0" style={{ color: "#D97706" }}>
          O link do provedor venceu antes de você terminar. É só continuar de onde parou.
        </p>
      )}

      <div
        className="rounded-xl border border-border-soft p-5"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-start gap-3">
          {conferindo
            ? <Loader2 className="w-5 h-5 mt-0.5 shrink-0 animate-spin text-ink-muted" />
            : (
              <ShieldCheck
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{ color: conectada ? "var(--color-teal-500)" : "#D97706" }}
              />
            )}
          <div>
            <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
              {titulo}
            </div>
            {!conferindo && (
              <p className="text-[12.5px] text-ink-muted m-0 mt-1">{texto}</p>
            )}

            {!conferindo && !conectada && (
              <button
                onClick={conectar}
                disabled={start.isPending}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-teal-500)" }}
              >
                {start.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ExternalLink className="w-3.5 h-3.5" />}
                {kyc === "NotStarted" ? "Conectar conta" : "Continuar cadastro"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Este passo pode ficar para depois de propósito: o KYC trava o PAGAMENTO, não a
          produção (RN-O-012). Prender o cadastro aqui atrasaria a assinatura do contrato
          por uma pendência que só importa no fim. */}
      {!conectada && (
        <p className="text-[12.5px] text-ink-muted mt-4">
          Dá para deixar isso para depois — você pode assinar o contrato e gravar sem a conta
          conectada. O bloqueio é só no pagamento.
        </p>
      )}

      <div className="flex items-center gap-2.5 mt-8 flex-wrap">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg text-[13.5px] font-medium border border-border-soft"
        >
          Voltar
        </button>
        <button
          onClick={onFinish}
          disabled={conferindo}
          className="px-5 py-2.5 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--color-teal-500)" }}
        >
          {conectada || emVerificacao ? "Concluir" : "Concluir e fazer isso depois"}
        </button>
      </div>
    </>
  )
}

// ───────────────────────────────── Peças ─────────────────────────────────

function Titulo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="mb-7">
      <h2 className="font-display m-0" style={{ fontSize: 30, lineHeight: 1.15, color: "var(--ink)" }}>
        {titulo}
      </h2>
      <p className="text-[13.5px] text-ink-muted mt-1.5 m-0">{subtitulo}</p>
    </div>
  )
}

function Campo({
  label, icone, opcional, hint, children,
}: {
  label: string
  icone?: React.ReactNode
  opcional?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
        {icone}
        {label}
        {opcional && <span className="text-ink-muted font-normal">(opcional)</span>}
      </span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-muted">{hint}</span>}
    </label>
  )
}

function Selecao({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none transition-colors focus-visible:border-ring"
      style={{ color: "var(--ink)" }}
    >
      {children}
    </select>
  )
}

function Acoes({
  onBack, onNext, proximoHabilitado, salvando, aviso,
}: {
  onBack?: () => void
  onNext: () => void
  proximoHabilitado: boolean
  salvando: boolean
  aviso?: string
}) {
  return (
    <div className="mt-9">
      <div className="flex items-center gap-2.5 flex-wrap">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-lg text-[13.5px] font-medium border border-border-soft"
          >
            Voltar
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!proximoHabilitado || salvando}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-45"
          style={{ background: "var(--color-teal-500)" }}
        >
          {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Continuar
        </button>
      </div>

      {/* O motivo fica ao lado do botão desabilitado. Botão apagado sem explicação é a
          pessoa clicando várias vezes sem entender o que falta. */}
      {aviso && <p className="text-[11.5px] text-ink-muted mt-2 mb-0">{aviso}</p>}
    </div>
  )
}

/** Marcas das plataformas. Não existem no lucide, e o cinza genérico não identifica. */
function PlatformIcon({ platform }: { platform: ChannelPlatform }) {
  if (platform === "YouTube") {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path
          fill="#FF0000"
          d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5Z"
        />
        <path fill="#fff" d="M9.6 15.6 15.8 12 9.6 8.4v7.2Z" />
      </svg>
    )
  }

  if (platform === "TikTok") {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.6 5.8a4.8 4.8 0 0 1-1-2.8h-3.3v13.1a2.7 2.7 0 1 1-1.9-2.6V10a6 6 0 1 0 5.2 5.9V9.4a8 8 0 0 0 4.6 1.5V7.6a4.8 4.8 0 0 1-3.6-1.8Z"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="none" stroke="#E1306C" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#E1306C" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="#E1306C" />
    </svg>
  )
}
