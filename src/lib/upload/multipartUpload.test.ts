import { describe, it, expect, vi } from "vitest"
import {
  enviarEmPartes, chaveDeRetomada,
  type ArquivoEnviavel, type EnvioGuardado, type GuardaDeEnvio, type MultipartApi,
} from "./multipartUpload"

const MB = 1024 * 1024

const arquivo = (tamanho: number): ArquivoEnviavel => ({
  name: "corte.mp4",
  size: tamanho,
  lastModified: 1_700_000_000,
  slice: (inicio = 0, fim = tamanho) => ({ size: Number(fim) - Number(inicio) }) as Blob,
})

function memoria(inicial: Record<string, EnvioGuardado> = {}) {
  const dados: Record<string, EnvioGuardado> = structuredClone(inicial)
  const guarda: GuardaDeEnvio = {
    ler: (chave) => dados[chave] ?? null,
    gravar: (chave, envio) => { dados[chave] = structuredClone(envio) },
    limpar: (chave) => { delete dados[chave] },
  }
  return { guarda, dados }
}

/** API falsa: abre um envio de 3 partes de 8 MiB e assina a URL de cada uma. */
function apiFalsa(over: Partial<MultipartApi> = {}) {
  const complete = vi.fn(async () => ({}))
  const signParts = vi.fn(async (v: { partNumbers: number[] }) => ({
    parts: v.partNumbers.map((n) => ({ partNumber: n, url: `https://s3.test/parte/${n}` })),
  }))
  const start = vi.fn(async () => ({
    mediaKey: "delivery-drafts/t/c/abc.mp4",
    uploadId: "upload-1",
    partSizeBytes: 8 * MB,
    partCount: 3,
  }))
  return { start, signParts, complete, ...over } as MultipartApi & {
    start: typeof start; signParts: typeof signParts; complete: typeof complete
  }
}

/**
 * Sobe a parte olhando o número na URL, para o teste saber o que foi enviado.
 *
 * Função simples, não `vi.fn`: um mock compartilhado entre testes soma as chamadas de todos.
 */
const putOk = async (url: string, corpo: Blob, onProgress: (b: number) => void) => {
  onProgress(corpo.size)
  return `"etag-${url.split("/").pop()}"`
}

const semEspera = async () => {}

const padrao = (over: Partial<Parameters<typeof enviarEmPartes>[0]> = {}) => ({
  contractId: "c1",
  file: arquivo(20 * MB),
  contentType: "video/mp4",
  concorrencia: 1,
  esperar: semEspera,
  ...over,
})

describe("envio em partes", () => {
  it("sobe todas as partes e conclui com os ETags em ordem", async () => {
    const api = apiFalsa()
    const { guarda, dados } = memoria()
    const put = vi.fn(putOk)

    const chave = await enviarEmPartes(padrao({ api, storage: guarda, putParte: put }) as never)

    expect(chave).toBe("delivery-drafts/t/c/abc.mp4")
    expect(put).toHaveBeenCalledTimes(3)
    expect(api.complete).toHaveBeenCalledWith(expect.objectContaining({
      mediaKey: "delivery-drafts/t/c/abc.mp4",
      uploadId: "upload-1",
      parts: [
        { partNumber: 1, eTag: '"etag-1"' },
        { partNumber: 2, eTag: '"etag-2"' },
        { partNumber: 3, eTag: '"etag-3"' },
      ],
    }))
    // Concluído, não há o que retomar: o estado sai do navegador.
    expect(dados).toEqual({})
  })

  it("retoma sem reenviar o que já subiu", async () => {
    const file = arquivo(20 * MB)
    const api = apiFalsa()
    const { guarda } = memoria({
      [chaveDeRetomada("c1", file)]: {
        mediaKey: "delivery-drafts/t/c/abc.mp4",
        uploadId: "upload-1",
        partSizeBytes: 8 * MB,
        partCount: 3,
        etags: { 1: '"etag-1"', 2: '"etag-2"' },
      },
    })
    const put = vi.fn(putOk)
    const progresso: number[] = []

    await enviarEmPartes(padrao({
      file, api, storage: guarda, putParte: put, onProgress: (f) => progresso.push(f),
    }) as never)

    // Nem abre envio novo, nem sobe de novo o que já estava lá.
    expect(api.start).not.toHaveBeenCalled()
    expect(put).toHaveBeenCalledTimes(1)
    expect(api.signParts).toHaveBeenCalledWith(expect.objectContaining({ partNumbers: [3] }))
    expect(api.complete).toHaveBeenCalledWith(expect.objectContaining({
      parts: [
        { partNumber: 1, eTag: '"etag-1"' },
        { partNumber: 2, eTag: '"etag-2"' },
        { partNumber: 3, eTag: '"etag-3"' },
      ],
    }))
    // A barra não volta a zero ao retomar: começa no que já subiu.
    expect(progresso[0]).toBeCloseTo((16 * MB) / (20 * MB), 5)
    expect(progresso.at(-1)).toBe(1)
  })

  it("repete a parte que falhou, pedindo outra URL", async () => {
    const api = apiFalsa()
    const { guarda } = memoria()
    let falhou = false
    const put = vi.fn(async (url: string, corpo: Blob, onProgress: (b: number) => void) => {
      if (!falhou && url.endsWith("/2")) {
        falhou = true
        throw new Error("conexão caiu")
      }
      return putOk(url, corpo, onProgress)
    })

    await enviarEmPartes(padrao({ api, storage: guarda, putParte: put }) as never)

    expect(put).toHaveBeenCalledTimes(4)
    // URL vencida é uma das causas da queda: a parte repetida pede assinatura de novo.
    expect(api.signParts.mock.calls.flatMap((c) => c[0].partNumbers)).toContain(2)
    expect(api.complete).toHaveBeenCalledOnce()
  })

  it("desiste depois das tentativas e guarda o que já subiu", async () => {
    const file = arquivo(20 * MB)
    const api = apiFalsa()
    const { guarda, dados } = memoria()
    const put = vi.fn(async (url: string, corpo: Blob, onProgress: (b: number) => void) => {
      if (url.endsWith("/2")) throw new Error("conexão caiu")
      return putOk(url, corpo, onProgress)
    })

    await expect(enviarEmPartes(padrao({
      file, api, storage: guarda, putParte: put, tentativasPorParte: 2,
    }) as never)).rejects.toThrow("conexão caiu")

    expect(api.complete).not.toHaveBeenCalled()
    // O que subiu continua guardado — é isso que faz o próximo envio recomeçar do meio.
    expect(dados[chaveDeRetomada("c1", file)].etags).toEqual({ 1: '"etag-1"' })
  })

  it("conclusão recusada limpa o estado, porque retomar não resolveria", async () => {
    const file = arquivo(20 * MB)
    const api = apiFalsa({ complete: vi.fn(async () => { throw new Error("upload_incomplete") }) })
    const { guarda, dados } = memoria()

    await expect(enviarEmPartes(padrao({
      file, api, storage: guarda, putParte: vi.fn(putOk),
    }) as never)).rejects.toThrow("upload_incomplete")

    expect(dados[chaveDeRetomada("c1", file)]).toBeUndefined()
  })
})
