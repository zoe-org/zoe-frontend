import { createRoot } from 'react-dom/client'
import "@/lib/cognito"
import "@/styles/globals.css"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/AuthContext"
import { BrandProvider } from "@/features/brands/BrandContext"
import { ConfirmProvider } from "@/features/confirm/ConfirmProvider"
import { router } from "@/app/router"
import { upgradeAwareCaches } from "@/features/features/featureBlocked"

// Os caches vêm de fora para que TODO 403 de feature paga chegue ao modal de
// upgrade — query ou mutação, de qualquer tela. Tratar erro tela a tela faria a
// próxima superfície gated nascer sem o aviso.
const qc = new QueryClient(upgradeAwareCaches)
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <ConfirmProvider>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <BrandProvider><RouterProvider router={router} /></BrandProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ConfirmProvider>
    {/* Nunca tinha sido montado: todo toast do app era chamado e não aparecia (WS-F11). */}
    <Toaster position="bottom-right" />
  </ThemeProvider>
)
