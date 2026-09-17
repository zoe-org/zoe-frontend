export const int = (v: number) => Math.round(v).toLocaleString("pt-BR")

export const money = (cents: number, currency: string | null) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: (currency || "BRL").toUpperCase(),
  })

export const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

/** Cabe no chip ao lado do nome do plano, onde o mês por extenso estoura a linha. */
export const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
