import { createRoot } from 'react-dom/client'
import "@/lib/cognito"
import "@/styles/globals.css"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/features/auth/AuthContext"
import { BrandProvider } from "@/features/brands/BrandContext"
import { router } from "@/app/router"
import { Toaster } from "@/components/ui/sonner"

const qc = new QueryClient()
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrandProvider><RouterProvider router={router} /></BrandProvider>
      </AuthProvider>
    </QueryClientProvider>
    {/* O app inteiro chama toast() — sucesso, erro de API, convite duplicado — e o
        container nunca foi montado: toda mensagem sumia em silêncio. Fica aqui, dentro do
        ThemeProvider porque o componente lê o tema. */}
    <Toaster position="top-right" />
  </ThemeProvider>
)
