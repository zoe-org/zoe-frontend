/**
 * Geração de CSV com proteção contra **formula injection** (RN-I-070).
 *
 * O risco: uma célula que começa com `=`, `+`, `-`, `@` (ou TAB/CR) é
 * interpretada como FÓRMULA por Excel/LibreOffice/Google Sheets ao abrir o
 * arquivo. Como o conteúdo aqui vem do YouTube (título de vídeo, nome de canal,
 * texto de comentário — input hostil), um título como
 * `=HYPERLINK("http://evil","clique")` ou `=cmd|'/c calc'!A1` vira execução no
 * computador de quem abre o relatório. Escapar aspas (RFC 4180) NÃO resolve
 * isso: o problema é o caractere inicial, não o delimitador.
 *
 * Mitigação (OWASP): prefixar a célula perigosa com aspa simples `'`, que o
 * planilhador consome como "trate como texto". Aplicamos DEPOIS de aparar
 * espaços à esquerda, porque `" =1+1"` também dispara a fórmula em alguns
 * leitores.
 */

/** Caracteres que iniciam fórmula nos principais planilhadores. */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"]

/**
 * Neutraliza uma célula: desarma fórmula e aplica quoting RFC 4180.
 * Exportado só para teste/reuso — o caminho normal é `toCsv`.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ""

  let cell = String(value)

  // Formula injection: olha o 1º caractere NÃO-branco. `" =1+1"` é tão perigoso
  // quanto `"=1+1"`, então a checagem ignora o espaçamento à esquerda.
  const firstMeaningful = cell.trimStart().charAt(0)
  if (firstMeaningful && FORMULA_TRIGGERS.includes(firstMeaningful)) {
    cell = `'${cell}`
  }

  // RFC 4180: campo com aspas, delimitador ou quebra de linha vai entre aspas,
  // com as aspas internas duplicadas.
  if (/[",\n\r]/.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`
  }

  return cell
}

export type CsvColumn<T> = {
  header: string
  /** Valor bruto da célula; a neutralização é aplicada depois, sempre. */
  value: (row: T) => unknown
}

/** Monta o CSV completo (cabeçalho + linhas), tudo passando pelo escape. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCsvCell(c.header)).join(",")
  const body = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(","))
  return [head, ...body].join("\r\n")
}

/**
 * Dispara o download no browser. O BOM (U+FEFF) é o que faz o Excel abrir
 * UTF-8 corretamente — sem ele, acentos viram mojibake.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
