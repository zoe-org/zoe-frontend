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

export type UploadableFile = Pick<File, "name" | "size" | "lastModified" | "slice">

export type SignedPart = { partNumber: number; url: string }

export type UploadedPart = { partNumber: number; eTag: string }

export type MultipartApi = {
  start: (v: { contractId: string; fileName: string; contentType: string; sizeBytes: number })
    => Promise<{ mediaKey: string; uploadId: string; partSizeBytes: number; partCount: number }>
  signParts: (v: { contractId: string; mediaKey: string; uploadId: string; partNumbers: number[] })
    => Promise<{ parts: SignedPart[] }>
  complete: (v: { contractId: string; mediaKey: string; uploadId: string; parts: UploadedPart[] })
    => Promise<unknown>
}

/** O que sobrevive ao fechamento da aba: onde o envio está e o que já subiu. */
export type StoredUpload = {
  mediaKey: string
  uploadId: string
  partSizeBytes: number
  partCount: number
  /** Número da parte → ETag devolvido pelo storage. */
  etags: Record<number, string>
}

export type UploadStore = {
  read: (key: string) => StoredUpload | null
  write: (key: string, upload: StoredUpload) => void
  clear: (key: string) => void
}

/** Sobe uma parte e devolve o ETag que o storage respondeu. */
export type PutPart = (
  url: string,
  body: Blob,
  onProgress: (partBytes: number) => void,
) => Promise<string>

/**
 * Identidade do arquivo para retomar. Nome, tamanho e data de modificação juntos: escolher outro
 * arquivo (ou reexportar o mesmo vídeo) tem de começar um envio novo, nunca colar partes de dois.
 */
export const resumeKey = (contractId: string, file: UploadableFile) =>
  `zoe-draft-upload:${contractId}:${file.name}:${file.size}:${file.lastModified}`

/** Guarda em `localStorage`, que pode estar indisponível (aba anônima, storage cheio). */
export function localStorageUploadStore(): UploadStore {
  return {
    read: (key) => {
      try {
        const raw = localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as StoredUpload) : null
      } catch {
        return null
      }
    },
    write: (key, upload) => {
      try { localStorage.setItem(key, JSON.stringify(upload)) } catch { /* storage indisponível */ }
    },
    clear: (key) => {
      try { localStorage.removeItem(key) } catch { /* storage indisponível */ }
    },
  }
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export type MultipartUploadOptions = {
  contractId: string
  file: UploadableFile
  contentType: string
  api: MultipartApi
  putPart: PutPart
  storage: UploadStore
  /** 0 a 1, contando o que já estava enviado de antes. */
  onProgress?: (fraction: number) => void
  /** Partes em paralelo. Três: o suficiente para usar a banda sem afogar conexão doméstica. */
  concurrency?: number
  /** Tentativas por parte antes de desistir do envio inteiro. */
  attemptsPerPart?: number
  wait?: (ms: number) => Promise<void>
}

/**
 * Sobe o arquivo e conclui o envio. Devolve a chave do objeto, que é o que a confirmação do corte
 * manda para a API.
 */
export async function uploadInParts({
  contractId, file, contentType, api, putPart, storage,
  onProgress, concurrency = 3, attemptsPerPart = 3, wait = defaultWait,
}: MultipartUploadOptions): Promise<string> {
  const key = resumeKey(contractId, file)

  let upload = storage.read(key)
  if (!upload || !upload.uploadId || !upload.mediaKey) {
    const started = await api.start({
      contractId, fileName: file.name, contentType, sizeBytes: file.size,
    })
    upload = { ...started, etags: {} }
    storage.write(key, upload)
  }

  const stored = upload
  const pending = Array.from({ length: stored.partCount }, (_, i) => i + 1)
    .filter((n) => !stored.etags[n])

  const partSize = (n: number) =>
    Math.min(n * stored.partSizeBytes, file.size) - (n - 1) * stored.partSizeBytes

  // Progresso conta o que já estava enviado: retomar não pode voltar a barra para zero.
  const uploadedBytes: Record<number, number> = {}
  for (const n of Object.keys(stored.etags).map(Number)) uploadedBytes[n] = partSize(n)

  const reportProgress = () => {
    if (!onProgress) return
    const total = Object.values(uploadedBytes).reduce((a, b) => a + b, 0)
    onProgress(file.size > 0 ? Math.min(total / file.size, 1) : 1)
  }
  reportProgress()

  const urls = new Map<number, string>()
  const queue = [...pending]

  const signBatch = async (partNumber: number) => {
    // Assina em lote: a partir da parte pedida, as próximas que ainda não têm URL. Todas de uma vez
    // seria pior — cada URL vale 30 minutos, e um arquivo grande em conexão lenta passa disso.
    const batch = queue.concat(partNumber)
      .filter((n) => !urls.has(n))
      .sort((a, b) => a - b)
      .slice(0, 20)
    if (!batch.includes(partNumber)) batch.push(partNumber)

    const { parts } = await api.signParts({
      contractId,
      mediaKey: stored.mediaKey,
      uploadId: stored.uploadId,
      partNumbers: batch,
    })
    for (const p of parts) urls.set(p.partNumber, p.url)
  }

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * stored.partSizeBytes
    const body = file.slice(start, Math.min(start + stored.partSizeBytes, file.size))

    for (let attempt = 1; ; attempt++) {
      try {
        if (!urls.has(partNumber)) await signBatch(partNumber)
        const etag = await putPart(urls.get(partNumber)!, body, (bytes) => {
          uploadedBytes[partNumber] = bytes
          reportProgress()
        })

        stored.etags[partNumber] = etag
        uploadedBytes[partNumber] = partSize(partNumber)
        storage.write(key, stored)
        reportProgress()
        return
      } catch (e) {
        // Pode ter sido a URL vencendo no meio do caminho: joga fora e assina de novo na próxima.
        urls.delete(partNumber)
        uploadedBytes[partNumber] = 0
        if (attempt >= attemptsPerPart) throw e
        await wait(300 * 2 ** attempt)
      }
    }
  }

  const worker = async () => {
    for (let partNumber = queue.shift(); partNumber !== undefined; partNumber = queue.shift()) {
      await uploadPart(partNumber)
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, pending.length || 1)) }, worker))

  const parts: UploadedPart[] = Object.entries(stored.etags)
    .map(([partNumber, eTag]) => ({ partNumber: Number(partNumber), eTag }))
    .sort((a, b) => a.partNumber - b.partNumber)

  try {
    await api.complete({
      contractId, mediaKey: stored.mediaKey, uploadId: stored.uploadId, parts,
    })
  } catch (e) {
    // Conclusão recusada significa envio vencido ou parte que não bate: retomar isto nunca vai dar
    // certo, e insistir com o estado velho prenderia a pessoa num erro que se repete.
    storage.clear(key)
    throw e
  }

  storage.clear(key)
  return stored.mediaKey
}
