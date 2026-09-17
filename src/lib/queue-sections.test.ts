import { describe, expect, it } from "vitest"
import { itensVisiveis, secoesPorCampanha, SECAO_SEM_CAMPANHA } from "./queue-sections"

type Item = { id: string; campanhaId: string | null; campanha: string | null; pendente: boolean }

const item = (id: string, campanhaId: string | null, pendente = true): Item => ({
  id, campanhaId, campanha: campanhaId ? `Campanha ${campanhaId}` : null, pendente,
})

const secoes = (itens: Item[]) => secoesPorCampanha(
  itens,
  (i) => ({ id: i.campanhaId, nome: i.campanha }),
  (i) => i.pendente,
  (nome) => nome ?? "Sem campanha",
)

describe("secoesPorCampanha", () => {
  it("mantém a ordem da fila: a campanha do item mais urgente vem primeiro", () => {
    const s = secoes([item("1", "b"), item("2", "a"), item("3", "b"), item("4", null)])

    expect(s.map((x) => x.chave)).toEqual(["b", "a", SECAO_SEM_CAMPANHA])
    expect(s[0].itens.map((x) => x.id)).toEqual(["1", "3"])
    expect(s[2].rotulo).toBe("Sem campanha")
  })

  it("conta só o que espera decisão", () => {
    const [unica] = secoes([item("1", "a"), item("2", "a", false), item("3", "a")])
    expect(unica).toMatchObject({ rotulo: "Campanha a", pendentes: 2 })
    expect(unica.itens).toHaveLength(3)
  })
})

describe("itensVisiveis", () => {
  it("percorre na ordem das seções e pula as recolhidas", () => {
    const s = secoes([item("1", "b"), item("2", "a"), item("3", "b")])

    expect(itensVisiveis(s, new Set()).map((x) => x.id)).toEqual(["1", "3", "2"])
    expect(itensVisiveis(s, new Set(["b"])).map((x) => x.id)).toEqual(["2"])
  })
})
