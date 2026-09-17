/**
 * Envio de arquivo grande em partes, com retomada.
 *
 * Num PUT único, queda de conexão no meio perde tudo — e corte de campanha sobe por minutos numa
 * banda doméstica. Aqui cada parte vai sozinha: a queda custa só a parte em curso, e o que já subiu
 * fica guardado no navegador para o próximo envio do MESMO arquivo continuar de onde parou.
 *
 * Quem guarda as partes enviadas é este lado, não a API: listar as partes no storage exigiria uma
 * permissão a mais no bucket, e o ETag de cada parte já volta no cabeçalho da resposta.
 *
 * Sem dependência de DOM: `putParte`, `api` e `storage` entram por parâmetro, e o arquivo é lido
 * pelo mínimo de `File` que interessa. É o que deixa a lógica de retomada testável.
 */

export type ArquivoEnviavel = Pick<File, "name" | "size" | "lastModified" | "slice">

export type ParteAssinada = { partNumber: number; url: string }

export type ParteEnviada = { partNumber: number; eTag: string }

export type MultipartApi = {
  start: (v: { contractId: string; fileName: string; contentType: string; sizeBytes: number })
    => Promise<{ mediaKey: string; uploadId: string; partSizeBytes: number; partCount: number }>
  signParts: (v: { contractId: string; mediaKey: string; uploadId: string; partNumbers: number[] })
    => Promise<{ parts: ParteAssinada[] }>
  complete: (v: { contractId: string; mediaKey: string; uploadId: string; parts: ParteEnviada[] })
    => Promise<unknown>
}

/** O que sobrevive ao fechamento da aba: onde o envio está e o que já subiu. */
export type EnvioGuardado = {
  mediaKey: string
  uploadId: string
  partSizeBytes: number
  partCount: number
  /** Número da parte → ETag devolvido pelo storage. */
  etags: Record<number, string>
}

export type GuardaDeEnvio = {
  ler: (chave: string) => EnvioGuardado | null
  gravar: (chave: string, envio: EnvioGuardado) => void
  limpar: (chave: string) => void
}

/** Sobe uma parte e devolve o ETag que o storage respondeu. */
export type PutParte = (
  url: string,
  corpo: Blob,
  onProgress: (bytesDaParte: number) => void,
) => Promise<string>

/**
 * Identidade do arquivo para retomar. Nome, tamanho e data de modificação juntos: escolher outro
 * arquivo (ou reexportar o mesmo vídeo) tem de começar um envio novo, nunca colar partes de dois.
 */
export const chaveDeRetomada = (contractId: string, file: ArquivoEnviavel) =>
  `zoe-draft-upload:${contractId}:${file.name}:${file.size}:${file.lastModified}`

/** Guarda em `localStorage`, que pode estar indisponível (aba anônima, storage cheio). */
export function guardaEmLocalStorage(): GuardaDeEnvio {
  return {
    ler: (chave) => {
      try {
        const cru = localStorage.getItem(chave)
        return cru ? (JSON.parse(cru) as EnvioGuardado) : null
      } catch {
        return null
      }
    },
    gravar: (chave, envio) => {
      try { localStorage.setItem(chave, JSON.stringify(envio)) } catch { /* storage indisponível */ }
    },
    limpar: (chave) => {
      try { localStorage.removeItem(chave) } catch { /* storage indisponível */ }
    },
  }
}

const esperarPadrao = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export type EnvioEmPartes = {
  contractId: string
  file: ArquivoEnviavel
  contentType: string
  api: MultipartApi
  putParte: PutParte
  storage: GuardaDeEnvio
  /** 0 a 1, contando o que já estava enviado de antes. */
  onProgress?: (fracao: number) => void
  /** Partes em paralelo. Três: o suficiente para usar a banda sem afogar conexão doméstica. */
  concorrencia?: number
  /** Tentativas por parte antes de desistir do envio inteiro. */
  tentativasPorParte?: number
  esperar?: (ms: number) => Promise<void>
}

/**
 * Sobe o arquivo e conclui o envio. Devolve a chave do objeto, que é o que a confirmação do corte
 * manda para a API.
 */
