import { createRoot } from 'react-dom/client'
import "@/lib/cognito"
import "@/styles/globals.css"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/features/auth/AuthContext"
import { BrandProvider } from "@/features/brands/BrandContext"
import { router } from "@/app/router"

const qc = new QueryClient()
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrandProvider><RouterProvider router={router} /></BrandProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
)
