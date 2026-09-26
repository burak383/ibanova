/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = { target: "http://localhost:8787", changeOrigin: true };
// Geliştirmede /gizlilik ve /hesap-silme sayfaları da sunucudan gelir
const API_PROXY = { "/api": API, "/gizlilik": API, "/hesap-silme": API, "/privacy": API, "/delete-account": API, "/destek": API, "/support": API, "/kosullar": API, "/terms": API };

export default defineConfig({
  base: "./",
  plugins: [react()],
  // Yazı tipleri data: URL olarak gömülmesin; CSP (font-src 'self') yalnızca dosyaya izin verir
  build: { assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  server: { proxy: API_PROXY },
  preview: { proxy: API_PROXY },
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.js"] },
});
