import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@nexternel/plugin-sdk": path.resolve(root, "../../packages/plugin-sdk/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Development only: where `npm run dev` sends API calls. Set VITE_API_PROXY to your server.
        target: process.env.VITE_API_PROXY || "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
