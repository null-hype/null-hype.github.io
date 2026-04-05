function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

function renderDashboard(req: Request): Response {
  const url = new URL(req.url)
  const email = req.headers.get("Remote-Email") ?? "unknown"
  const host = req.headers.get("Host") ?? "unknown"
  const requestId = req.headers.get("X-Request-Id") ?? "n/a"
  const forwardedFor = req.headers.get("X-Forwarded-For") ?? "n/a"

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Smallweb Admin</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe5;
        --panel: rgba(255, 250, 242, 0.92);
        --ink: #1f1a17;
        --muted: #6b5e53;
        --line: #d9c5ad;
        --accent: #b5542b;
        --accent-soft: rgba(181, 84, 43, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(181, 84, 43, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(51, 94, 115, 0.14), transparent 30%),
          linear-gradient(180deg, #f7f2ea 0%, var(--bg) 100%);
        color: var(--ink);
        font: 16px/1.5 Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }
      .eyebrow {
        margin: 0 0 14px;
        color: var(--accent);
        font: 700 0.78rem/1.2 "Courier New", monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.6rem, 7vw, 5rem);
        line-height: 0.94;
        letter-spacing: -0.045em;
      }
      .lede {
        max-width: 40rem;
        margin: 18px 0 0;
        color: var(--muted);
        font-size: 1.05rem;
      }
      .grid {
        display: grid;
        gap: 18px;
        margin-top: 28px;
      }
      .panel {
        padding: 22px;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--panel);
        box-shadow: 0 18px 40px rgba(64, 45, 28, 0.08);
      }
      .panel h2 {
        margin: 0 0 10px;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 8px 14px;
        margin: 0;
      }
      dt {
        color: var(--muted);
        font-weight: 700;
      }
      dd {
        margin: 0;
        word-break: break-word;
      }
      code {
        padding: 0.15rem 0.35rem;
        border-radius: 999px;
        background: var(--accent-soft);
        font: 0.92rem/1.3 "Courier New", monospace;
      }
      ul {
        margin: 0;
        padding-left: 1.2rem;
      }
      a { color: var(--accent); }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Authenticated Admin Surface</p>
      <h1>Smallweb Admin</h1>
      <p class="lede">
        This route is protected by Smallweb OIDC. If you can read this page,
        the auth gate allowed your identity through and the app can see the
        proxied user headers.
      </p>
      <section class="grid">
        <article class="panel">
          <h2>Session</h2>
          <dl>
            <dt>Remote Email</dt>
            <dd><code>${escapeHtml(email)}</code></dd>
            <dt>Host</dt>
            <dd>${escapeHtml(host)}</dd>
            <dt>Path</dt>
            <dd>${escapeHtml(url.pathname)}</dd>
            <dt>Request Id</dt>
            <dd>${escapeHtml(requestId)}</dd>
            <dt>Forwarded For</dt>
            <dd>${escapeHtml(forwardedFor)}</dd>
          </dl>
        </article>
        <article class="panel">
          <h2>Smoke Test Targets</h2>
          <ul>
            <li><code>/healthz</code> stays public for load balancer checks.</li>
            <li><code>/api/session</code> returns authenticated request metadata.</li>
            <li>The root route should redirect unauthenticated users into OIDC.</li>
          </ul>
        </article>
      </section>
    </main>
  </body>
</html>`

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

export default {
  fetch: (req: Request) => {
    const url = new URL(req.url)

    if (url.pathname === "/healthz" || url.pathname === "/readyz") {
      return json({
        ok: true,
        app: "admin",
        path: url.pathname,
      })
    }

    if (url.pathname === "/api/session") {
      return json({
        remoteEmail: req.headers.get("Remote-Email"),
        host: req.headers.get("Host"),
        path: url.pathname,
      })
    }

    return renderDashboard(req)
  },
  run: (args: string[]) => {
    console.log("smallweb admin app")
    console.log(`args: ${JSON.stringify(args)}`)
  },
}
