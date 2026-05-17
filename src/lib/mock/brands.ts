export type Brand = {
  id: string; name: string; initial: string; color: string
  mentions: number; keywords: number; mentionGoal: number
  mentionProgress: number; status: "active" | "paused" | "configuring"
}

export const brands: Brand[] = [
  { id: "b1", name: "Nubank", initial: "N", color: "#820AD1", mentions: 847, keywords: 12, mentionGoal: 1000, mentionProgress: 84, status: "active" },
  { id: "b2", name: "iFood", initial: "i", color: "#EA1D2C", mentions: 523, keywords: 8, mentionGoal: 800, mentionProgress: 65, status: "active" },
  { id: "b3", name: "XP Investimentos", initial: "X", color: "#FFCB05", mentions: 0, keywords: 5, mentionGoal: 500, mentionProgress: 0, status: "paused" },
]
