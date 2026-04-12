# Zoe Frontend — Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all platform pages (Login, Register, Dashboard, Monitoring, Sentiment, Influencers, Brands, Alerts, Reports) with a redesigned AppShell, shared UI components, and mock data — as defined in `docs/superpowers/specs/2026-04-09-zoe-pages-design.md`.

**Architecture:** AppShell with collapsible sidebar (accordion for Intelligence sub-pages) + topbar + breadcrumb. Pages consume typed mock data from `src/lib/mock/`. No real chart library — CSS/div-based visualizations for MVP. No test infrastructure (pure UI MVP with visual verification via dev server).

**Tech Stack:** React 19, TypeScript, Vite 8, TailwindCSS v4, shadcn/ui (radix-nova style), React Router v7, React Query, AWS Cognito (Amplify), lucide-react icons, Geist font.

**Existing files to be aware of:**
- `src/features/auth/useAuth.ts` — exports `auth` object with `login`, `register`, `confirm`, `logout`, `current`, `token`
- `src/features/auth/AuthContext.tsx` — exports `AuthProvider` and `useAuth` hook (gives `{ user, loading, refresh }`)
- `src/lib/cognito.ts` — Amplify config (uses `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`)
- `src/lib/api.ts` — generic `api<T>()` fetch wrapper with auth token
- `src/styles/globals.css` — design tokens already defined (`--color-teal-500`, `--color-ember`, `--color-midnight`, `--color-ivory`)
- shadcn components already installed: `button`, `input`, `label`, `card`, `avatar`, `dropdown-menu`, `separator`, `tooltip`, `sonner`, `sheet`

**Note on testing:** This project has no test infrastructure (no vitest, no @testing-library/react). This is a UI MVP with mock data. Verification is done visually via `npm run dev` and `npm run build` for type-checking. Each task should end with a build check.

---

## Phase 1: Foundation (sequential — must complete before Phase 2)

### Task 1: ProtectedRoute Component

**Files:**
- Create: `src/features/auth/ProtectedRoute.tsx`

This component is imported by `src/app/router.tsx` but doesn't exist yet.

- [ ] **Step 1: Create ProtectedRoute component**

```tsx
// src/features/auth/ProtectedRoute.tsx
import { Navigate } from "react-router-dom"
import { useAuth } from "@/features/auth/AuthContext"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[--color-teal-500] border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors related to ProtectedRoute import.

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/ProtectedRoute.tsx
git commit -m "feat: add ProtectedRoute component for auth-gated pages"
```

---

### Task 2: Shared UI Components

**Files:**
- Create: `src/components/ui/kpi-card.tsx`
- Create: `src/components/ui/sentiment-badge.tsx`
- Create: `src/components/ui/filter-chip.tsx`
- Create: `src/components/ui/page-header.tsx`
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/breadcrumb.tsx`

- [ ] **Step 1: Create KpiCard component**

```tsx
// src/components/ui/kpi-card.tsx
import { cn } from "@/lib/utils"

type KpiCardProps = {
  label: string
  value: string | number
  meta?: string          // e.g. "Meta: 1.000"
  progress?: number      // 0-100
  barColor?: "teal" | "amber" | "red"
  sublabel?: string      // e.g. "2 criticos · 1 aviso"
  valueColor?: string    // override value text color
}

const barColors = {
  teal: "bg-[#00A799]",
  amber: "bg-[#D97706]",
  red: "bg-[#DC2626]",
}

