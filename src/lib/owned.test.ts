import { describe, expect, it } from "vitest"
import {
  DEFAULT_CHANNEL_RELATION,
  hasSelfMeasuredScore,
  parseChannelRelation,
  type VideoListItem,
} from "@/lib/api/videos"
import { startOfToday, windowFrom } from "@/lib/date-window"

describe("parseChannelRelation — default seguro na URL", () => {
  it("aceita os três valores conhecidos", () => {
    expect(parseChannelRelation("owned")).toBe("owned")
    expect(parseChannelRelation("all")).toBe("all")
    expect(parseChannelRelation("earned")).toBe("earned")
  })

  it("cai em earned para QUALQUER coisa inválida — nunca em all", () => {
    // A URL é compartilhável e sobrevive em bookmark: link antigo, typo ou param
    // renomeado não podem escorregar pra "all" e passar a incluir conteúdo próprio
    // numa contagem sem o usuário pedir. Mesmo raciocínio do ThirdParty = 0.
    for (const ruim of ["", "ALL", "All", "todos", "third_party", "1", "true", "ownedx", null, undefined]) {
      expect(parseChannelRelation(ruim)).toBe(DEFAULT_CHANNEL_RELATION)
      expect(parseChannelRelation(ruim)).not.toBe("all")
    }
  })

  it("o default é earned", () => {
    expect(DEFAULT_CHANNEL_RELATION).toBe("earned")
  })
})

describe("hasSelfMeasuredScore — score contaminado pelo próprio roteiro", () => {
  const video = (channelRelation: "Owned" | "ThirdParty", pipelinePath: string): VideoListItem =>
    ({ channelRelation, pipelinePath }) as VideoListItem

  it("vídeo de terceiro nunca é auto-medido, em nenhum path", () => {
    for (const path of ["Full", "VideoCaption", "CaptionFallback", "CommentsOnly"]) {
      expect(hasSelfMeasuredScore(video("ThirdParty", path))).toBe(false)
    }
  })

  it("owned pelos paths que incluem texto ou visual é contaminado", () => {
    // CaptionFallback entra: é legenda(0.30) + comentários(0.50), e em vídeo owned a
    // legenda é o roteiro da própria marca — mesma contaminação de Full.
    for (const path of ["Full", "VideoCaption", "CaptionFallback"]) {
      expect(hasSelfMeasuredScore(video("Owned", path))).toBe(true)
    }
  })

  it("owned com score 100% comentários é leitura limpa", () => {
    // CommentsOnly é o path DEGRADADO, mas sua composição é comentário puro: o badge
    // comunica a degradação e o número em si mede audiência de verdade.
    for (const path of ["CommentsOnly", "OwnedComments", "OwnedNoSignal"]) {
      expect(hasSelfMeasuredScore(video("Owned", path))).toBe(false)
    }
  })

  it("path desconhecido em vídeo owned é tratado como contaminado", () => {
    // Definido por inclusão: um path novo do pipeline não pode passar como limpo
    // por omissão. O default errado aqui é exibir um número que mente.
    expect(hasSelfMeasuredScore(video("Owned", "AlgumPathFuturo"))).toBe(true)
  })
})

describe("janela de datas ancorada em fronteira de dia", () => {
  it("startOfToday zera a hora local e é estável dentro do dia", () => {
    const d = new Date(startOfToday())
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    // Duas chamadas no mesmo dia devolvem o mesmo instante — é isso que impede a
    // janela de escorregar numa aba aberta e faz dois usuários verem o mesmo corte.
    expect(startOfToday()).toBe(startOfToday())
  })

  it("windowFrom recua N dias a partir da âncora", () => {
    const anchor = new Date("2026-08-05T00:00:00").getTime()
    expect(windowFrom(30, anchor)).toBe(new Date(anchor - 30 * 86_400_000).toISOString())
    expect(windowFrom("90", anchor)).toBe(new Date(anchor - 90 * 86_400_000).toISOString())
  })

  it("período vazio significa 'todo o período', não janela de zero dias", () => {
    const anchor = startOfToday()
    expect(windowFrom("", anchor)).toBeUndefined()
    expect(windowFrom(0, anchor)).toBeUndefined()
    expect(windowFrom("abc", anchor)).toBeUndefined()
  })
})
