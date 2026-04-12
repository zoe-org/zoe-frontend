# Zoe Frontend — Pages Design Spec

**Date:** 2026-04-09  
**Status:** Approved — v2 (2026-04-09)  
**Scope:** All main platform pages + AppShell redesign

---

## 1. Context

Zoe is a marketing intelligence SaaS for brand monitoring and influencer campaign management. The frontend is React 19 + TypeScript + Vite, TailwindCSS v4, shadcn/ui, React Query, React Router v7, AWS Cognito auth.

Only `Login.tsx` and `AppShell.tsx` currently exist. All other pages are stubs referenced in the router.

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Sidebar structure | Accordion colapsável | "Intelligence" opens sub-pages; compact when closed |
| KPI cards | Progress bar + meta (Atvera-style) | Contextual — shows value and how close to goal |
| Implementation order | AppShell first, then pages | Stable foundation makes every page faster to build |
| Visual reference | Atvera dashboard + Zoe wireframes | Rich data density, multi-chart, marketing-focused |

---

## 3. Design Tokens (already in globals.css)

```css
--color-teal-500: #00A799   /* primary interactive, active nav, CTAs */
--color-ember:    #FF5B35   /* CTA primary: export, new item buttons */
--color-midnight: #07091A   /* headings, dark panel bg */
--color-ivory:    #F9FAFB   /* page background */
/* white (#FFFFFF) — sidebar, cards, topbar */
/* border: #E5E7EB */
/* text-secondary: #6B7280 */
/* positive: #16A34A bg #F0FDF4 */
/* warning: #D97706 bg #FFFBEB */
/* negative: #DC2626 bg #FEF2F2 */
```

---

## 4. AppShell Redesign

**File:** `src/components/layout/AppShell.tsx`  
Replaces the current minimal sidebar.

### 4.1 Sidebar (220px, white, border-right)

**Logo area (top)**
- Rounded teal square mark ("Z") + "Zoe" wordmark in bold

