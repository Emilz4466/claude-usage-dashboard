import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// W trybie dev (npm run dev) Vite serwuje na :5173 i przekierowuje /api do backendu na :4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  build: {
    outDir: "dist",
  },
});
