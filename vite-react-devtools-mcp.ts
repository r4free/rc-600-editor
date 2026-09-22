import type { Plugin } from "vite";

/** Same-origin hook so Herd HTTPS (*.test) can reach the Cursor MCP on 8097. */
export const REACT_DEVTOOLS_MCP_PATH = "/__react-devtools";
const DEVTOOLS_ORIGIN = "http://127.0.0.1:8097";

export function reactDevtoolsMcp(): Plugin {
  return {
    name: "react-devtools-mcp",
    apply: "serve",
    config() {
      return {
        server: {
          proxy: {
            [REACT_DEVTOOLS_MCP_PATH]: {
              target: DEVTOOLS_ORIGIN,
              changeOrigin: true,
              ws: true,
              rewrite: () => "/",
            },
          },
        },
      };
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== REACT_DEVTOOLS_MCP_PATH) return next();
        if (req.headers.upgrade?.toLowerCase() === "websocket") return next();

        try {
          const upstream = await fetch(`${DEVTOOLS_ORIGIN}/`);
          if (!upstream.ok) throw new Error(String(upstream.status));
          let body = await upstream.text();
          body = body.replace(
            /ReactDevToolsBackend\.connectToDevTools\([^)]*\);/,
            `ReactDevToolsBackend.connectToDevTools({websocket:new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"${REACT_DEVTOOLS_MCP_PATH}")});`,
          );
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(body);
        } catch {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.end("/* React DevTools MCP offline (Cursor, port 8097) */\n");
        }
      });
    },
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { src: REACT_DEVTOOLS_MCP_PATH },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}
