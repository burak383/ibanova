/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PROXY = { "/api": { target: "http://localhost:8787", changeOrigin: true } };

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { proxy: API_PROXY },
  preview: { proxy: API_PROXY },
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.js"] },
});
