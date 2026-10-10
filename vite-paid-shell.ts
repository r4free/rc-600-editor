import type { Plugin } from "vite";
import { devLicenseIssuerAllowed } from "./server/dev-license.js";
import { editorSessionAllowed } from "./server/dev-session.js";
import {
  decidePaidShell,
  demoViewAllowed,
  demoViewCookie,
  shellRequestKind,
} from "./server/shell-gate.js";

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
        const forwarded = req.headers["x-forwarded-host"];
        if (
          devLicenseIssuerAllowed(
            process.env,
            req.headers.host,
            Array.isArray(forwarded) ? forwarded.join(",") : forwarded,
          )
        ) {
          // Local dev: the React activation screen carries the Issue key manager.
          next();
          return;
        }
        const cookie = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
        void editorSessionAllowed(cookie)
          .then((sessionOk) => {
            const decision = decidePaidShell(url, sessionOk, demoViewAllowed(cookie));
            if (decision.action === "demo") {
              res.setHeader("Set-Cookie", demoViewCookie());
              res.setHeader("Cache-Control", "no-store");
              next();
              return;
            }
            if (decision.action === "redirect") {
              res.statusCode = 302;
              res.setHeader("Cache-Control", "no-store");
              res.setHeader("Location", decision.location);
              res.end();
              return;
            }
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
