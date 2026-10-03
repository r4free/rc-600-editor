import type { Plugin } from "vite";
import { editorSessionAllowed } from "./server/dev-session.js";
import { decidePaidShell, shellRequestKind } from "./server/shell-gate.js";

/** Block editor modules in `npm run ui` when RC600_REQUIRE_LICENSE is on. */
export function paidShellPlugin(): Plugin {
  return {
    name: "rc600-paid-shell",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        if (shellRequestKind(url) === "api") {
          next();
          return;
        }
        const cookie = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
        void editorSessionAllowed(cookie)
          .then((sessionOk) => {
            const decision = decidePaidShell(url, sessionOk);
            if (decision.action === "next") {
              next();
              return;
            }
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Content-Type-Options", "nosniff");
            if (decision.action === "page") {
              res.statusCode = 200;
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(decision.html);
              return;
            }
            res.statusCode = 404;
            res.end();
          })
          .catch(() => {
            res.statusCode = 503;
            res.end();
          });
      });
    },
  };
}
