import { describe, it, expect } from "vitest"
import { escapeCsvCell, toCsv } from "./csv"

/**
 * Testes de SEGURANÇA (RN-I-070). Título de vídeo, nome de canal e texto de
 * comentário vêm do YouTube — input hostil. Uma célula iniciada por `= + - @`
 * é executada como fórmula ao abrir o CSV no Excel/Sheets.
 */
/**
 * Desfaz o quoting RFC 4180 pra inspecionar o VALOR que o planilhador vai ler.
 * Necessário porque uma célula com vírgula/aspas/CR sai envolvida em aspas — o
 * que importa pra segurança é o 1º caractere do valor desembrulhado.
 */
function unquote(cell: string): string {
  return cell.startsWith('"') && cell.endsWith('"')
    ? cell.slice(1, -1).replace(/""/g, '"')
    : cell
}

describe("escapeCsvCell — formula injection", () => {
  it.each([
    ["=1+1"],
    ['=HYPERLINK("http://evil","clique")'],
    ["=cmd|'/c calc'!A1"],
    ["+1+1"],
    ["-1+1"],
    ["@SUM(A1)"],
    [" =1+1"], // espaço à esquerda: truque comum de bypass
    ["\t=1+1"],
    ["\r=1+1"], // sai entre aspas (CR), mas o valor começa com '
  ])("neutraliza %j — o valor lido pelo Excel começa com aspa simples", (payload) => {
    expect(unquote(escapeCsvCell(payload))).toMatch(/^'/)
  })

  it("NÃO estraga texto legítimo (sem falso positivo)", () => {
    expect(escapeCsvCell("Nubank vs Itaú")).toBe("Nubank vs Itaú")
    // Hífen no MEIO não é fórmula — não pode ganhar aspa simples.
    expect(escapeCsvCell("Banco - Digital")).toBe("Banco - Digital")
    expect(escapeCsvCell(42)).toBe("42")
  })
})

describe("escapeCsvCell — quoting RFC 4180", () => {
  it("envolve em aspas quando há vírgula", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"')
  })

  it("duplica aspas internas", () => {
    expect(escapeCsvCell('diz "oi"')).toBe('"diz ""oi"""')
  })

  it("envolve em aspas quando há quebra de linha", () => {
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"')
  })

  it("trata null/undefined como célula vazia", () => {
    expect(escapeCsvCell(null)).toBe("")
    expect(escapeCsvCell(undefined)).toBe("")
  })
})

describe("toCsv", () => {
  it("monta cabeçalho + linhas com CRLF e escapa tudo", () => {
    const rows = [{ titulo: "=cmd|'/c calc'!A1", canal: "Canal, S.A." }]
    const csv = toCsv(rows, [
      { header: "Título", value: (r) => r.titulo },
      { header: "Canal", value: (r) => r.canal },
    ])

    const [head, line] = csv.split("\r\n")
    expect(head).toBe("Título,Canal")
    expect(line).toBe(`'=cmd|'/c calc'!A1,"Canal, S.A."`)
  })

  it("lida com lista vazia (só cabeçalho)", () => {
    expect(toCsv([], [{ header: "A", value: () => "" }])).toBe("A")
  })
})
