import { createRoot } from 'react-dom/client'
import "@/lib/cognito"
import "@/styles/globals.css"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/features/auth/AuthContext"
import { router } from "@/app/router"

const qc = new QueryClient()
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <AuthProvider><RouterProvider router={router} /></AuthProvider>
  </QueryClientProvider>
)
