import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import svgr from "vite-plugin-svgr";
// `vitest/config` (não `vite`) para o bloco `test` ser tipado.
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // Testes de lógica pura por enquanto (sem DOM) — `environment: "jsdom"`
    // e testing-library entram quando houver teste de componente.
    include: ["src/**/*.test.ts"],
  },
})