export function KpiCard({ label, value, meta, progress, barColor = "teal", sublabel, valueColor }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg border p-4 flex flex-col gap-2">
      <span className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">{label}</span>
      <span className={cn("text-2xl font-bold", valueColor)}>{value}</span>
      {sublabel && <span className="text-xs text-[#6B7280]">{sublabel}</span>}
      {meta && <span className="text-xs text-[#6B7280]">{meta}</span>}
      {progress !== undefined && (
        <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColors[barColor])}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create SentimentBadge component**

```tsx
// src/components/ui/sentiment-badge.tsx
import { cn } from "@/lib/utils"

type Sentiment = "positive" | "negative" | "neutral"

const styles: Record<Sentiment, string> = {
  positive: "text-[#16A34A] bg-[#F0FDF4]",
  negative: "text-[#DC2626] bg-[#FEF2F2]",
  neutral: "text-[#6B7280] bg-[#F3F4F6]",
}

const labels: Record<Sentiment, string> = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
}

export function SentimentBadge({ sentiment, score }: { sentiment: Sentiment; score?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", styles[sentiment])}>
      {labels[sentiment]}
      {score !== undefined && <span>({score > 0 ? "+" : ""}{score.toFixed(2)})</span>}
    </span>
  )
}
```

- [ ] **Step 3: Create FilterChip component**

```tsx
// src/components/ui/filter-chip.tsx
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type FilterChipProps = {
  label: string
  active?: boolean
  hasDropdown?: boolean
  onClick?: () => void
}

export function FilterChip({ label, active, hasDropdown = true, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-[#00A799]/10 text-[#00A799] border-[#00A799]/30"
          : "bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]"
      )}
    >
      {label}
      {hasDropdown && <ChevronDown className="w-3 h-3" />}
    </button>
  )
}
```

- [ ] **Step 4: Create PageHeader component**

```tsx
// src/components/ui/page-header.tsx
type PageHeaderProps = {
  title: string
  subtitle?: string
  children?: React.ReactNode  // right-side actions
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-[--color-midnight]">{title}</h1>
        {subtitle && <p className="text-sm text-[#6B7280] mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 5: Create EmptyState component**

```tsx
// src/components/ui/empty-state.tsx
import { Button } from "@/components/ui/button"
import { InboxIcon } from "lucide-react"

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-[#6B7280]">
        {icon ?? <InboxIcon className="w-12 h-12" />}
      </div>
      <h3 className="text-lg font-semibold text-[--color-midnight] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#6B7280] mb-4 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-[--color-ember] hover:bg-[--color-ember]/90 text-white">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create Breadcrumb component**

```tsx
// src/components/ui/breadcrumb.tsx
import { Link, useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/intelligence": "Intelligence",
  "/intelligence/monitoring": "Monitoramento",
  "/intelligence/sentiment": "Sentimento",
  "/intelligence/influencers": "Influenciadores",
  "/alerts": "Alertas",
  "/brands": "Marcas",
  "/reports": "Relatórios",
}

// Maps pages to their parent group for breadcrumb display
const parentGroups: Record<string, { label: string; path?: string }> = {
  "/intelligence/monitoring": { label: "Intelligence" },
  "/intelligence/sentiment": { label: "Intelligence" },
  "/intelligence/influencers": { label: "Intelligence" },
  "/alerts": { label: "Intelligence" },
  "/brands": { label: "Gestão" },
  "/reports": { label: "Gestão" },
}

export function Breadcrumb() {
  const { pathname } = useLocation()

  // No breadcrumb on dashboard
  if (pathname === "/dashboard") return null

  const parent = parentGroups[pathname]
  const currentLabel = routeLabels[pathname]
  if (!currentLabel) return null

  return (
    <nav className="flex items-center gap-1 text-xs text-[#6B7280] mb-4">
      {parent && (
        <>
          <span>{parent.label}</span>
          <ChevronRight className="w-3 h-3" />
        </>
      )}
      <span className="text-[--color-midnight] font-medium">{currentLabel}</span>
    </nav>
  )
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Clean compilation of all new components.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/kpi-card.tsx src/components/ui/sentiment-badge.tsx src/components/ui/filter-chip.tsx src/components/ui/page-header.tsx src/components/ui/empty-state.tsx src/components/ui/breadcrumb.tsx
git commit -m "feat: add shared UI components (KpiCard, SentimentBadge, FilterChip, PageHeader, EmptyState, Breadcrumb)"
```

---

### Task 3: Mock Data Files

**Files:**
- Create: `src/lib/mock/dashboard.ts`
- Create: `src/lib/mock/monitoring.ts`
- Create: `src/lib/mock/sentiment.ts`
- Create: `src/lib/mock/influencers.ts`
- Create: `src/lib/mock/brands.ts`
- Create: `src/lib/mock/alerts.ts`
- Create: `src/lib/mock/reports.ts`

- [ ] **Step 1: Create dashboard mock data**

```ts
// src/lib/mock/dashboard.ts

export type KpiItem = {
  label: string
  value: string | number
  meta?: string
  progress?: number
  barColor: "teal" | "amber" | "red"
  sublabel?: string
  valueColor?: string
}

export const kpiData: KpiItem[] = [
  { label: "Menções esta semana", value: 847, meta: "Meta: 1.000 (84%)", progress: 84, barColor: "teal" },
  { label: "Sentimento positivo", value: "67%", meta: "Meta: 70% (95%)", progress: 95, barColor: "teal" },
  { label: "Alcance estimado", value: "4.2M", meta: "Meta: 5M (84%)", progress: 84, barColor: "amber" },
  { label: "Alertas ativos", value: 3, sublabel: "2 críticos · 1 aviso", barColor: "red", valueColor: "text-[#DC2626]" },
]

export type SentimentChartDay = {
  date: string
  positive: number
  negative: number
}

export const sentimentChart: SentimentChartDay[] = [
  { date: "01/03", positive: 42, negative: 8 },
  { date: "05/03", positive: 56, negative: 12 },
  { date: "10/03", positive: 38, negative: 15 },
  { date: "15/03", positive: 61, negative: 9 },
  { date: "20/03", positive: 47, negative: 18 },
  { date: "25/03", positive: 53, negative: 11 },
  { date: "30/03", positive: 65, negative: 7 },
]

export type AlertItem = {
  id: string
  type: "critical" | "warning" | "info"
  text: string
  timeAgo: string
}

export const recentAlerts: AlertItem[] = [
  { id: "a1", type: "critical", text: "Pico de sentimento negativo detectado para Nubank", timeAgo: "2h atrás" },
  { id: "a2", type: "warning", text: "#publi ausente em vídeo de @financeiro_br", timeAgo: "5h atrás" },
  { id: "a3", type: "info", text: "Share of voice subiu para 32%", timeAgo: "1d atrás" },
]

export type MentionItem = {
  id: string
  title: string
  creator: string
  sentiment: "positive" | "negative" | "neutral"
  snippet: string
  timeAgo: string
}

export const recentMentions: MentionItem[] = [
  { id: "m1", title: "Review do cartão Nubank 2026", creator: "@financeiro_br", sentiment: "positive", snippet: "O app continua sendo o melhor do mercado...", timeAgo: "3h" },
  { id: "m2", title: "Problemas com atendimento", creator: "@consumidor_real", sentiment: "negative", snippet: "Tentei resolver pelo chat e não consegui...", timeAgo: "6h" },
  { id: "m3", title: "Comparativo de bancos digitais", creator: "@tech_review", sentiment: "neutral", snippet: "Nubank aparece em terceiro lugar no ranking...", timeAgo: "12h" },
]

export type InfluencerItem = {
  id: string
  name: string
  handle: string
  mentions: number
  sentiment: "positive" | "negative" | "neutral"
  platform: "YT" | "TT" | "IG"
}

export const topInfluencers: InfluencerItem[] = [
  { id: "i1", name: "Me Poupe!", handle: "@mepoupenathalia", mentions: 12, sentiment: "positive", platform: "YT" },
  { id: "i2", name: "Primo Rico", handle: "@primorico", mentions: 9, sentiment: "positive", platform: "YT" },
  { id: "i3", name: "Nath Finanças", handle: "@nfrancaa", mentions: 7, sentiment: "neutral", platform: "IG" },
  { id: "i4", name: "Dinheiro com Você", handle: "@dinheirocomvc", mentions: 5, sentiment: "positive", platform: "TT" },
  { id: "i5", name: "Finclass", handle: "@finaborges", mentions: 4, sentiment: "negative", platform: "YT" },
]

export type HotTopic = {
  id: string
  name: string
  mentions: number
  trend: "up" | "down" | "stable"
  sentimentSplit: { positive: number; neutral: number; negative: number } // percentages summing to 100
}

export const hotTopics: HotTopic[] = [
  { id: "t1", name: "App/UX", mentions: 234, trend: "up", sentimentSplit: { positive: 72, neutral: 18, negative: 10 } },
  { id: "t2", name: "Cartão de crédito", mentions: 189, trend: "stable", sentimentSplit: { positive: 58, neutral: 22, negative: 20 } },
  { id: "t3", name: "Atendimento", mentions: 156, trend: "down", sentimentSplit: { positive: 30, neutral: 25, negative: 45 } },
  { id: "t4", name: "Investimentos", mentions: 134, trend: "up", sentimentSplit: { positive: 65, neutral: 20, negative: 15 } },
  { id: "t5", name: "Taxas e tarifas", mentions: 98, trend: "down", sentimentSplit: { positive: 20, neutral: 35, negative: 45 } },
  { id: "t6", name: "PIX e transferências", mentions: 87, trend: "up", sentimentSplit: { positive: 80, neutral: 15, negative: 5 } },
]
```

- [ ] **Step 2: Create monitoring mock data**

```ts
// src/lib/mock/monitoring.ts

export type Platform = "YT" | "TT" | "IG" | "Podcast"

export type Mention = {
  id: string
  title: string
  creator: string
  handle: string
  platform: Platform
  sentiment: "positive" | "negative" | "neutral"
  sentimentScore: number
  views: string
  timeAgo: string
  hasLogo: boolean
  transcript: { timestamp: string; text: string; highlightedBrand: string }[]
  logoFrames: string[]
  logoExposure: string
  logoAvgSize: string
}

export const mentions: Mention[] = [
  {
    id: "mn1",
    title: "Review COMPLETA do cartão Nubank 2026",
    creator: "Me Poupe!",
    handle: "@mepoupenathalia",
    platform: "YT",
    sentiment: "positive",
    sentimentScore: 0.78,
    views: "1.2M",
    timeAgo: "2h atrás",
    hasLogo: true,
    transcript: [
      { timestamp: "02:14", text: "O cartão da Nubank continua sendo minha principal recomendação...", highlightedBrand: "Nubank" },
      { timestamp: "05:30", text: "A experiência no app da Nubank é imbatível, olha só...", highlightedBrand: "Nubank" },
    ],
    logoFrames: ["00:12", "02:14", "05:31", "08:45"],
    logoExposure: "47s",
    logoAvgSize: "12% do frame",
  },
  {
    id: "mn2",
    title: "Qual o MELHOR banco digital? Ranking 2026",
    creator: "Primo Rico",
    handle: "@primorico",
    platform: "YT",
    sentiment: "neutral",
    sentimentScore: 0.12,
    views: "890K",
    timeAgo: "5h atrás",
    hasLogo: true,
    transcript: [
      { timestamp: "03:45", text: "Em terceiro lugar temos a Nubank, que apesar de popular...", highlightedBrand: "Nubank" },
    ],
    logoFrames: ["03:46"],
    logoExposure: "8s",
    logoAvgSize: "6% do frame",
  },
  {
    id: "mn3",
    title: "CUIDADO com esse cartão de crédito",
    creator: "Consumidor Real",
    handle: "@consumidor_real",
    platform: "YT",
    sentiment: "negative",
    sentimentScore: -0.65,
    views: "450K",
    timeAgo: "8h atrás",
    hasLogo: false,
    transcript: [
      { timestamp: "01:20", text: "Tentei resolver com a Nubank pelo chat e ninguém resolveu...", highlightedBrand: "Nubank" },
      { timestamp: "04:10", text: "A Nubank precisa melhorar urgentemente o atendimento...", highlightedBrand: "Nubank" },
    ],
    logoFrames: [],
    logoExposure: "0s",
    logoAvgSize: "—",
  },
  {
    id: "mn4",
    title: "Investindo com pouco dinheiro",
    creator: "Nath Finanças",
    handle: "@nfrancaa",
    platform: "IG",
    sentiment: "positive",
    sentimentScore: 0.55,
    views: "320K",
    timeAgo: "12h atrás",
    hasLogo: false,
    transcript: [
      { timestamp: "00:45", text: "Uso a Nubank pra guardar minha reserva de emergência...", highlightedBrand: "Nubank" },
    ],
    logoFrames: [],
    logoExposure: "0s",
    logoAvgSize: "—",
  },
  {
    id: "mn5",
    title: "PIX no TikTok?! Testei o novo recurso",
    creator: "Dinheiro com Você",
    handle: "@dinheirocomvc",
    platform: "TT",
    sentiment: "positive",
    sentimentScore: 0.82,
    views: "1.5M",
    timeAgo: "1d atrás",
    hasLogo: true,
    transcript: [
      { timestamp: "00:08", text: "Gente, a Nubank liberou PIX por aproximação!", highlightedBrand: "Nubank" },
    ],
    logoFrames: ["00:03", "00:08", "00:15"],
    logoExposure: "12s",
    logoAvgSize: "18% do frame",
  },
  {
    id: "mn6",
    title: "Nubank vs Inter vs C6 — Qual escolher?",
    creator: "Tech Review BR",
    handle: "@techreviewbr",
    platform: "YT",
    sentiment: "neutral",
    sentimentScore: 0.05,
    views: "670K",
    timeAgo: "1d atrás",
    hasLogo: true,
    transcript: [
      { timestamp: "04:20", text: "A Nubank tem a melhor interface mas fica atrás no cashback...", highlightedBrand: "Nubank" },
    ],
    logoFrames: ["04:21", "07:10"],
    logoExposure: "15s",
    logoAvgSize: "9% do frame",
  },
  {
    id: "mn7",
    title: "Podcast: O futuro dos bancos digitais",
    creator: "Fincast",
    handle: "@fincastpod",
    platform: "Podcast",
    sentiment: "positive",
    sentimentScore: 0.45,
    views: "85K",
    timeAgo: "2d atrás",
    hasLogo: false,
    transcript: [
      { timestamp: "12:30", text: "A Nubank revolucionou o mercado, isso é inegável...", highlightedBrand: "Nubank" },
      { timestamp: "15:45", text: "O modelo da Nubank influenciou todos os concorrentes...", highlightedBrand: "Nubank" },
    ],
    logoFrames: [],
    logoExposure: "0s",
    logoAvgSize: "—",
  },
  {
    id: "mn8",
    title: "RECLAMAÇÃO: Cartão bloqueado sem aviso",
    creator: "Maria Finanças",
    handle: "@mariafinancas",
    platform: "IG",
    sentiment: "negative",
    sentimentScore: -0.88,
    views: "210K",
    timeAgo: "2d atrás",
    hasLogo: false,
    transcript: [
      { timestamp: "00:15", text: "Meu cartão Nubank foi bloqueado do nada, sem nenhum aviso...", highlightedBrand: "Nubank" },
    ],
    logoFrames: [],
    logoExposure: "0s",
    logoAvgSize: "—",
  },
  {
    id: "mn9",
    title: "Dica: Como aumentar limite no Nubank",
    creator: "Finanças Práticas",
    handle: "@financaspraticas",
    platform: "TT",
    sentiment: "positive",
    sentimentScore: 0.6,
    views: "2.1M",
    timeAgo: "3d atrás",
    hasLogo: true,
    transcript: [
      { timestamp: "00:05", text: "Quer aumentar seu limite na Nubank? Segue essas 3 dicas...", highlightedBrand: "Nubank" },
    ],
    logoFrames: ["00:02", "00:05"],
    logoExposure: "5s",
    logoAvgSize: "15% do frame",
  },
  {
    id: "mn10",
    title: "Tag #publi ausente — Nubank e influenciadores",
    creator: "Direito Digital",
    handle: "@direitodigital",
    platform: "YT",
    sentiment: "negative",
    sentimentScore: -0.42,
    views: "180K",
    timeAgo: "3d atrás",
    hasLogo: true,
    transcript: [
      { timestamp: "06:00", text: "Vários influenciadores estão promovendo a Nubank sem a tag #publi...", highlightedBrand: "Nubank" },
    ],
    logoFrames: ["06:01", "06:30", "08:12"],
    logoExposure: "22s",
    logoAvgSize: "10% do frame",
  },
]

export const sentimentCounts = {
  all: mentions.length,
  positive: mentions.filter(m => m.sentiment === "positive").length,
  neutral: mentions.filter(m => m.sentiment === "neutral").length,
  negative: mentions.filter(m => m.sentiment === "negative").length,
}
```

- [ ] **Step 3: Create sentiment mock data**

```ts
// src/lib/mock/sentiment.ts

export type WeeklyTrend = {
  week: string
  positive: number
  neutral: number
  negative: number
}

export const weeklyTrend: WeeklyTrend[] = [
  { week: "Sem 1", positive: 65, neutral: 15, negative: 20 },
  { week: "Sem 2", positive: 70, neutral: 12, negative: 18 },
  { week: "Sem 3", positive: 58, neutral: 17, negative: 25 },
  { week: "Sem 4", positive: 67, neutral: 13, negative: 20 },
]

export type ImpactEvent = {
  id: string
  date: string
  title: string
  delta: number // positive or negative
}

export const impactEvents: ImpactEvent[] = [
  { id: "ie1", date: "2026-03-08", title: "Vídeo viral 'Review Nubank 2026' — Me Poupe!", delta: 0.22 },
  { id: "ie2", date: "2026-03-15", title: "Thread no Twitter sobre atendimento ruim", delta: -0.15 },
  { id: "ie3", date: "2026-03-21", title: "Lançamento PIX por aproximação", delta: 0.18 },
  { id: "ie4", date: "2026-03-28", title: "Reclamação viral — cartão bloqueado", delta: -0.12 },
]

export type TopicBreakdown = {
  id: string
  name: string
  positive: number
  neutral: number
  negative: number
}

export const topicBreakdown: TopicBreakdown[] = [
  { id: "tb1", name: "App/UX", positive: 72, neutral: 18, negative: 10 },
  { id: "tb2", name: "Cartão de crédito", positive: 58, neutral: 22, negative: 20 },
  { id: "tb3", name: "Atendimento", positive: 30, neutral: 25, negative: 45 },
  { id: "tb4", name: "Investimentos", positive: 65, neutral: 20, negative: 15 },
]

export type TopicTag = {
  name: string
  sentiment: "positive" | "negative" | "mixed"
}

export const topicTags: TopicTag[] = [
  { name: "App/UX", sentiment: "positive" },
  { name: "PIX", sentiment: "positive" },
  { name: "Cashback", sentiment: "mixed" },
  { name: "Atendimento", sentiment: "negative" },
  { name: "Limite", sentiment: "mixed" },
  { name: "Investimentos", sentiment: "positive" },
  { name: "Taxas", sentiment: "negative" },
  { name: "Cartão virtual", sentiment: "positive" },
  { name: "Seguros", sentiment: "mixed" },
  { name: "Conta PJ", sentiment: "positive" },
]
```

- [ ] **Step 4: Create influencers mock data**

```ts
// src/lib/mock/influencers.ts

export type Influencer = {
  id: string
  name: string
  handle: string
  platform: "YT" | "TT" | "IG"
  subscribers: string
  mentions: number
  sentimentScore: number
  sentiment: "positive" | "negative" | "neutral"
  reach: string
  trend: "up" | "down" | "stable"
  category: string
  // Bubble chart coordinates (normalized 0-1 for positioning)
  bubbleX: number  // sentiment: 0 = -1, 1 = +1
  bubbleY: number  // reach: 0 = bottom, 1 = top
  bubbleSize: number // 1-5 scale based on subscribers
}

export const influencers: Influencer[] = [
  { id: "inf1", name: "Me Poupe!", handle: "@mepoupenathalia", platform: "YT", subscribers: "7.2M", mentions: 12, sentimentScore: 0.78, sentiment: "positive", reach: "4.1M", trend: "up", category: "Finanças pessoais", bubbleX: 0.89, bubbleY: 0.92, bubbleSize: 5 },
  { id: "inf2", name: "Primo Rico", handle: "@primorico", platform: "YT", subscribers: "6.8M", mentions: 9, sentimentScore: 0.12, sentiment: "neutral", reach: "3.2M", trend: "stable", category: "Finanças pessoais", bubbleX: 0.56, bubbleY: 0.78, bubbleSize: 5 },
  { id: "inf3", name: "Nath Finanças", handle: "@nfrancaa", platform: "IG", subscribers: "1.1M", mentions: 7, sentimentScore: 0.55, sentiment: "positive", reach: "890K", trend: "up", category: "Finanças pessoais", bubbleX: 0.78, bubbleY: 0.45, bubbleSize: 3 },
  { id: "inf4", name: "Dinheiro com Você", handle: "@dinheirocomvc", platform: "TT", subscribers: "2.3M", mentions: 5, sentimentScore: 0.82, sentiment: "positive", reach: "1.5M", trend: "up", category: "Lifestyle", bubbleX: 0.91, bubbleY: 0.6, bubbleSize: 4 },
  { id: "inf5", name: "Tech Review BR", handle: "@techreviewbr", platform: "YT", subscribers: "980K", mentions: 4, sentimentScore: 0.05, sentiment: "neutral", reach: "670K", trend: "stable", category: "Reviews/Tech", bubbleX: 0.52, bubbleY: 0.35, bubbleSize: 2 },
  { id: "inf6", name: "Direito Digital", handle: "@direitodigital", platform: "YT", subscribers: "450K", mentions: 3, sentimentScore: -0.42, sentiment: "negative", reach: "180K", trend: "down", category: "Reviews/Tech", bubbleX: 0.29, bubbleY: 0.15, bubbleSize: 1 },
]

export type CategoryBreakdown = {
  name: string
  count: number
  percentage: number
}

export const categoryBreakdown: CategoryBreakdown[] = [
  { name: "Finanças pessoais", count: 3, percentage: 48 },
  { name: "Reviews/Tech", count: 2, percentage: 24 },
  { name: "Lifestyle", count: 1, percentage: 17 },
  { name: "Humor", count: 0, percentage: 10 },
]
```

- [ ] **Step 5: Create brands mock data**

```ts
// src/lib/mock/brands.ts

export type Brand = {
  id: string
  name: string
  initial: string
  color: string
  mentions: number
  keywords: number
  mentionGoal: number
  mentionProgress: number
  status: "active" | "paused" | "configuring"
}

export const brands: Brand[] = [
  { id: "b1", name: "Nubank", initial: "N", color: "#820AD1", mentions: 847, keywords: 12, mentionGoal: 1000, mentionProgress: 84, status: "active" },
  { id: "b2", name: "iFood", initial: "i", color: "#EA1D2C", mentions: 523, keywords: 8, mentionGoal: 800, mentionProgress: 65, status: "active" },
  { id: "b3", name: "XP Investimentos", initial: "X", color: "#FFCB05", mentions: 0, keywords: 5, mentionGoal: 500, mentionProgress: 0, status: "paused" },
]
```

- [ ] **Step 6: Create alerts mock data**

```ts
// src/lib/mock/alerts.ts

export type AlertRule = {
  id: string
  name: string
  condition: string
  notifyVia: string[]
  enabled: boolean
  severity: "critical" | "warning" | "info"
}

export const rules: AlertRule[] = [
  { id: "r1", name: "Pico de sentimento negativo", condition: "Sentimento < -0.5 AND views > 100K", notifyVia: ["E-mail", "Slack"], enabled: true, severity: "critical" },
  { id: "r2", name: "CONAR — #publi ausente", condition: "Menção sem #publi ou #ad", notifyVia: ["E-mail"], enabled: true, severity: "warning" },
  { id: "r3", name: "Audiência anômala", condition: "Crescimento de inscritos > 30% em 24h", notifyVia: ["Slack"], enabled: true, severity: "warning" },
  { id: "r4", name: "Share of voice abaixo do limiar", condition: "SoV < 25% por 7 dias", notifyVia: ["E-mail"], enabled: false, severity: "info" },
]

export type AlertHistoryItem = {
  id: string
  ruleId: string
  ruleName: string
  description: string
  severity: "critical" | "warning" | "info"
  datetime: string
  mentionLink?: string
}

export const alertHistory: AlertHistoryItem[] = [
  { id: "ah1", ruleId: "r1", ruleName: "Pico de sentimento negativo", description: "Sentimento caiu para -0.65 em vídeo com 450K views", severity: "critical", datetime: "2026-04-10 14:30", mentionLink: "/intelligence/monitoring" },
  { id: "ah2", ruleId: "r2", ruleName: "CONAR — #publi ausente", description: "#publi ausente em vídeo de @financeiro_br", severity: "warning", datetime: "2026-04-10 09:15", mentionLink: "/intelligence/monitoring" },
  { id: "ah3", ruleId: "r3", ruleName: "Audiência anômala", description: "Crescimento de 45% em inscritos de @dinheirocomvc", severity: "warning", datetime: "2026-04-09 18:00" },
  { id: "ah4", ruleId: "r1", ruleName: "Pico de sentimento negativo", description: "Sentimento caiu para -0.88 em vídeo de @mariafinancas", severity: "critical", datetime: "2026-04-08 11:45", mentionLink: "/intelligence/monitoring" },
]
```

- [ ] **Step 7: Create reports mock data**

```ts
// src/lib/mock/reports.ts

export type ReportTemplate = {
  id: string
  emoji: string
  name: string
  description: string
  pages: string
}

export const templates: ReportTemplate[] = [
  { id: "rt1", emoji: "📊", name: "Relatório Semanal", description: "Resumo de menções, sentimento e alcance dos últimos 7 dias.", pages: "~2 páginas" },
  { id: "rt2", emoji: "📋", name: "Relatório Mensal", description: "Análise completa com tendências, influenciadores e tópicos.", pages: "~8 páginas" },
  { id: "rt3", emoji: "🚨", name: "Relatório de Crise", description: "Detalhamento de eventos negativos e plano de resposta.", pages: "~4 páginas" },
]

export type GeneratedReport = {
  id: string
  name: string
  date: string
  pages: number
  status: "sent" | "generated"
}

export const generatedReports: GeneratedReport[] = [
  { id: "gr1", name: "Relatório Semanal — 01 a 07 Abr", date: "2026-04-07", pages: 2, status: "sent" },
  { id: "gr2", name: "Relatório Mensal — Março 2026", date: "2026-04-01", pages: 8, status: "sent" },
  { id: "gr3", name: "Relatório de Crise — Incidente Atendimento", date: "2026-03-16", pages: 4, status: "generated" },
]
```

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 9: Commit**

```bash
git add src/lib/mock/
git commit -m "feat: add typed mock data for all pages (dashboard, monitoring, sentiment, influencers, brands, alerts, reports)"
```

---

### Task 4: AppShell Redesign

**Files:**
- Modify: `src/components/layout/AppShell.tsx` (full rewrite)

- [ ] **Step 1: Rewrite AppShell with accordion sidebar, topbar, and breadcrumb**

```tsx
// src/components/layout/AppShell.tsx
import { useState, useEffect } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Eye, Activity, Users, Bell, Tag, FileText,
  ChevronDown, ChevronUp, Search, Settings,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/AuthContext"
import { Breadcrumb } from "@/components/ui/breadcrumb"

const STORAGE_KEY = "zoe_sidebar_intel_open"

function getInitialIntelOpen(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === "true"
  } catch {
    return true
  }
}

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive
      ? "bg-[#F0FDFA] text-[#00A799] font-semibold"
      : "text-[--color-midnight] hover:bg-[#F9FAFB]"
  }`

export function AppShell() {
  const { user } = useAuth()
  const location = useLocation()
  const [intelOpen, setIntelOpen] = useState(getInitialIntelOpen)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(intelOpen)) } catch {}
  }, [intelOpen])

  // Auto-expand intelligence accordion when on an intelligence route
  useEffect(() => {
    if (
      location.pathname.startsWith("/intelligence") ||
      location.pathname === "/alerts"
    ) {
      setIntelOpen(true)
    }
  }, [location.pathname])

  // Derive page title from current route
  const pageTitle = getPageTitle(location.pathname)

  return (
    <div className="min-h-screen flex bg-[--color-ivory] text-[--color-midnight]">
      {/* Sidebar */}
      <aside className="w-[220px] border-r border-[#E5E7EB] bg-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-14 px-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#00A799] flex items-center justify-center text-white text-sm font-bold">Z</div>
          <span className="text-base font-bold text-[--color-midnight]">Zoe</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>

          {/* Intelligence section */}
          <div className="pt-3">
            <span className="px-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Intelligence</span>
          </div>
          <button
            onClick={() => setIntelOpen(!intelOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-[--color-midnight] hover:bg-[#F9FAFB] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> Intelligence
            </span>
            {intelOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {intelOpen && (
            <div className="ml-4 space-y-0.5">
              <NavLink to="/intelligence/monitoring" className={({ isActive }) => navLinkClass(isActive)}>
                <Eye className="w-4 h-4" /> Monitoramento
              </NavLink>
              <NavLink to="/intelligence/sentiment" className={({ isActive }) => navLinkClass(isActive)}>
                <Activity className="w-4 h-4" /> Sentimento
              </NavLink>
              <NavLink to="/intelligence/influencers" className={({ isActive }) => navLinkClass(isActive)}>
                <Users className="w-4 h-4" /> Influenciadores
              </NavLink>
              <NavLink to="/alerts" className={({ isActive }) => navLinkClass(isActive)}>
                <Bell className="w-4 h-4" /> Alertas
                <span className="ml-auto bg-[#FF5B35] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
              </NavLink>
            </div>
          )}

          {/* Gestão section */}
          <div className="pt-3">
            <span className="px-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Gestão</span>
          </div>
          <NavLink to="/brands" className={({ isActive }) => navLinkClass(isActive)}>
            <Tag className="w-4 h-4" /> Marcas
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => navLinkClass(isActive)}>
            <FileText className="w-4 h-4" /> Relatórios
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#E5E7EB] flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-[#00A799] text-white text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-medium truncate">{user?.name ?? user?.email}</div>
            <div className="text-[#6B7280] truncate">Tenant: {user?.tenant.id}</div>
          </div>
          <button className="text-[#6B7280] hover:text-[--color-midnight] transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-[52px] bg-white border-b border-[#E5E7EB] px-6 flex items-center gap-4 shrink-0">
          <h1 className="text-sm font-bold flex-1">{pageTitle}</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-40 h-8 pl-8 pr-3 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-md outline-none focus:ring-1 focus:ring-[#00A799]"
              readOnly
            />
          </div>
          <button className="relative text-[#6B7280] hover:text-[--color-midnight] transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#DC2626] rounded-full" />
          </button>
          <button className="flex items-center gap-1.5 text-xs text-[--color-midnight] hover:bg-[#F9FAFB] px-2 py-1 rounded-md transition-colors">
            <span className="w-2 h-2 rounded-full bg-[#820AD1]" />
            <span>Nubank</span>
            <ChevronDown className="w-3 h-3 text-[#6B7280]" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto bg-[#F9FAFB]">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/intelligence/monitoring": "Monitoramento",
    "/intelligence/sentiment": "Sentimento",
    "/intelligence/influencers": "Influenciadores",
    "/alerts": "Alertas",
    "/brands": "Marcas",
    "/reports": "Relatórios",
  }
  return titles[pathname] ?? "Zoe"
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppShell.tsx
git commit -m "feat: redesign AppShell with accordion sidebar, topbar, breadcrumb, and brand selector"
```

---

### Task 5: Router Update + Stub Pages

**Files:**
- Modify: `src/app/router.tsx`
- Create: `src/pages/Dashboard.tsx` (stub)
- Create: `src/pages/Register.tsx` (stub)
- Create: `src/pages/intelligence/Monitoring.tsx` (stub)
- Create: `src/pages/intelligence/Sentiment.tsx` (stub)
- Create: `src/pages/intelligence/Influencers.tsx` (stub)
- Create: `src/pages/Brands.tsx` (stub)
- Create: `src/pages/Alerts.tsx` (stub)
- Create: `src/pages/Reports.tsx` (stub)

This task creates minimal stub pages so the app compiles, then Phase 2 tasks will fill them in.

- [ ] **Step 1: Create stub pages**

Create each file with a minimal placeholder:

```tsx
// src/pages/Dashboard.tsx
export default function DashboardPage() {
  return <div>Dashboard — em construção</div>
}
```

```tsx
// src/pages/Register.tsx
export default function RegisterPage() {
  return <div>Register — em construção</div>
}
```

```tsx
// src/pages/intelligence/Monitoring.tsx
export default function MonitoringPage() {
  return <div>Monitoramento — em construção</div>
}
```

```tsx
// src/pages/intelligence/Sentiment.tsx
export default function SentimentPage() {
  return <div>Sentimento — em construção</div>
}
```

```tsx
// src/pages/intelligence/Influencers.tsx
export default function InfluencersPage() {
  return <div>Influenciadores — em construção</div>
}
```

```tsx
// src/pages/Brands.tsx
export default function BrandsPage() {
  return <div>Marcas — em construção</div>
}
```

```tsx
// src/pages/Alerts.tsx
export default function AlertsPage() {
  return <div>Alertas — em construção</div>
}
```

```tsx
// src/pages/Reports.tsx
export default function ReportsPage() {
  return <div>Relatórios — em construção</div>
}
```

- [ ] **Step 2: Update router**

```tsx
// src/app/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"
import LoginPage from "@/pages/Login"
import RegisterPage from "@/pages/Register"
import DashboardPage from "@/pages/Dashboard"
import MonitoringPage from "@/pages/intelligence/Monitoring"
import SentimentPage from "@/pages/intelligence/Sentiment"
import InfluencersPage from "@/pages/intelligence/Influencers"
import BrandsPage from "@/pages/Brands"
import AlertsPage from "@/pages/Alerts"
import ReportsPage from "@/pages/Reports"

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/intelligence/monitoring", element: <MonitoringPage /> },
      { path: "/intelligence/sentiment", element: <SentimentPage /> },
      { path: "/intelligence/influencers", element: <InfluencersPage /> },
      { path: "/mentions", element: <Navigate to="/intelligence/monitoring" replace /> },
      { path: "/brands", element: <BrandsPage /> },
      { path: "/alerts", element: <AlertsPage /> },
      { path: "/reports", element: <ReportsPage /> },
    ],
  },
])
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean compilation with no missing imports.

- [ ] **Step 4: Commit**

```bash
git add src/app/router.tsx src/pages/Dashboard.tsx src/pages/Register.tsx src/pages/intelligence/ src/pages/Brands.tsx src/pages/Alerts.tsx src/pages/Reports.tsx
git commit -m "feat: update router with new routes and create stub pages for all sections"
```

---

## Phase 2: Pages (can be parallelized — each task is independent after Phase 1)

### Task 6: Login Page Redesign

**Files:**
- Modify: `src/pages/Login.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Login page with split-screen layout**

```tsx
// src/pages/Login.tsx
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/features/auth/useAuth"
import { useNavigate, Link } from "react-router-dom"
import { Eye, EyeOff, ChevronDown } from "lucide-react"

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
})

