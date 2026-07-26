import { createBrowserRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"
import LoginPage from "@/pages/Login"
import RegisterPage from "@/pages/Register"
import ForgotPasswordPage from "@/pages/ForgotPassword"
import AcceptInvitePage from "@/pages/AcceptInvite"
import OnboardingTenantPage from "@/pages/OnboardingTenant"
import DashboardPage from "@/pages/Dashboard"
import MonitoringPage from "@/pages/intelligence/Monitoring"
import SentimentPage from "@/pages/intelligence/Sentiment"
import SovPage from "@/pages/intelligence/Sov"
import InfluencersPage from "@/pages/intelligence/Influencers"
import BrandsPage from "@/pages/Brands"
import AlertsPage from "@/pages/Alerts"
import ReportsPage from "@/pages/Reports"
import ReportViewPage from "@/pages/ReportView"
import UsersPage from "@/pages/Users"
import SettingsPage from "@/pages/Settings"
import AdminBrandsPage from "@/pages/admin/AdminBrands"

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/invite/:token", element: <AcceptInvitePage /> },
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
      { path: "/mentions", element: <Navigate to="/intelligence/monitoring" replace /> },
      { path: "/brands", element: <BrandsPage /> },
      { path: "/alerts", element: <AlertsPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/users", element: <UsersPage /> },
      { path: "/settings", element: <SettingsPage /> },
      // Curadoria admin (ADR-021). O gate visual é o `isZoeAdmin`; a autoridade
      // real é a policy ZoeAdmin no backend (403 em /api/admin/*).
      { path: "/admin/brands", element: <AdminBrandsPage /> },
    ],
  },
])
