import { describe, expect, it, vi } from "vitest"

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn(), signOut: vi.fn() }))

import { ApiError } from "@/lib/api"
import { describeError } from "@/lib/api-error"

describe("describeError", () => {
  it("usa o erro de campo do FluentValidation antes do detail", () => {
    const err = new ApiError(400, "Dados inválidos", {
      detail: "One or more validation errors occurred.",
      errors: { Name: ["O nome precisa ter ao menos 2 caracteres."] },
    })

    expect(describeError(err, "falhou").message).toBe("O nome precisa ter ao menos 2 caracteres.")
  })

  it("usa o detail do ProblemDetails e carrega código e traceId", () => {
    const err = new ApiError(400, "x", {
      detail: "Este workspace ainda não tem forma de pagamento cadastrada.",
      code: "payment_method_required",
      traceId: "00-abc-01",
    })

    expect(describeError(err, "falhou")).toEqual({
      message: "Este workspace ainda não tem forma de pagamento cadastrada.",
      code: "payment_method_required",
      traceId: "00-abc-01",
    })
  })

  it("cai no texto da tela quando o erro não veio da API", () => {
    expect(describeError(new TypeError("Failed to fetch"), "Não foi possível salvar.")).toEqual({
      message: "Não foi possível salvar.",
    })
    expect(describeError(null, "Não foi possível copiar.").message).toBe("Não foi possível copiar.")
  })
})
