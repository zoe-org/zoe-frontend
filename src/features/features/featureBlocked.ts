import { QueryCache, MutationCache } from "@tanstack/react-query"
import { missingFeature } from "@/features/features/upsell"

/**
 * Ponte entre o cache do react-query (que vive fora do React) e o diálogo de upgrade.
 *
 * Escutar o cache, em vez de tratar o 403 em cada tela, é o que garante que a próxima
 * superfície gated não nasça sem o aviso: erro de query e de mutação passam por aqui
 * sem exceção.
 */
type Listener = (slug: string) => void

let listener: Listener | null = null

/** O diálogo se registra ao montar. Só um por vez — ele vive no shell. */
export function onFeatureBlocked(fn: Listener) {
  listener = fn
  return () => { if (listener === fn) listener = null }
}

function announce(err: unknown) {
  const slug = missingFeature(err)
  if (slug) listener?.(slug)
}

/** Passados ao `QueryClient` na raiz. */
export const upgradeAwareCaches = {
  queryCache: new QueryCache({ onError: announce }),
  mutationCache: new MutationCache({ onError: announce }),
}
