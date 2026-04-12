import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
