function html(body: string, title = "Fixture Target") {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    ${body}
  </body>
</html>`,
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      },
    },
  )
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  })
}

export function createRangeFixtureApp() {
  return {
    fetch(req: Request) {
      const url = new URL(req.url)

      if (url.pathname === "/healthz") {
        return json({
          app: "range-fixture",
          ok: true,
          path: url.pathname,
        })
      }

      if (url.pathname === "/" || url.pathname === "/recon") {
        const query = url.searchParams.get("q") ?? "fixture-query"
        const finding = url.searchParams.get("finding") ?? "reflected-search-param"

        return html(
          [
            `<main>`,
            `  <h1>Fixture Recon Surface</h1>`,
            `  <p data-reflected-query="${query}">Reflected query: ${query}</p>`,
            `  <p data-expected-finding="${finding}">Known finding: ${finding}</p>`,
            `</main>`,
          ].join("\n"),
        )
      }

      return json({
        app: "range-fixture",
        error: "Not found",
        path: url.pathname,
      }, 404)
    },
    run(args: string[]) {
      console.log("range fixture app")
      console.log(`args: ${JSON.stringify(args)}`)
    },
  }
}

const app = createRangeFixtureApp()

export default {
  fetch(req: Request) {
    return app.fetch(req)
  },
  run(args: string[]) {
    return app.run(args)
  },
}