**Navigation body (flex-1, scrollable)**
- `Dashboard` — single item, always visible
- Section label: `INTELLIGENCE`
- `Intelligence` — accordion trigger (chevron ▾/▲), expands to show:
  - `Monitoramento`
  - `Sentimento`
  - `Influenciadores`
  - `Alertas` — badge with unread count (red pill, #FF5B35)
- Section label: `GESTÃO`
- `Marcas`
- `Relatórios`

**Active state:** `bg-[#F0FDFA] text-[#00A799] font-semibold`  
**Hover state:** `bg-[#F9FAFB]`  
**Accordion state:** persisted in localStorage key `zoe_sidebar_intel_open`

**Footer (border-top)**
- Avatar (initials, teal bg) + name + role/tenant
- Settings icon (⚙) — opens dropdown (placeholder for now)

### 4.2 Topbar (52px, white, border-bottom)

Left to right:
- **Page title** — `h1`, font-size 14px, font-weight 700, flex-1
- **Search bar** — `bg-[#F9FAFB]`, placeholder "Buscar...", width 160px, rounded-md (global search, non-functional in MVP)
- **Notification bell** — icon button, red dot badge when alerts exist
- **Brand selector** — colored dot + brand name + chevron, opens dropdown of tenant brands

### 4.3 Content area

- `bg-[#F9FAFB]`, `p-6`, flex-1, `overflow-y-auto`
- Each page rendered via `<Outlet />`
- **Breadcrumb** rendered between topbar and page content on all protected pages (except Dashboard, which shows the greeting instead)

**Breadcrumb behavior:**
- `Dashboard` → no breadcrumb (greeting serves as context)
- `Intelligence / Monitoramento` → "Intelligence › Monitoramento"
- `Intelligence / Sentimento` → "Intelligence › Sentimento"
- `Intelligence / Influenciadores` → "Intelligence › Influenciadores"
- `Intelligence / Alertas` → "Intelligence › Alertas"
- `Gestão / Marcas` → "Gestão › Marcas"
- `Gestão / Relatórios` → "Gestão › Relatórios"
- Each segment is a link except the last (current page)
- Component: `src/components/ui/breadcrumb.tsx`

### 4.4 Router changes

Current routes to update/add:

```
/intelligence/monitoring   → MonitoringPage    (rename from /mentions)
/mentions                  → redirect to /intelligence/monitoring (preserve bookmarks)
/intelligence/sentiment    → SentimentPage     (new)
/intelligence/influencers  → InfluencersPage   (new)
/reports                   → ReportsPage       (new)
/login                     → LoginPage         (redesign)
/register                  → RegisterPage      (wizard, redesign)
```

Keep `/brands` as-is. `/alerts` stays at the same path but nav position moves inside Intelligence accordion.

---

## 5. Pages

### 5.1 Login (`/login`)

**Layout:** full-screen split, no AppShell

**Left panel (50%, bg midnight #07091A)**
- Zoe logo (SVG mark + wordmark, white)
- Rotating headline (3 slides, auto-advance every 4s):
  - "Hoje a Zoe analisou **12.847** menções de marca em vídeo."
  - "Monitore sua marca. Em tempo real. Com IA multimodal."
  - "Inteligência e gestão de marketing de influência."
- Subtitle line below each headline
- Slide indicators (3 dots, active = white, inactive = white/40%)
- Down-arrow icon

**Right panel (50%, white)**
- "Entre na sua conta" h1 + "Bem-vinda de volta." subtitle
- `E-mail` label + input
- `Senha` label + input + show/hide toggle
- Row: "Manter conectado" checkbox + "Esqueci a senha" link (teal)
- Primary button: "Entrar" (full width, teal bg)
- Divider: "ou"
- Secondary button: "Continuar com Google" (outline, Google SVG icon)
- Secondary button: "Continuar com Microsoft" (outline, MS icon placeholder)
- Footer: "Ainda não tem conta? **Comece grátis**" (link → /register)

**Mock data:** none (connects to real Cognito)

---

### 5.2 Register (`/register`)

**Layout:** centered wizard card, no AppShell. Progress bar at top (1/2/3 of 3).

**Step 1 — Intenção**
- Title: "O que você quer fazer com a Zoe?"
- Subtitle: "Você pode mudar isso depois."
- 3 selectable cards (radio behavior):
  - 🔵 **Monitorar minha marca** — "Veja em tempo real o que falam sobre você em vídeos e podcasts."
  - 🟦 **Gerenciar campanhas** — "Contratos digitais, escrow seguro e workflow." — badge "mais completo"
  - 🩵 **Quero os dois** — "Inteligência + gestão com auditoria por IA."
- Button: "Continuar" (disabled until one selected)

**Step 2 — Conta**
- Title: "Crie sua conta" + "Leva menos de um minuto."
- Fields: Nome completo, E-mail corporativo, Senha (with strength indicator), Empresa ou agência, Cargo (select: Marketing / Growth / Fundador / Agência / Outro)
- Checkbox: "Aceito os termos e a política de privacidade" (link opens modal)
- Button: "Criar minha conta" → calls Cognito signUp → advances to step 3

**Step 3 — Verificação**
- Title: "Confirme seu e-mail"
- Subtitle: "Mandamos um código de 6 dígitos pra {email}"
- 6 OTP digit inputs (auto-focus next on input)
- Timer: "Reenviar em Xs" → "Não recebeu? Reenviar" after 30s
- Link: "Usar e-mail diferente" → back to step 2
- Auto-submits when 6th digit entered → calls Cognito confirmSignUp → redirects to /dashboard

---

### 5.3 Dashboard (`/dashboard`)

**Header**
- "Bom dia/tarde/noite, {name}! 👋" (greeting based on hour)
- Subtitle: "Acompanhe de perto o desempenho do seu marketing"

**KPI Cards row (4 cards) — Intelligence only, no Operations module**

| Card | Value | Meta | Bar color |
|---|---|---|---|
| Menções esta semana | 847 | 1.000 (84%) | teal |
| Sentimento positivo | 67% | 70% (95%) | teal |
| Alcance estimado | 4.2M | 5M (84%) | amber |
| Alertas ativos | 3 | — (no progress bar) | red (#DC2626) |

Each card: label, large value, "Meta: X" label, % progress, thin progress bar.  
Exception — **Alertas ativos**: no meta/progress bar; value shown in red if > 0, gray if 0; sub-label "X críticos · Y avisos".

**Main content grid (2 columns, top row)**

Left (flex-2): **Sentimento – 30 dias**
- Dual-color bar chart (teal = positive, #FDA4A4 = negative)
- X-axis: dates (abbreviated), Y-axis labels: Positivo / Neutro / Negativo
- 3-dot menu (ellipsis) on card header for future actions

Right (flex-1, stacked):
- **Alertas recentes** — list of 3 most recent alerts with colored dot + text + time ago
- **Menções recentes** — list of 3 most recent mentions with text snippet + sentiment badge

**Bottom row (2 columns)**

Left (flex-1): **Top Influenciadores por Menções**
- Ranked list (top 5), each row:
  - Rank number + avatar (initials) + name + @handle
  - Menções count (bold, right) + sentiment badge
  - Platform badge (YT/TT/IG)
- "Ver todos →" link to `/intelligence/influencers`

Right (flex-1): **Tópicos em Alta**
- List of top 6 topics, each row:
  - Topic name + mention count + trend arrow (↑↓)
  - Thin sentiment bar (green/gray/red split, full width)
- Color-coded: teal border if predominantly positive, red if negative

**Mock data file:** `src/lib/mock/dashboard.ts`  
Exports: `kpiData`, `sentimentChart`, `recentAlerts`, `recentMentions`, `topInfluencers`, `hotTopics`

---

### 5.4 Monitoramento (`/intelligence/monitoring`)

**Header row**
- Title "Monitoramento" + subtitle "Feed completo de menções detectadas em vídeo."
- Right: search input "Buscar transcrição..." + button "Exportar" (#FF5B35)

**Filter chips row**
- `Últimos 7 dias` (period picker trigger)
- `Todas plataformas ▾` (YouTube / TikTok / Instagram / Podcast)
- `Todos sentimentos ▾`
- `Todas marcas ▾`
- `Com logo ▾` (Yes / No / Any)

**Sentiment tabs**
- Todos (847) · Positivo (568) · Neutro (186) · Negativo (93)

**Mentions list**
Each row:
- Thumbnail placeholder (grey rect, play icon, 80×50px)
- Title (bold) + creator handle + views + time ago + "LOGO" badge (teal, if detected)
- Right: platform badge (YT/TT/IG pill) + sentiment badge (colored text)
- Clicking a row opens the **mention detail drawer**

**Mention detail drawer** (right-side Sheet, 480px wide, overlay)
- Header: "Detalhe da Menção" + close button (×)
- Left section: video player placeholder (16:9) + title + creator + "Positivo (+0.78)" badge + "Logo detectado" badge
- "TRANSCRIÇÃO (TRECHOS COM MENÇÃO)" section label
  - List: timestamp (teal link) + quoted text, brand keyword highlighted in teal bg
- "LOGO DETECTADO (FRAMES)" section label
  - Row of timestamp chips (00:12, 02:14…)
  - "Exposição total: 47s · Tamanho médio: 12% do frame"
- Uses shadcn `Sheet` component (`side="right"`)
- Component: `src/components/features/MentionDrawer.tsx`

**Mock data file:** `src/lib/mock/monitoring.ts` — 10 mentions, mix of sentiments

---

### 5.5 Sentimento (`/intelligence/sentiment`)

**Filter chips row**
- `Último mês` · `Todas marcas ▾` · `Semanal ▾`

**Summary KPIs (3 cards)**
- Positivo 67% | Neutro 13% | Negativo 20%

**Main grid (2 columns)**

Left: **Evolução de sentimento**
- Line chart, 3 series: Positivo (green), Neutro (gray), Negativo (red)
- X-axis: Sem 1–4, Y-axis: 0–100%
- Legend above chart

Right: **Eventos de impacto**
- "Menções que mais influenciaram a curva de sentimento."
- List: date + title + delta score (e.g. "+0.22 no score" in green / "−0.15 no score" in red)

**Bottom full-width: Sentimento por tópico**
- 4 topic cards side by side: App/UX · Cartão de crédito · Atendimento · Investimentos
- Each: topic name + horizontal stacked bar (green/gray/red) + percentages below

**Bottom secondary: Tópicos mais citados**
- Tag cloud: colored pills (teal = positive topic, red = negative, amber = mixed)

**Mock data file:** `src/lib/mock/sentiment.ts`

---

### 5.6 Influenciadores (`/intelligence/influencers`)

**Filter chips row**
- `Último mês` · `Todas plataformas ▾` · `Ordenar: Relevância ▾`

**Top grid (2 columns)**

Left: **Mapa de bolhas (Alcance × Sentimento)**
- SVG/div-based bubble chart (no external charting lib required for MVP)
- X-axis: sentiment score (−1 to +1), Y-axis: reach
- Bubble size = subscriber count, color = sentiment (teal positive / red negative)
- Label: influencer name

Right: **Distribuição por categoria**
- List with category name + bar (teal, width = %) + count + percentage
- Finanças pessoais (48%) / Reviews/Tech (24%) / Lifestyle (17%) / Humor (10%)

**Table (full width)**
Columns: INFLUENCIADOR (name + @handle + avatar) | PLATAFORMA (badge) | INSCRITOS | MENÇÕES | SENTIMENTO (score, colored) | ALCANCE | TREND (↑↓→ icon)

Sortable columns: Inscritos, Menções, Alcance (click header to sort).

**Mock data file:** `src/lib/mock/influencers.ts` — 6 influencers

---

### 5.7 Marcas (`/brands`)

**Header**
- Title "Marcas monitoradas" + button "+ Nova marca" (#FF5B35, right-aligned)

**Brand cards list**
Each card:
- Brand logo (colored initial square) + name + "X menções · Y keywords"
- Thin progress bar (teal, % of mention goal)
- Status badge: Ativa (green) / Pausada (gray) / Configurando (amber)
- 3-dot menu → Edit / Pause / Delete

**Empty state:** illustration + "Nenhuma marca configurada" + CTA button

**Mock data:** 3 brands (Nubank active, iFood active, XP pausada)
prefir
---

### 5.8 Alertas (`/alerts`)

**Tab bar**
- `Configuração` | `Histórico`

**Tab: Configuração**
- Row: "Regras ativas (4)" label + "+ Nova regra" button (#FF5B35)
- Rule cards list, each:
  - Toggle switch (on/off)
  - Rule name (bold) + condition description + "Notificar via: X + Y"
  - "Editar" link (teal, right)
  - Left border color: red = critical, amber = warning, teal = info

Mock rules:
1. Pico de sentimento negativo — Sentimento < -0.5 AND views > 100K
2. CONAR — #publi ausente — Menção sem #publi ou #ad
3. Audiência anômala — Crescimento de inscritos > 30% em 24h
4. Share of voice abaixo do limiar — SoV < 25% por 7 dias (disabled)

**Tab: Histórico**
- "TIMELINE DE ALERTAS" section label
- Each entry: colored dot + description + "Regra: X · Data/Hora" + "Ver menção →" link

**Mock data file:** `src/lib/mock/alerts.ts`

---

### 5.9 Relatórios (`/reports`)

**Template cards (3 cards, horizontal row)**
Each: emoji icon + name + description + "~N páginas" + "Gerar relatório →" link (teal)
- 📊 Relatório Semanal — ~2 páginas
- 📋 Relatório Mensal — ~8 páginas
- 🚨 Relatório de Crise — ~4 páginas

**Configurar geração form**
Section label "CONFIGURAR GERAÇÃO"
- Dropdowns: Template | Período | Marcas | Formato (PDF/CSV)
- Buttons: "Gerar PDF agora" (teal, primary) + "Agendar envio mensal" (outline)

**Relatórios gerados list**
Section label "RELATÓRIOS GERADOS"
Each row: pink PDF icon + name + date + pages + status badge (Enviado/Gerado) + "Baixar" link

**Mock data file:** `src/lib/mock/reports.ts`

---

## 6. Shared Components to Create

| Component | Location | Used in |
|---|---|---|
| `KpiCard` | `src/components/ui/kpi-card.tsx` | Dashboard, Sentimento |
| `SentimentBadge` | `src/components/ui/sentiment-badge.tsx` | Monitoramento, Influenciadores |
| `FilterChip` | `src/components/ui/filter-chip.tsx` | Monitoramento, Sentimento, Influenciadores |
| `PageHeader` | `src/components/ui/page-header.tsx` | All protected pages |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Brands, Alerts |
| `Breadcrumb` | `src/components/ui/breadcrumb.tsx` | All protected pages except Dashboard |
| `MentionDrawer` | `src/components/features/MentionDrawer.tsx` | Monitoramento, Dashboard (menções recentes) |

---

## 7. Mock Data Strategy

All mock data in `src/lib/mock/` directory. Each file exports typed arrays:

```
src/lib/mock/
  dashboard.ts      — kpiData, sentimentChart, recentAlerts, recentMentions, topInfluencers, hotTopics
  monitoring.ts     — mentions[] with drawer detail data
  sentiment.ts      — weeklyTrend[], impactEvents[], topicBreakdown[]
  influencers.ts    — influencers[] with bubbleMap coords
  brands.ts         — brands[]
  alerts.ts         — rules[], alertHistory[]
  reports.ts        — templates[], generatedReports[]
```

Each mock dataset includes at least one example of each state: normal, edge (empty/zero), and high-value.

---

## 8. File Structure

```
src/
  app/
    router.tsx              ← update routes
  components/
    layout/
      AppShell.tsx          ← full redesign
    ui/
      kpi-card.tsx          ← new
      sentiment-badge.tsx   ← new
      filter-chip.tsx       ← new
      page-header.tsx       ← new
      empty-state.tsx       ← new
      breadcrumb.tsx        ← new
    features/
      MentionDrawer.tsx     ← new
  lib/
    mock/                   ← new directory
      dashboard.ts
      monitoring.ts
      sentiment.ts
      influencers.ts
      brands.ts
      alerts.ts
      reports.ts
  pages/
    Login.tsx               ← redesign
    Register.tsx            ← wizard, redesign
    Dashboard.tsx           ← new
    intelligence/
      Monitoring.tsx        ← new (was Mentions.tsx)
      Sentiment.tsx         ← new
      Influencers.tsx       ← new
    Brands.tsx              ← new
    Alerts.tsx              ← new
    Reports.tsx             ← new
```

---

## 9. Out of Scope (MVP)

- Real chart library integration (use CSS/div bars for now; recharts can be added later)
- Bubble map with physics (static positioned divs for MVP)
- Real export / PDF generation
- Global search functionality
- Brand creation form (modal skeleton only)
- Alert rule creation/edit form
- Google / Microsoft SSO (buttons render, do not connect)
- Dark mode
