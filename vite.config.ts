import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { alphaTab } from "@coderline/alphatab-vite";
import { resolve } from "node:path";
import { reactDevtoolsMcp } from "./vite-react-devtools-mcp";
import { paidShellPlugin } from "./vite-paid-shell";

try {
  process.loadEnvFile?.();
} catch {
  /* Optional .env; the API process loads the same file. */
}

export default defineConfig({
  plugins: [paidShellPlugin(), reactDevtoolsMcp(), react(), alphaTab()],
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
      "Permissions-Policy": "midi=(self), microphone=(self)",
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5191",
        changeOrigin: true,
      },
    },
  },
});
