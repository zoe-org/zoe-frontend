import { useState } from "react"
import { adminApi } from "@/lib/api/admin"
import { apiMessage } from "@/lib/api-error"
import { containsAlias, normalizeAliasInput } from "@/lib/admin-curation"

/** Mesmo padrão do domínio (`ChannelIdPattern`). */
const CHANNEL_ID_RE = /^UC[0-9A-Za-z_-]{22}$/

export function parseChannelId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (CHANNEL_ID_RE.test(s)) return s
  const fromUrl = s.match(/\/channel\/(UC[0-9A-Za-z_-]{22})/)
  return fromUrl ? fromUrl[1] : null
}

/**
 * Estado do rascunho de curadoria — aliases e canais oficiais — compartilhado
 * pela verificação (marca na fila) e pela correção (marca já verificada). As
 * duas telas editam exatamente os mesmos campos com as mesmas regras; só a
 * barra de ações difere.
 */
export function useCurationDraft() {
  const [aliases, setAliases] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])

  // Título por channel id — permite conferir o canal sem decorar o UC….
  const [channelTitles, setChannelTitles] = useState<Record<string, string>>({})
  const [channelDraft, setChannelDraft] = useState("")
  const [channelError, setChannelError] = useState<string | null>(null)
  const [resolvingChannel, setResolvingChannel] = useState(false)
  const [aliasDraft, setAliasDraft] = useState("")

  const reset = (nextAliases: string[], nextChannels: string[]) => {
    setAliases(nextAliases)
    setChannels(nextChannels)
    setAliasDraft("")
    setChannelDraft("")
    setChannelError(null)
  }

  const toggleAlias = (keyword: string) =>
    setAliases((prev) =>
      containsAlias(prev, keyword)
        ? prev.filter((a) => a.toLowerCase() !== keyword.toLowerCase())
        : [...prev, keyword])

  const isPromoted = (keyword: string) => containsAlias(aliases, keyword)

  /** Alias digitado à mão — o que a marca já verificada precisa (não há sugestão nova pra promover). */
  const commitAliasDraft = () => {
    const normalized = normalizeAliasInput(aliasDraft)
    if (!normalized) return
    if (!containsAlias(aliases, normalized)) setAliases([...aliases, normalized])
    setAliasDraft("")
  }

  const removeAlias = (keyword: string) =>
    setAliases((prev) => prev.filter((a) => a.toLowerCase() !== keyword.toLowerCase()))

  /** Desfaz uma remoção — o "restaurar" da lista de removidos nesta edição. */
  const restoreAlias = (keyword: string) =>
    setAliases((prev) => (containsAlias(prev, keyword) ? prev : [...prev, keyword]))

  const commitChannel = (id: string, title?: string | null) => {
    // Link e ID do mesmo canal resolvem para o MESMO UC… — a lista guarda
    // canais, não formas de escrever canal, então a segunda forma é no-op.
    if (!channels.includes(id)) {
      setChannels([...channels, id])
      setChannelError(null)
    } else {
      setChannelError("Esse canal já está na lista.")
    }
    if (title) setChannelTitles((t) => ({ ...t, [id]: title }))
    setChannelDraft("")
  }

  /**
   * ID puro ou `/channel/<id>` resolve local; `@handle` / link do "Compartilhar"
   * vai ao backend traduzir. Usa o endpoint **admin** de resolve: o de
   * `/api/me/brands` exige ser Owner/Admin do tenant ativo, e o admin da Zoe é
   * cross-tenant — ali ele tomava 403 e o campo virava "só aceita UC…".
   */
  const addChannel = async () => {
    const local = parseChannelId(channelDraft)
    if (local) { commitChannel(local); return }

    const raw = channelDraft.trim()
    if (!raw.includes("@")) {
      setChannelError("Cole o link do canal (youtube.com/@marca), o @handle ou o ID que começa com UC.")
      return
    }

    setResolvingChannel(true)
    setChannelError(null)
    try {
      const r = await adminApi.resolveChannel(raw)
      if (r.channelId) commitChannel(r.channelId, r.title)
      else setChannelError(
        r.reason === "channel_not_found"
          ? "Não encontramos esse canal no YouTube. Confira o @handle."
          : "Não conseguimos resolver esse @handle agora. Tente colar o ID do canal (UC…).",
      )
    } catch (err) {
      setChannelError(apiMessage(err, "Não conseguimos consultar o YouTube agora."))
    } finally {
      setResolvingChannel(false)
    }
  }

  const removeChannel = (id: string) => setChannels(channels.filter((x) => x !== id))

  return {
    aliases, channels, channelTitles,
    aliasDraft, setAliasDraft, commitAliasDraft, removeAlias, restoreAlias, toggleAlias, isPromoted,
    channelDraft, setChannelDraft, channelError, setChannelError, resolvingChannel,
    addChannel, removeChannel,
    reset,
  }
}

export type CurationDraft = ReturnType<typeof useCurationDraft>
