import { createBrowserRouter, Navigate } from "react-router-dom"
import { LegacyRedirect } from "@/components/settings/LegacyRedirect"
import { AppShell } from "@/components/layout/AppShell"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"
import LoginPage from "@/pages/Login"
import RegisterPage from "@/pages/Register"
import ForgotPasswordPage from "@/pages/ForgotPassword"
import AcceptInvitePage from "@/pages/AcceptInvite"
import InfluencerInvitePage from "@/pages/InfluencerInvite"
import CreatorHomePage from "@/pages/creator/CreatorHome"
import CreatorOnboardingPage from "@/pages/creator/CreatorOnboarding"
import CreatorPayoutPage from "@/pages/creator/CreatorPayout"
import OnboardingTenantPage from "@/pages/OnboardingTenant"
import DashboardPage from "@/pages/Dashboard"
import MonitoringPage from "@/pages/intelligence/Monitoring"
import SentimentPage from "@/pages/intelligence/Sentiment"
import SovPage from "@/pages/intelligence/Sov"
import InfluencersPage from "@/pages/intelligence/Influencers"
import { BrandDashboardRedirect } from "@/features/brands/BrandDashboardRedirect"
import BrandsPage from "@/pages/Brands"
import AlertsPage from "@/pages/Alerts"
import ReportsPage from "@/pages/Reports"
import ReportViewPage from "@/pages/ReportView"
import OperationsCampaignsPage from "@/pages/operations/Campaigns"
import OperationsContractDetailPage from "@/pages/operations/ContractDetail"
import OperationsContractsPage from "@/pages/operations/Contracts"
import OperationsDashboardPage from "@/pages/operations/Dashboard"
import OperationsDeliveriesPage from "@/pages/operations/Deliveries"
import OperationsEscrowPage from "@/pages/operations/Escrow"
import OperationsRosterPage from "@/pages/operations/Roster"
import UsersPage from "@/pages/Users"
import AdminBrandsPage from "@/pages/admin/AdminBrands"
import TermsPage from "@/pages/legal/Terms"
import PrivacyPage from "@/pages/legal/Privacy"

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  // Documentos legais: públicos, porque são lidos antes de existir conta — no cadastro e no
  // convite de criador, que é quando a pessoa aceita.
  { path: "/terms", element: <TermsPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/invite/:token", element: <AcceptInvitePage /> },
  // Convite de criador: separado de /invite porque não cria membership. Prévia pública; aceite exige login.
  { path: "/creator-invite/:token", element: <InfluencerInvitePage /> },
  // Área do criador: protegida, mas fora do AppShell — ele não tem workspace para o
  // shell da marca representar, e nenhuma tela de lá responderia sem tenant.
  {
    path: "/creator",
    element: <ProtectedRoute><CreatorHomePage /></ProtectedRoute>,
  },
  {
    // Cadastro em três passos. Fora do AppShell e com layout próprio: quem chega aqui
    // acabou de aceitar um convite e ainda não tem nada para navegar.
    path: "/creator/onboarding",
    element: <ProtectedRoute><CreatorOnboardingPage /></ProtectedRoute>,
  },
  {
    // Fora do AppShell, sem workspace de marca. É a returnUrl do provedor ao fim do cadastro.
    path: "/creator/payout",
    element: <ProtectedRoute><CreatorPayoutPage /></ProtectedRoute>,
  },
  {
    path: "/onboarding/tenant",
    element: <ProtectedRoute><OnboardingTenantPage /></ProtectedRoute>,
  },
  // View print-friendly do relatório: fora do AppShell de propósito — documento
  // não imprime com sidebar/topbar. O gate da feature é feito pela própria página
  // de origem e pelo backend (403).
  {
    path: "/reports/:reportId",
    element: <ProtectedRoute><ReportViewPage /></ProtectedRoute>,
  },
  {
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/intelligence/monitoring", element: <MonitoringPage /> },
      { path: "/intelligence/sentiment", element: <SentimentPage /> },
      // SoV: rota sempre montada; a própria página faz o gate (upsell sem a feature).
      { path: "/intelligence/sov", element: <SovPage /> },
      { path: "/intelligence/influencers", element: <InfluencersPage /> },
      // Drill-down do SoV (ADR-035, D6). Por brandId e não por slug: o SoV já
      // tem o id em mãos, e slug de marca global pode mudar na verificação.
      { path: "/intelligence/competitive/:brandId", element: <BrandDashboardRedirect /> },
      // Tela de canal próprio removida: link antigo cai no monitoramento já filtrado.
      { path: "/intelligence/owned", element: <Navigate to="/intelligence/monitoring?rel=owned" replace /> },
      { path: "/mentions", element: <Navigate to="/intelligence/monitoring" replace /> },
      // Operations: rota sempre montada. O gate real é o [RequiresFeature] do
      // backend (403); o item no menu é que some sem a feature.
      { path: "/operations", element: <OperationsDashboardPage /> },
      { path: "/operations/campaigns", element: <OperationsCampaignsPage /> },
      { path: "/operations/influencers", element: <OperationsRosterPage /> },
      { path: "/operations/contracts", element: <OperationsContractsPage /> },
      { path: "/operations/deliveries", element: <OperationsDeliveriesPage /> },
      { path: "/operations/escrow", element: <OperationsEscrowPage /> },
      { path: "/operations/contracts/:contractId", element: <OperationsContractDetailPage /> },
      { path: "/brands", element: <BrandsPage /> },
      { path: "/alerts", element: <AlertsPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/users", element: <UsersPage /> },
      // Consumo, Plano e Configurações viraram seções de um diálogo (`?settings=`),
      // aberto por cima da tela atual. As rotas antigas continuam válidas — link salvo
      // não vira 404 — e o redirecionamento PRESERVA a query: é por ela que chega o
      // `?checkout=success` do provedor, que dispara a sincronização no retorno.
      { path: "/usage", element: <LegacyRedirect section="consumo" /> },
      { path: "/plan", element: <LegacyRedirect section="plano" /> },
      { path: "/settings", element: <LegacyRedirect section="perfil" /> },
      // Curadoria admin (ADR-021). O gate visual é o `isZoeAdmin`; a autoridade
      // real é a policy ZoeAdmin no backend (403 em /api/admin/*).
      { path: "/admin/brands", element: <AdminBrandsPage /> },
    ],
  },
])
