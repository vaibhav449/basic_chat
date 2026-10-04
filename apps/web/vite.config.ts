import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The API target is only used by the dev server. In production the built
 * assets are static files behind a reverse proxy that routes /api and
 * /socket.io to the api container, so the client never needs to know a
 * hostname - see src/socket.ts.
 */
const API_TARGET = process.env.API_TARGET ?? "http://localhost:4010";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/socket.io": { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
