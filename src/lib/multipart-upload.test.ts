import { describe, it, expect, vi } from "vitest"
import {
  uploadInParts, resumeKey,
  type UploadableFile, type StoredUpload, type UploadStore, type MultipartApi,
} from "./multipart-upload"

const MB = 1024 * 1024

const fakeFile = (size: number): UploadableFile => ({
  name: "corte.mp4",
  size,
  lastModified: 1_700_000_000,
  slice: (start = 0, end = size) => ({ size: Number(end) - Number(start) }) as Blob,
})

function memoryStore(initial: Record<string, StoredUpload> = {}) {
  const data: Record<string, StoredUpload> = structuredClone(initial)
  const store: UploadStore = {
    read: (key) => data[key] ?? null,
    write: (key, upload) => { data[key] = structuredClone(upload) },
    clear: (key) => { delete data[key] },
  }
  return { store, data }
}

/** API falsa: abre um envio de 3 partes de 8 MiB e assina a URL de cada uma. */
function fakeApi(over: Partial<MultipartApi> = {}) {
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
 * PUT falso que lê o número da parte na URL; função simples, porque um <code>vi.fn</code> compartilhado somaria chamadas.
 */
const putOk = async (url: string, body: Blob, onProgress: (b: number) => void) => {
  onProgress(body.size)
  return `"etag-${url.split("/").pop()}"`
}

const noWait = async () => {}

const defaults = (over: Partial<Parameters<typeof uploadInParts>[0]> = {}) => ({
  contractId: "c1",
  file: fakeFile(20 * MB),
  contentType: "video/mp4",
  concurrency: 1,
  wait: noWait,
  ...over,
})

describe("envio em partes", () => {
  it("sobe todas as partes e conclui com os ETags em ordem", async () => {
    const api = fakeApi()
    const { store, data } = memoryStore()
    const put = vi.fn(putOk)

    const key = await uploadInParts(defaults({ api, storage: store, putPart: put }) as never)

    expect(key).toBe("delivery-drafts/t/c/abc.mp4")
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
    expect(data).toEqual({})
  })

  it("retoma sem reenviar o que já subiu", async () => {
    const file = fakeFile(20 * MB)
    const api = fakeApi()
    const { store } = memoryStore({
      [resumeKey("c1", file)]: {
        mediaKey: "delivery-drafts/t/c/abc.mp4",
        uploadId: "upload-1",
        partSizeBytes: 8 * MB,
        partCount: 3,
        etags: { 1: '"etag-1"', 2: '"etag-2"' },
      },
    })
    const put = vi.fn(putOk)
    const progress: number[] = []

    await uploadInParts(defaults({
      file, api, storage: store, putPart: put, onProgress: (f) => progress.push(f),
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
    expect(progress[0]).toBeCloseTo((16 * MB) / (20 * MB), 5)
    expect(progress.at(-1)).toBe(1)
  })

  it("repete a parte que falhou, pedindo outra URL", async () => {
    const api = fakeApi()
    const { store } = memoryStore()
    let failed = false
    const put = vi.fn(async (url: string, body: Blob, onProgress: (b: number) => void) => {
      if (!failed && url.endsWith("/2")) {
        failed = true
        throw new Error("conexão caiu")
      }
      return putOk(url, body, onProgress)
    })

    await uploadInParts(defaults({ api, storage: store, putPart: put }) as never)

    expect(put).toHaveBeenCalledTimes(4)
    // URL vencida é uma das causas da queda: a parte repetida pede assinatura de novo.
    expect(api.signParts.mock.calls.flatMap((c) => c[0].partNumbers)).toContain(2)
    expect(api.complete).toHaveBeenCalledOnce()
  })

  it("desiste depois das tentativas e guarda o que já subiu", async () => {
    const file = fakeFile(20 * MB)
    const api = fakeApi()
    const { store, data } = memoryStore()
    const put = vi.fn(async (url: string, body: Blob, onProgress: (b: number) => void) => {
      if (url.endsWith("/2")) throw new Error("conexão caiu")
      return putOk(url, body, onProgress)
    })

    await expect(uploadInParts(defaults({
      file, api, storage: store, putPart: put, attemptsPerPart: 2,
    }) as never)).rejects.toThrow("conexão caiu")

    expect(api.complete).not.toHaveBeenCalled()
    // O que subiu continua guardado — é isso que faz o próximo envio recomeçar do meio.
    expect(data[resumeKey("c1", file)].etags).toEqual({ 1: '"etag-1"' })
  })

  it("conclusão recusada limpa o estado, porque retomar não resolveria", async () => {
    const file = fakeFile(20 * MB)
    const api = fakeApi({ complete: vi.fn(async () => { throw new Error("upload_incomplete") }) })
    const { store, data } = memoryStore()

    await expect(uploadInParts(defaults({
      file, api, storage: store, putPart: vi.fn(putOk),
    }) as never)).rejects.toThrow("upload_incomplete")

    expect(data[resumeKey("c1", file)]).toBeUndefined()
  })
})