const slides = [
  { headline: 'Hoje a Zoe analisou <strong>12.847</strong> menções de marca em vídeo.', subtitle: "Inteligência multimodal em tempo real." },
  { headline: "Monitore sua marca. Em tempo real. Com IA multimodal.", subtitle: "Vídeo, áudio e texto — tudo em um só lugar." },
  { headline: "Inteligência e gestão de marketing de influência.", subtitle: "Da descoberta ao relatório, sem sair da plataforma." },
]

export default function LoginPage() {
  const nav = useNavigate()
  const form = useForm({ resolver: zodResolver(schema) })
  const [showPw, setShowPw] = useState(false)
  const [slide, setSlide] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = setInterval(() => setSlide(s => (s + 1) % slides.length), 4000)
    return () => clearInterval(timer)
  }, [])

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    try {
      setError("")
      await auth.login(email, password)
      nav("/dashboard")
    } catch {
      setError("E-mail ou senha incorretos.")
    }
  })

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-[#07091A] text-white flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-[#00A799] flex items-center justify-center text-white text-sm font-bold">Z</div>
          <span className="text-lg font-bold">Zoe</span>
        </div>
        <div className="flex-1 flex flex-col justify-center max-w-md">
          <h2
            className="text-3xl font-bold leading-tight mb-3"
            dangerouslySetInnerHTML={{ __html: slides[slide].headline }}
          />
          <p className="text-white/60 text-sm">{slides[slide].subtitle}</p>
          <div className="flex gap-2 mt-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === slide ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <ChevronDown className="w-5 h-5 text-white/40" />
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[--color-midnight] mb-1">Entre na sua conta</h1>
          <p className="text-sm text-[#6B7280] mb-8">Bem-vinda de volta.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" placeholder="seu@email.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-[#DC2626]">{form.formState.errors.email.message as string}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[--color-midnight]"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-[#DC2626]">{form.formState.errors.password.message as string}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-[#6B7280]">
                <input type="checkbox" className="rounded border-[#E5E7EB]" />
                Manter conectado
              </label>
              <a href="#" className="text-[#00A799] hover:underline">Esqueci a senha</a>
            </div>

            {error && <p className="text-xs text-[#DC2626]">{error}</p>}

            <Button type="submit" className="w-full bg-[#00A799] hover:bg-[#00A799]/90 text-white">
              Entrar
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E7EB]" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[#6B7280]">ou</span></div>
          </div>

          <div className="space-y-3">
            <Button variant="outline" className="w-full" disabled>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuar com Google
            </Button>
            <Button variant="outline" className="w-full" disabled>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M11.4 24H0V12.6L11.4 0H24v11.4L12.6 24H11.4z" fill="#F25022" opacity="0.3"/><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg>
              Continuar com Microsoft
            </Button>
          </div>

          <p className="text-center text-sm text-[#6B7280] mt-8">
            Ainda não tem conta?{" "}
            <Link to="/register" className="text-[#00A799] font-semibold hover:underline">Comece grátis</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "feat: redesign Login page with split-screen layout, rotating headlines, and social login buttons"
```

---

### Task 7: Register Page (Wizard)

**Files:**
- Modify: `src/pages/Register.tsx` (full rewrite)

- [ ] **Step 1: Implement 3-step registration wizard**

```tsx
// src/pages/Register.tsx
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/features/auth/useAuth"
import { useNavigate, Link } from "react-router-dom"
import { Check } from "lucide-react"

// Step 1: Intention
function StepIntention({ onNext }: { onNext: (intent: string) => void }) {
  const [selected, setSelected] = useState("")

  const options = [
    { value: "monitor", emoji: "🔵", title: "Monitorar minha marca", desc: "Veja em tempo real o que falam sobre você em vídeos e podcasts." },
    { value: "campaigns", emoji: "🟦", title: "Gerenciar campanhas", desc: "Contratos digitais, escrow seguro e workflow.", badge: "mais completo" },
    { value: "both", emoji: "🩵", title: "Quero os dois", desc: "Inteligência + gestão com auditoria por IA." },
  ]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[--color-midnight]">O que você quer fazer com a Zoe?</h1>
        <p className="text-sm text-[#6B7280] mt-1">Você pode mudar isso depois.</p>
      </div>
      <div className="space-y-3">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              selected === opt.value
                ? "border-[#00A799] bg-[#F0FDFA]"
                : "border-[#E5E7EB] hover:border-[#00A799]/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{opt.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[--color-midnight]">{opt.title}</span>
                  {opt.badge && (
                    <span className="text-[10px] font-medium bg-[#00A799]/10 text-[#00A799] px-1.5 py-0.5 rounded">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#6B7280] mt-0.5">{opt.desc}</p>
              </div>
              {selected === opt.value && <Check className="w-5 h-5 text-[#00A799] shrink-0" />}
            </div>
          </button>
        ))}
      </div>
      <Button
        onClick={() => onNext(selected)}
        disabled={!selected}
        className="w-full bg-[#00A799] hover:bg-[#00A799]/90 text-white"
      >
        Continuar
      </Button>
    </div>
  )
}