export async function enviarEmPartes({
  contractId, file, contentType, api, putParte, storage,
  onProgress, concorrencia = 3, tentativasPorParte = 3, esperar = esperarPadrao,
}: EnvioEmPartes): Promise<string> {
  const chave = chaveDeRetomada(contractId, file)

  let envio = storage.ler(chave)
  if (!envio || !envio.uploadId || !envio.mediaKey) {
    const aberto = await api.start({
      contractId, fileName: file.name, contentType, sizeBytes: file.size,
    })
    envio = { ...aberto, etags: {} }
    storage.gravar(chave, envio)
  }

  const guardado = envio
  const pendentes = Array.from({ length: guardado.partCount }, (_, i) => i + 1)
    .filter((n) => !guardado.etags[n])

  const tamanhoDaParte = (n: number) =>
    Math.min(n * guardado.partSizeBytes, file.size) - (n - 1) * guardado.partSizeBytes

  // Progresso conta o que já estava enviado: retomar não pode voltar a barra para zero.
  const enviado: Record<number, number> = {}
  for (const n of Object.keys(guardado.etags).map(Number)) enviado[n] = tamanhoDaParte(n)

  const avisar = () => {
    if (!onProgress) return
    const total = Object.values(enviado).reduce((a, b) => a + b, 0)
    onProgress(file.size > 0 ? Math.min(total / file.size, 1) : 1)
  }
  avisar()

  const urls = new Map<number, string>()
  const fila = [...pendentes]

  const assinar = async (numero: number) => {
    // Assina em lote: a partir da parte pedida, as próximas que ainda não têm URL. Todas de uma vez
    // seria pior — cada URL vale 30 minutos, e um arquivo grande em conexão lenta passa disso.
    const lote = fila.concat(numero)
      .filter((n) => !urls.has(n))
      .sort((a, b) => a - b)
      .slice(0, 20)
    if (!lote.includes(numero)) lote.push(numero)

    const { parts } = await api.signParts({
      contractId,
      mediaKey: guardado.mediaKey,
      uploadId: guardado.uploadId,
      partNumbers: lote,
    })
    for (const p of parts) urls.set(p.partNumber, p.url)
  }

  const enviarParte = async (numero: number) => {
    const inicio = (numero - 1) * guardado.partSizeBytes
    const corpo = file.slice(inicio, Math.min(inicio + guardado.partSizeBytes, file.size))

    for (let tentativa = 1; ; tentativa++) {
      try {
        if (!urls.has(numero)) await assinar(numero)
        const etag = await putParte(urls.get(numero)!, corpo, (bytes) => {
          enviado[numero] = bytes
          avisar()
        })

        guardado.etags[numero] = etag
        enviado[numero] = tamanhoDaParte(numero)
        storage.gravar(chave, guardado)
        avisar()
        return
      } catch (e) {
        // Pode ter sido a URL vencendo no meio do caminho: joga fora e assina de novo na próxima.
        urls.delete(numero)
        enviado[numero] = 0
        if (tentativa >= tentativasPorParte) throw e
        await esperar(300 * 2 ** tentativa)
      }
    }
  }

  const trabalhador = async () => {
    for (let numero = fila.shift(); numero !== undefined; numero = fila.shift()) {
      await enviarParte(numero)
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concorrencia, pendentes.length || 1)) }, trabalhador))

  const partes: ParteEnviada[] = Object.entries(guardado.etags)
    .map(([numero, eTag]) => ({ partNumber: Number(numero), eTag }))
    .sort((a, b) => a.partNumber - b.partNumber)

  try {
    await api.complete({
      contractId, mediaKey: guardado.mediaKey, uploadId: guardado.uploadId, parts: partes,
    })
  } catch (e) {
    // Conclusão recusada significa envio vencido ou parte que não bate: retomar isto nunca vai dar
    // certo, e insistir com o estado velho prenderia a pessoa num erro que se repete.
    storage.limpar(chave)
    throw e
  }

  storage.limpar(chave)
  return guardado.mediaKey
}
