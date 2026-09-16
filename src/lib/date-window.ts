/**
 * Janela de datas dos filtros de período.
 *
 * ## Por que ancorar em fronteira de dia
 *
 * O caminho ingênuo (`Date.now()` durante o render) é impuro e recalcula o corte a
 * cada re-render, invalidando o cache da query. Congelar com
 * `useState(() => Date.now())` conserta isso e cria outro problema: uma aba deixada
 * aberta de um dia para o outro passa a mostrar "últimos 30 dias" contados de ontem,
 * silenciosamente — e um colega que acabou de abrir vê números diferentes para o
 * mesmo filtro.
 *
 * Ancorar no início do dia resolve os dois: o valor é estável durante todo o dia (não
 * escorrega, não invalida cache) e é o MESMO para todo mundo que abrir hoje, então
 * dois usuários comparando telas veem a mesma janela.
 *
 * Fronteira em horário LOCAL, não UTC: "últimos 30 dias" é uma pergunta que o usuário
 * faz no fuso dele, e no Brasil o corte UTC cairia às 21h do dia anterior.
 */

/** Início do dia corrente em horário local, em epoch ms. Estável dentro do dia. */
export function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * `from` ISO para uma janela de N dias ancorada no início de hoje.
 * `days` vazio/0 ⇒ `undefined` (sem corte — "todo o período").
 */
export function windowFrom(days: string | number, anchor: number): string | undefined {
  const n = typeof days === "number" ? days : Number(days)
  if (!n || Number.isNaN(n)) return undefined
  return new Date(anchor - n * 86_400_000).toISOString()
}