// Step 2: Account
const accountSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  company: z.string().min(1, "Empresa obrigatória"),
  role: z.string().min(1, "Cargo obrigatório"),
  terms: z.literal(true, { errorMap: () => ({ message: "Aceite os termos" }) }),
})

type AccountData = z.infer<typeof accountSchema>

function StepAccount({ onNext }: { onNext: (data: AccountData) => void }) {
  const form = useForm<AccountData>({ resolver: zodResolver(accountSchema) })
  const [error, setError] = useState("")
  const password = form.watch("password") ?? ""

  const strength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0
  const strengthColors = ["bg-[#E5E7EB]", "bg-[#DC2626]", "bg-[#D97706]", "bg-[#16A34A]"]
  const strengthLabels = ["", "Fraca", "Média", "Forte"]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[--color-midnight]">Crie sua conta</h1>
        <p className="text-sm text-[#6B7280] mt-1">Leva menos de um minuto.</p>
      </div>
      <form
        onSubmit={form.handleSubmit(async (data) => {
          try {
            setError("")
            await auth.register(data.email, data.password)
            onNext(data)
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Erro ao criar conta.")
          }
        })}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label>Nome completo</Label>
          <Input {...form.register("name")} />
          {form.formState.errors.name && <p className="text-xs text-[#DC2626]">{form.formState.errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>E-mail corporativo</Label>
          <Input type="email" {...form.register("email")} />
          {form.formState.errors.email && <p className="text-xs text-[#DC2626]">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Senha</Label>
          <Input type="password" {...form.register("password")} />
          {password.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColors[strength] : "bg-[#E5E7EB]"}`} />
                ))}
              </div>
              <span className="text-xs text-[#6B7280]">{strengthLabels[strength]}</span>
            </div>
          )}
          {form.formState.errors.password && <p className="text-xs text-[#DC2626]">{form.formState.errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Empresa ou agência</Label>
          <Input {...form.register("company")} />
          {form.formState.errors.company && <p className="text-xs text-[#DC2626]">{form.formState.errors.company.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Cargo</Label>
          <select
            {...form.register("role")}
            className="w-full h-9 px-3 text-sm border border-[#E5E7EB] rounded-md bg-white"
          >
            <option value="">Selecione...</option>
            <option value="marketing">Marketing</option>
            <option value="growth">Growth</option>
            <option value="founder">Fundador(a)</option>
            <option value="agency">Agência</option>
            <option value="other">Outro</option>
          </select>
          {form.formState.errors.role && <p className="text-xs text-[#DC2626]">{form.formState.errors.role.message}</p>}
        </div>
        <label className="flex items-start gap-2 text-sm text-[#6B7280]">
          <input type="checkbox" {...form.register("terms")} className="mt-0.5 rounded border-[#E5E7EB]" />
          <span>Aceito os <a href="#" className="text-[#00A799] hover:underline">termos</a> e a <a href="#" className="text-[#00A799] hover:underline">política de privacidade</a></span>
        </label>
        {form.formState.errors.terms && <p className="text-xs text-[#DC2626]">{form.formState.errors.terms.message}</p>}

        {error && <p className="text-xs text-[#DC2626]">{error}</p>}

        <Button type="submit" className="w-full bg-[#00A799] hover:bg-[#00A799]/90 text-white">
          Criar minha conta
        </Button>
      </form>
    </div>
  )
}

// Step 3: Verification
function StepVerification({ email, onBack }: { email: string; onBack: () => void }) {
  const nav = useNavigate()
  const [code, setCode] = useState(Array(6).fill(""))
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(30)
  const [submitting, setSubmitting] = useState(false)

  // Auto-decrement resend timer
  useState(() => {
    const interval = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  })

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)

    // Auto-focus next input
    if (value && index < 5) {
      const el = document.getElementById(`otp-${index + 1}`)
      el?.focus()
    }

    // Auto-submit when complete
    if (value && index === 5) {
      const fullCode = next.join("")
      if (fullCode.length === 6) {
        submitCode(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const el = document.getElementById(`otp-${index - 1}`)
      el?.focus()
    }
  }

  const submitCode = async (fullCode: string) => {
    try {
      setSubmitting(true)
      setError("")
      await auth.confirm(email, fullCode)
      nav("/dashboard")
    } catch {
      setError("Código inválido. Tente novamente.")
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    try {
      await auth.register(email, "")  // re-trigger
    } catch {}
    setResendTimer(30)
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-[--color-midnight]">Confirme seu e-mail</h1>
        <p className="text-sm text-[#6B7280] mt-1">Mandamos um código de 6 dígitos pra <strong>{email}</strong></p>
      </div>
      <div className="flex justify-center gap-2">
        {code.map((digit, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={submitting}
            className="w-11 h-13 text-center text-xl font-bold border border-[#E5E7EB] rounded-md focus:ring-2 focus:ring-[#00A799] outline-none"
          />
        ))}
      </div>
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      <p className="text-sm text-[#6B7280]">
        {resendTimer > 0
          ? `Reenviar em ${resendTimer}s`
          : <button onClick={handleResend} className="text-[#00A799] hover:underline">Não recebeu? Reenviar</button>
        }
      </p>
      <button onClick={onBack} className="text-sm text-[#00A799] hover:underline">
        Usar e-mail diferente
      </button>
    </div>
  )
}

// Main Register Page
export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4">
      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between mb-2 text-xs text-[#6B7280]">
          <span>Passo {step} de 3</span>
        </div>
        <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00A799] rounded-full transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E5E7EB] p-8 shadow-sm">
        {step === 1 && <StepIntention onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepAccount
            onNext={(data) => {
              setEmail(data.email)
              setStep(3)
            }}
          />
        )}
        {step === 3 && <StepVerification email={email} onBack={() => setStep(2)} />}
      </div>

      {step === 1 && (
        <p className="text-sm text-[#6B7280] mt-6">
          Já tem conta?{" "}
          <Link to="/login" className="text-[#00A799] font-semibold hover:underline">Entrar</Link>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Register.tsx
git commit -m "feat: implement Register page with 3-step wizard (intention, account, verification)"
```

---

### Task 8: Dashboard Page

**Files:**
- Modify: `src/pages/Dashboard.tsx` (full rewrite)

- [ ] **Step 1: Implement Dashboard with KPI cards, charts, and data panels**

```tsx
// src/pages/Dashboard.tsx
import { Link } from "react-router-dom"
import { KpiCard } from "@/components/ui/kpi-card"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import {
  kpiData, sentimentChart, recentAlerts, recentMentions, topInfluencers, hotTopics,
} from "@/lib/mock/dashboard"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

const alertDotColors = { critical: "bg-[#DC2626]", warning: "bg-[#D97706]", info: "bg-[#00A799]" }
const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus }
const platformColors = { YT: "bg-red-100 text-red-700", TT: "bg-slate-100 text-slate-700", IG: "bg-pink-100 text-pink-700" }

export default function DashboardPage() {
  const maxBar = Math.max(...sentimentChart.map(d => d.positive + d.negative))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[--color-midnight]">{getGreeting()}! 👋</h1>
        <p className="text-sm text-[#6B7280] mt-1">Acompanhe de perto o desempenho do seu marketing</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map(kpi => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Main row: Sentiment chart + Alerts/Mentions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sentiment chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[--color-midnight]">Sentimento — 30 dias</h2>
            <button className="text-[#6B7280] hover:text-[--color-midnight]">•••</button>
          </div>
          <div className="flex items-end gap-3 h-48">
            {sentimentChart.map(day => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: "160px" }}>
                  <div
                    className="w-full bg-[#00A799] rounded-t"
                    style={{ height: `${(day.positive / maxBar) * 160}px` }}
                  />
                  <div
                    className="w-full bg-[#FDA4A4] rounded-b"
                    style={{ height: `${(day.negative / maxBar) * 160}px` }}
                  />
                </div>
                <span className="text-[10px] text-[#6B7280]">{day.date}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00A799]" /> Positivo</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FDA4A4]" /> Negativo</span>
          </div>
        </div>

        {/* Right stack: Alerts + Mentions */}
        <div className="space-y-4">
          {/* Recent alerts */}
          <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-[--color-midnight] mb-3">Alertas recentes</h2>
            <div className="space-y-3">
              {recentAlerts.map(a => (
                <div key={a.id} className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${alertDotColors[a.type]}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-[--color-midnight] leading-snug">{a.text}</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">{a.timeAgo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent mentions */}
          <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-[--color-midnight] mb-3">Menções recentes</h2>
            <div className="space-y-3">
              {recentMentions.map(m => (
                <div key={m.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[--color-midnight] leading-snug truncate">{m.snippet}</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">{m.creator} · {m.timeAgo}</p>
                  </div>
                  <SentimentBadge sentiment={m.sentiment} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Influencers + Hot topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top influencers */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Top Influenciadores por Menções</h2>
          <div className="space-y-3">
            {topInfluencers.map((inf, i) => (
              <div key={inf.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#6B7280] w-4">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-[#00A799]/10 text-[#00A799] flex items-center justify-center text-xs font-bold shrink-0">
                  {inf.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[--color-midnight] truncate">{inf.name}</p>
                  <p className="text-[10px] text-[#6B7280]">{inf.handle}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${platformColors[inf.platform]}`}>
                  {inf.platform}
                </span>
                <span className="text-xs font-bold text-[--color-midnight] w-6 text-right">{inf.mentions}</span>
                <SentimentBadge sentiment={inf.sentiment} />
              </div>
            ))}
          </div>
          <Link to="/intelligence/influencers" className="inline-block mt-4 text-xs text-[#00A799] hover:underline font-medium">
            Ver todos →
          </Link>
        </div>

        {/* Hot topics */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Tópicos em Alta</h2>
          <div className="space-y-3">
            {hotTopics.map(topic => {
              const TrendIcon = trendIcons[topic.trend]
              const borderColor = topic.sentimentSplit.positive > 50 ? "border-l-[#00A799]" : topic.sentimentSplit.negative > 40 ? "border-l-[#DC2626]" : "border-l-[#D97706]"
              return (
                <div key={topic.id} className={`border-l-2 pl-3 ${borderColor}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[--color-midnight]">{topic.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#6B7280]">{topic.mentions} menções</span>
                      <TrendIcon className={`w-3 h-3 ${topic.trend === "up" ? "text-[#16A34A]" : topic.trend === "down" ? "text-[#DC2626]" : "text-[#6B7280]"}`} />
                    </div>
                  </div>
                  {/* Sentiment bar */}
                  <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div className="bg-[#16A34A]" style={{ width: `${topic.sentimentSplit.positive}%` }} />
                    <div className="bg-[#D1D5DB]" style={{ width: `${topic.sentimentSplit.neutral}%` }} />
                    <div className="bg-[#DC2626]" style={{ width: `${topic.sentimentSplit.negative}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: implement Dashboard page with KPI cards, sentiment chart, alerts, mentions, influencers, and hot topics"
```

---

### Task 9: MentionDrawer Component

**Files:**
- Create: `src/components/features/MentionDrawer.tsx`

- [ ] **Step 1: Create MentionDrawer component**

```tsx
// src/components/features/MentionDrawer.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import type { Mention } from "@/lib/mock/monitoring"

type MentionDrawerProps = {
  mention: Mention | null
  open: boolean
  onClose: () => void
}

export function MentionDrawer({ mention, open, onClose }: MentionDrawerProps) {
  if (!mention) return null

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhe da Menção</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Video placeholder */}
          <div className="aspect-video bg-[#F3F4F6] rounded-lg flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shadow">
              <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[--color-midnight] ml-1" />
            </div>
          </div>

          {/* Title and meta */}
          <div>
            <h3 className="font-semibold text-[--color-midnight]">{mention.title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">{mention.creator} · {mention.handle} · {mention.views} views · {mention.timeAgo}</p>
            <div className="flex gap-2 mt-2">
              <SentimentBadge sentiment={mention.sentiment} score={mention.sentimentScore} />
              {mention.hasLogo && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F0FDFA] text-[#00A799]">
                  Logo detectado
                </span>
              )}
            </div>
          </div>

          {/* Transcript */}
          {mention.transcript.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
                Transcrição (trechos com menção)
              </h4>
              <div className="space-y-3">
                {mention.transcript.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-xs font-mono text-[#00A799] shrink-0 pt-0.5">{t.timestamp}</span>
                    <p className="text-sm text-[--color-midnight]">
                      "{highlightBrand(t.text, t.highlightedBrand)}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logo frames */}
          {mention.logoFrames.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
                Logo detectado (frames)
              </h4>
              <div className="flex flex-wrap gap-2 mb-2">
                {mention.logoFrames.map((ts, i) => (
                  <span key={i} className="text-xs font-mono bg-[#F0FDFA] text-[#00A799] px-2 py-1 rounded">
                    {ts}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#6B7280]">
                Exposição total: {mention.logoExposure} · Tamanho médio: {mention.logoAvgSize}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function highlightBrand(text: string, brand: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${brand})`, "gi"))
  return parts.map((part, i) =>
    part.toLowerCase() === brand.toLowerCase()
      ? <span key={i} className="bg-[#00A799]/15 px-0.5 rounded font-medium">{part}</span>
      : part
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/MentionDrawer.tsx
git commit -m "feat: add MentionDrawer component with transcript highlights and logo frame display"
```

---

### Task 10: Monitoring Page

**Files:**
- Modify: `src/pages/intelligence/Monitoring.tsx` (full rewrite)

- [ ] **Step 1: Implement Monitoring page with filters, tabs, mention list, and drawer**

```tsx
// src/pages/intelligence/Monitoring.tsx
import { useState, useMemo } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { FilterChip } from "@/components/ui/filter-chip"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import { MentionDrawer } from "@/components/features/MentionDrawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mentions, sentimentCounts, type Mention } from "@/lib/mock/monitoring"
import { Search } from "lucide-react"

const platformColors = { YT: "bg-red-100 text-red-700", TT: "bg-slate-100 text-slate-700", IG: "bg-pink-100 text-pink-700", Podcast: "bg-purple-100 text-purple-700" }

type SentimentFilter = "all" | "positive" | "neutral" | "negative"

export default function MonitoringPage() {
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all")
  const [selectedMention, setSelectedMention] = useState<Mention | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filtered = useMemo(() => {
    if (sentimentFilter === "all") return mentions
    return mentions.filter(m => m.sentiment === sentimentFilter)
  }, [sentimentFilter])

  const openDrawer = (mention: Mention) => {
    setSelectedMention(mention)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Monitoramento" subtitle="Feed completo de menções detectadas em vídeo.">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
          <Input placeholder="Buscar transcrição..." className="pl-8 w-56 h-8 text-xs" readOnly />
        </div>
        <Button className="bg-[#FF5B35] hover:bg-[#FF5B35]/90 text-white text-xs h-8 px-4">
          Exportar
        </Button>
      </PageHeader>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="Últimos 7 dias" />
        <FilterChip label="Todas plataformas" />
        <FilterChip label="Todos sentimentos" />
        <FilterChip label="Todas marcas" />
        <FilterChip label="Com logo" />
      </div>

      {/* Sentiment tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {([
          { key: "all", label: "Todos", count: sentimentCounts.all },
          { key: "positive", label: "Positivo", count: sentimentCounts.positive },
          { key: "neutral", label: "Neutro", count: sentimentCounts.neutral },
          { key: "negative", label: "Negativo", count: sentimentCounts.negative },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSentimentFilter(tab.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              sentimentFilter === tab.key
                ? "border-[#00A799] text-[#00A799]"
                : "border-transparent text-[#6B7280] hover:text-[--color-midnight]"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Mentions list */}
      <div className="space-y-2">
        {filtered.map(mention => (
          <button
            key={mention.id}
            onClick={() => openDrawer(mention)}
            className="w-full text-left bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow flex items-center gap-4"
          >
            {/* Thumbnail placeholder */}
            <div className="w-20 h-[50px] bg-[#F3F4F6] rounded flex items-center justify-center shrink-0">
              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-[#6B7280]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[--color-midnight] truncate">{mention.title}</span>
                {mention.hasLogo && (
                  <span className="text-[10px] font-medium bg-[#F0FDFA] text-[#00A799] px-1.5 py-0.5 rounded shrink-0">LOGO</span>
                )}
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {mention.creator} · {mention.handle} · {mention.views} views · {mention.timeAgo}
              </p>
            </div>

            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${platformColors[mention.platform]}`}>
              {mention.platform}
            </span>
            <SentimentBadge sentiment={mention.sentiment} score={mention.sentimentScore} />
          </button>
        ))}
      </div>

      <MentionDrawer
        mention={selectedMention}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/intelligence/Monitoring.tsx
git commit -m "feat: implement Monitoring page with filters, sentiment tabs, mention list, and detail drawer"
```

---

### Task 11: Sentiment Page

**Files:**
- Modify: `src/pages/intelligence/Sentiment.tsx` (full rewrite)

- [ ] **Step 1: Implement Sentiment page with charts, impact events, topic breakdown, and tag cloud**

```tsx
// src/pages/intelligence/Sentiment.tsx
import { PageHeader } from "@/components/ui/page-header"
import { FilterChip } from "@/components/ui/filter-chip"
import { KpiCard } from "@/components/ui/kpi-card"
import { weeklyTrend, impactEvents, topicBreakdown, topicTags } from "@/lib/mock/sentiment"

const tagColors = {
  positive: "bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/20",
  negative: "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20",
  mixed: "bg-[#FFFBEB] text-[#D97706] border-[#D97706]/20",
}

export default function SentimentPage() {
  const maxY = Math.max(...weeklyTrend.map(w => Math.max(w.positive, w.neutral, w.negative)))

  return (
    <div className="space-y-6">
      <PageHeader title="Sentimento" subtitle="Análise de sentimento das menções detectadas." />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="Último mês" />
        <FilterChip label="Todas marcas" />
        <FilterChip label="Semanal" />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Positivo" value="67%" barColor="teal" progress={67} />
        <KpiCard label="Neutro" value="13%" barColor="amber" progress={13} />
        <KpiCard label="Negativo" value="20%" barColor="red" progress={20} />
      </div>

      {/* Main grid: Line chart + Impact events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Line chart (CSS-based) */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Evolução de sentimento</h2>
          <div className="flex gap-4 mb-3 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Positivo</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]" /> Neutro</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#DC2626]" /> Negativo</span>
          </div>
          <div className="flex items-end gap-6 h-40">
            {weeklyTrend.map(week => (
              <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 justify-center" style={{ height: "130px", alignItems: "flex-end" }}>
                  <div className="w-2 bg-[#16A34A] rounded-t" style={{ height: `${(week.positive / maxY) * 130}px` }} />
                  <div className="w-2 bg-[#9CA3AF] rounded-t" style={{ height: `${(week.neutral / maxY) * 130}px` }} />
                  <div className="w-2 bg-[#DC2626] rounded-t" style={{ height: `${(week.negative / maxY) * 130}px` }} />
                </div>
                <span className="text-[10px] text-[#6B7280]">{week.week}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Impact events */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-1">Eventos de impacto</h2>
          <p className="text-xs text-[#6B7280] mb-4">Menções que mais influenciaram a curva de sentimento.</p>
          <div className="space-y-4">
            {impactEvents.map(event => (
              <div key={event.id} className="flex items-start gap-3">
                <span className="text-xs text-[#6B7280] shrink-0 pt-0.5 w-20">{event.date.slice(5)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[--color-midnight]">{event.title}</p>
                  <span className={`text-xs font-semibold ${event.delta > 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    {event.delta > 0 ? "+" : ""}{event.delta.toFixed(2)} no score
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sentiment by topic */}
      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Sentimento por tópico</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topicBreakdown.map(topic => (
            <div key={topic.id} className="border rounded-lg p-4">
              <h3 className="text-sm font-medium text-[--color-midnight] mb-3">{topic.name}</h3>
              <div className="flex h-2 rounded-full overflow-hidden mb-2">
                <div className="bg-[#16A34A]" style={{ width: `${topic.positive}%` }} />
                <div className="bg-[#D1D5DB]" style={{ width: `${topic.neutral}%` }} />
                <div className="bg-[#DC2626]" style={{ width: `${topic.negative}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#6B7280]">
                <span>{topic.positive}%</span>
                <span>{topic.neutral}%</span>
                <span>{topic.negative}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic tags */}
      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Tópicos mais citados</h2>
        <div className="flex flex-wrap gap-2">
          {topicTags.map(tag => (
            <span key={tag.name} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tagColors[tag.sentiment]}`}>
              {tag.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/intelligence/Sentiment.tsx
git commit -m "feat: implement Sentiment page with charts, impact events, topic breakdown, and tag cloud"
```

---

### Task 12: Influencers Page

**Files:**
- Modify: `src/pages/intelligence/Influencers.tsx` (full rewrite)

- [ ] **Step 1: Implement Influencers page with bubble map, category breakdown, and sortable table**

```tsx
// src/pages/intelligence/Influencers.tsx
import { useState, useMemo } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { FilterChip } from "@/components/ui/filter-chip"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import { influencers, categoryBreakdown, type Influencer } from "@/lib/mock/influencers"
import { TrendingUp, TrendingDown, Minus, ArrowUpDown } from "lucide-react"

const platformColors = { YT: "bg-red-100 text-red-700", TT: "bg-slate-100 text-slate-700", IG: "bg-pink-100 text-pink-700" }
const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus }
const bubbleSizes = [0, 16, 24, 32, 40, 48]

type SortKey = "subscribers" | "mentions" | "reach"

function parseNumeric(val: string): number {
  const num = parseFloat(val.replace(/[^0-9.]/g, ""))
  if (val.includes("M")) return num * 1000000
  if (val.includes("K")) return num * 1000
  return num
}

export default function InfluencersPage() {
  const [sortKey, setSortKey] = useState<SortKey>("mentions")
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const arr = [...influencers]
    arr.sort((a, b) => {
      let aVal: number, bVal: number
      if (sortKey === "mentions") { aVal = a.mentions; bVal = b.mentions }
      else if (sortKey === "subscribers") { aVal = parseNumeric(a.subscribers); bVal = parseNumeric(b.subscribers) }
      else { aVal = parseNumeric(a.reach); bVal = parseNumeric(b.reach) }
      return sortAsc ? aVal - bVal : bVal - aVal
    })
    return arr
  }, [sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Influenciadores" subtitle="Mapeamento e análise de influenciadores que mencionam sua marca." />

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Último mês" />
        <FilterChip label="Todas plataformas" />
        <FilterChip label="Ordenar: Relevância" />
      </div>

      {/* Top grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bubble map */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Mapa de bolhas (Alcance × Sentimento)</h2>
          <div className="relative h-64 border border-[#E5E7EB] rounded bg-[#FAFAFA]">
            {/* Axis labels */}
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#6B7280]">Sentimento →</span>
            <span className="absolute -left-5 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-[#6B7280]">Alcance →</span>
            {influencers.map(inf => (
              <div
                key={inf.id}
                className="absolute flex items-center justify-center rounded-full transition-all"
                style={{
                  left: `${inf.bubbleX * 90 + 5}%`,
                  bottom: `${inf.bubbleY * 85 + 5}%`,
                  width: `${bubbleSizes[inf.bubbleSize]}px`,
                  height: `${bubbleSizes[inf.bubbleSize]}px`,
                  backgroundColor: inf.sentiment === "negative" ? "rgba(220,38,38,0.2)" : "rgba(0,167,153,0.2)",
                  border: `2px solid ${inf.sentiment === "negative" ? "#DC2626" : "#00A799"}`,
                  transform: "translate(-50%, 50%)",
                }}
                title={`${inf.name}: ${inf.sentimentScore}`}
              >
                <span className="text-[8px] font-semibold text-[--color-midnight] whitespace-nowrap">{inf.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Distribuição por categoria</h2>
          <div className="space-y-4">
            {categoryBreakdown.map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[--color-midnight]">{cat.name}</span>
                  <span className="text-[#6B7280]">{cat.count} · {cat.percentage}%</span>
                </div>
                <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00A799] rounded-full" style={{ width: `${cat.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F9FAFB]">
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Influenciador</th>
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Plataforma</th>
              <SortableHeader label="Inscritos" sortKey="subscribers" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <SortableHeader label="Menções" sortKey="mentions" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Sentimento</th>
              <SortableHeader label="Alcance" sortKey="reach" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(inf => {
              const TrendIcon = trendIcons[inf.trend]
              return (
                <tr key={inf.id} className="border-b last:border-b-0 hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#00A799]/10 text-[#00A799] flex items-center justify-center text-xs font-bold shrink-0">
                        {inf.name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-[--color-midnight]">{inf.name}</div>
                        <div className="text-[#6B7280]">{inf.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${platformColors[inf.platform]}`}>{inf.platform}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{inf.subscribers}</td>
                  <td className="px-4 py-3 font-bold">{inf.mentions}</td>
                  <td className="px-4 py-3"><SentimentBadge sentiment={inf.sentiment} score={inf.sentimentScore} /></td>
                  <td className="px-4 py-3">{inf.reach}</td>
                  <td className="px-4 py-3">
                    <TrendIcon className={`w-4 h-4 ${inf.trend === "up" ? "text-[#16A34A]" : inf.trend === "down" ? "text-[#DC2626]" : "text-[#6B7280]"}`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortableHeader({ label, sortKey, currentKey, asc, onToggle }: {
  label: string; sortKey: SortKey; currentKey: SortKey; asc: boolean; onToggle: (k: SortKey) => void
}) {
  return (
    <th className="text-left px-4 py-3">
      <button onClick={() => onToggle(sortKey)} className="flex items-center gap-1 font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[--color-midnight]">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${currentKey === sortKey ? "text-[#00A799]" : ""}`} />
        {currentKey === sortKey && <span className="text-[8px]">{asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/intelligence/Influencers.tsx
git commit -m "feat: implement Influencers page with bubble map, category distribution, and sortable table"
```

---

### Task 13: Brands Page

**Files:**
- Modify: `src/pages/Brands.tsx` (full rewrite)

- [ ] **Step 1: Implement Brands page with brand cards and empty state**

```tsx
// src/pages/Brands.tsx
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { brands } from "@/lib/mock/brands"
import { MoreHorizontal } from "lucide-react"

const statusStyles = {
  active: { label: "Ativa", className: "bg-[#F0FDF4] text-[#16A34A]" },
  paused: { label: "Pausada", className: "bg-[#F3F4F6] text-[#6B7280]" },
  configuring: { label: "Configurando", className: "bg-[#FFFBEB] text-[#D97706]" },
}

export default function BrandsPage() {
  if (brands.length === 0) {
    return (
      <div>
        <PageHeader title="Marcas monitoradas" />
        <EmptyState
          title="Nenhuma marca configurada"
          description="Adicione sua primeira marca para começar a monitorar menções."
          actionLabel="+ Nova marca"
          onAction={() => {}}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Marcas monitoradas">
        <Button className="bg-[#FF5B35] hover:bg-[#FF5B35]/90 text-white text-xs h-8 px-4">
          + Nova marca
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(brand => {
          const status = statusStyles[brand.status]
          return (
            <div key={brand.id} className="bg-white rounded-lg border p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: brand.color }}
                  >
                    {brand.initial}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[--color-midnight]">{brand.name}</h3>
                    <p className="text-xs text-[#6B7280]">{brand.mentions} menções · {brand.keywords} keywords</p>
                  </div>
                </div>
                <button className="text-[#6B7280] hover:text-[--color-midnight]">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden mb-3">
                <div className="h-full bg-[#00A799] rounded-full" style={{ width: `${brand.mentionProgress}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">{brand.mentionProgress}% da meta</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Brands.tsx
git commit -m "feat: implement Brands page with brand cards, progress bars, and empty state"
```

---

### Task 14: Alerts Page

**Files:**
- Modify: `src/pages/Alerts.tsx` (full rewrite)

- [ ] **Step 1: Implement Alerts page with Configuration and History tabs**

```tsx
// src/pages/Alerts.tsx
import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { rules, alertHistory } from "@/lib/mock/alerts"
import { Link } from "react-router-dom"

const severityBorder = { critical: "border-l-[#DC2626]", warning: "border-l-[#D97706]", info: "border-l-[#00A799]" }
const severityDot = { critical: "bg-[#DC2626]", warning: "bg-[#D97706]", info: "bg-[#00A799]" }

type Tab = "config" | "history"

export default function AlertsPage() {
  const [tab, setTab] = useState<Tab>("config")

  return (
    <div className="space-y-4">
      <PageHeader title="Alertas" subtitle="Regras de alerta e histórico de notificações." />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {([
          { key: "config" as Tab, label: "Configuração" },
          { key: "history" as Tab, label: "Histórico" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[#00A799] text-[#00A799]"
                : "border-transparent text-[#6B7280] hover:text-[--color-midnight]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
              Regras ativas ({rules.filter(r => r.enabled).length})
            </span>
            <Button className="bg-[#FF5B35] hover:bg-[#FF5B35]/90 text-white text-xs h-8 px-4">
              + Nova regra
            </Button>
          </div>
          <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`bg-white rounded-lg border border-l-4 p-4 ${severityBorder[rule.severity]} ${!rule.enabled ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Toggle */}
                    <button
                      className={`relative mt-0.5 w-8 h-4.5 rounded-full transition-colors ${rule.enabled ? "bg-[#00A799]" : "bg-[#E5E7EB]"}`}
                    >
                      <span
                        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${rule.enabled ? "left-4" : "left-0.5"}`}
                      />
                    </button>
                    <div>
                      <h3 className="text-sm font-semibold text-[--color-midnight]">{rule.name}</h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">{rule.condition}</p>
                      <p className="text-xs text-[#6B7280] mt-1">Notificar via: {rule.notifyVia.join(" + ")}</p>
                    </div>
                  </div>
                  <button className="text-xs text-[#00A799] hover:underline font-medium">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide block">
            Timeline de alertas
          </span>
          <div className="space-y-4">
            {alertHistory.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 bg-white rounded-lg border p-4">
                <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${severityDot[entry.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[--color-midnight]">{entry.description}</p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Regra: {entry.ruleName} · {entry.datetime}
                  </p>
                  {entry.mentionLink && (
                    <Link to={entry.mentionLink} className="text-xs text-[#00A799] hover:underline mt-1 inline-block">
                      Ver menção →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Alerts.tsx
git commit -m "feat: implement Alerts page with configuration rules and timeline history tabs"
```

---

### Task 15: Reports Page

**Files:**
- Modify: `src/pages/Reports.tsx` (full rewrite)

- [ ] **Step 1: Implement Reports page with templates, config form, and generated reports list**

```tsx
// src/pages/Reports.tsx
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { templates, generatedReports } from "@/lib/mock/reports"
import { FileText, Download } from "lucide-react"

const statusStyles = {
  sent: { label: "Enviado", className: "bg-[#F0FDF4] text-[#16A34A]" },
  generated: { label: "Gerado", className: "bg-[#F3F4F6] text-[#6B7280]" },
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" subtitle="Gere relatórios personalizados de inteligência." />

      {/* Template cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-white rounded-lg border p-5">
            <span className="text-2xl">{tpl.emoji}</span>
            <h3 className="text-sm font-semibold text-[--color-midnight] mt-2">{tpl.name}</h3>
            <p className="text-xs text-[#6B7280] mt-1">{tpl.description}</p>
            <p className="text-[10px] text-[#6B7280] mt-2">{tpl.pages}</p>
            <button className="text-xs text-[#00A799] hover:underline font-medium mt-3 inline-block">
              Gerar relatório →
            </button>
          </div>
        ))}
      </div>

      {/* Config form */}
      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-4">Configurar geração</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Template</option>
            {templates.map(t => <option key={t.id}>{t.name}</option>)}
          </select>
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Período</option>
            <option>Última semana</option>
            <option>Último mês</option>
            <option>Último trimestre</option>
          </select>
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Marcas</option>
            <option>Nubank</option>
            <option>iFood</option>
            <option>Todas</option>
          </select>
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Formato</option>
            <option>PDF</option>
            <option>CSV</option>
          </select>
        </div>
        <div className="flex gap-3">
          <Button className="bg-[#00A799] hover:bg-[#00A799]/90 text-white text-xs h-8 px-4">
            Gerar PDF agora
          </Button>
          <Button variant="outline" className="text-xs h-8 px-4">
            Agendar envio mensal
          </Button>
        </div>
      </div>

      {/* Generated reports */}
      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-4">Relatórios gerados</h2>
        <div className="space-y-3">
          {generatedReports.map(report => {
            const status = statusStyles[report.status]
            return (
              <div key={report.id} className="flex items-center gap-4 py-2 border-b last:border-b-0">
                <FileText className="w-5 h-5 text-[#EC4899] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--color-midnight]">{report.name}</p>
                  <p className="text-xs text-[#6B7280]">{report.date} · {report.pages} páginas</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
                <button className="text-xs text-[#00A799] hover:underline font-medium flex items-center gap-1">
                  <Download className="w-3 h-3" /> Baixar
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Reports.tsx
git commit -m "feat: implement Reports page with templates, generation config, and report history"
```

---

## Phase 3: Final Integration

### Task 16: Remove Stale Files and Final Build

**Files:**
- Delete: `src/pages/Mentions.tsx` (if exists — it was referenced in old router but may not exist as a file)
- Verify: All imports resolve, build passes, dev server runs

- [ ] **Step 1: Clean up any stale files**

Check if `src/pages/Mentions.tsx` exists. If it does, delete it — the Monitoring page replaces it. The old router import for `MentionsPage` has been removed in Task 5.

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Zero errors. All pages compile.

- [ ] **Step 3: Start dev server and visually verify**

Run: `npm run dev`
Expected: App loads. Navigate through all routes:
- `/login` — split-screen login with rotating headlines
- `/register` — 3-step wizard
- `/dashboard` — KPI cards, charts, panels (requires auth, so test after login)
- `/intelligence/monitoring` — mention list with drawer
- `/intelligence/sentiment` — charts and topic breakdown
- `/intelligence/influencers` — bubble map and sortable table
- `/brands` — brand cards
- `/alerts` — config and history tabs
- `/reports` — templates and generated reports
- `/mentions` — redirects to `/intelligence/monitoring`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove stale files and finalize integration"
```

---

## Task Dependency Summary

```
Phase 1 (sequential):
  Task 1: ProtectedRoute
  Task 2: Shared UI Components
  Task 3: Mock Data Files
  Task 4: AppShell Redesign
  Task 5: Router + Stub Pages
    ↓
Phase 2 (parallel — all tasks independent):
  Task 6:  Login Page         ─┐
  Task 7:  Register Page      │
  Task 8:  Dashboard Page     │
  Task 9:  MentionDrawer      │ Can run in parallel
  Task 10: Monitoring Page*   │ (*depends on Task 9)
  Task 11: Sentiment Page     │
  Task 12: Influencers Page   │
  Task 13: Brands Page        │
  Task 14: Alerts Page        │
  Task 15: Reports Page       ─┘
    ↓
Phase 3 (sequential):
  Task 16: Final Integration
```

**Note:** Task 10 (Monitoring) imports MentionDrawer from Task 9, so Task 9 must complete before Task 10. All other Phase 2 tasks are fully independent.
