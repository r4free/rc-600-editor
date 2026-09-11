import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  root: "web",
  publicDir: resolve(__dirname, "web/public"),
  resolve: {
    alias: {
      "@rc600": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/web"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5190,
    strictPort: true,
    host: "127.0.0.1",
    allowedHosts: ["rc.test", "localhost"],
    headers: {
      "Permissions-Policy": "midi=(self)",
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5191",
        changeOrigin: true,
      },
    },
  },
});
