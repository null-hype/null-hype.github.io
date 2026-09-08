# Retrospective evidence workspace

This slice reuses the original tutorial-kit Dagger MCP bridge architecture:
the native `dagger mcp` process executes a dedicated method, while the HTTP
bridge advertises a typed tool to the real Inspector in TK's Live Preview.
Successful comparisons append evidence files to TK's editor and file tree.
The Inspector and MCP endpoint share an authenticated origin. Assets come from the existing
`npm run inspector` process on port 6274.

Run `npm run inspector` and `npm run retrospective` in this directory.
Set `RETRO_EVIDENCE_DIR` in your private `.env` to the evidence directory
exported by `notebooks/build_restic_model.py` in devenv-base-gce. The existing
tool's `.dagger/retro/README.md` documents refresh and extraction limits.
Use `DOCKER_CONFIG` if your Dagger engine needs the existing public-image
configuration. No restic credentials are required to read exported evidence.

Start the tutorial app and open `/part-1/chapter-1/lesson-4/`. The preview
uses `http://localhost:8812` in development and
`https://retrospective-mcp.tidelands.dev` in production. `PUBLIC_RETRO_RUNTIME_URL`
overrides the endpoint; it must contain no credential.

The bridge advertises existing snapshot pairs as schema enums and enforces
pair/category choices. It does not expose native Dagger's generic tools,
caller-controlled evidence, repository credentials, or transcript records.
It returns up to 30 changed-file rows plus counts and extraction limitations.
The evidence directory is an author-owned input, not a user upload directory.
Restart the bridge after refreshing exports to update its advertised catalog.

`npm run test:retrospective` tests the running real bridge, including rejected
extra arguments and invalid choices. The browser regression is
`tests/retrospective.spec.ts` in tutorial-app.

## Tool result to editor

The retrospective template starts a dependency-free WebContainer server on
4174 so TK creates its normal Live Preview pane. The lesson adapter navigates
that pane's managed iframe to the protected Inspector. This small DOM adapter
is specific to the installed TK layout; file operations use its public
`addFile`, `updateFile`, and `setSelectedFile` APIs, with WebContainer mkdir
creating parent directories first. It does not replace TK's panels or editor.

Each mounted lesson generates a random workspace channel, carried in its MCP
URL. The bridge associates successful tool results with that channel using
request-local async context. A script served with Inspector polls the same
origin and forwards results to the exact tutorial origin. The tutorial checks
the frame source, origin, channel, and manifest before creating files. No
Inspector request interception or DOM scraping is needed. Channels are random
capabilities behind Access, not a substitute for authentication. The server
retains at most 100 channels, 20 results each, with a five-minute read lifetime.
Older or missed events are not a durable execution history.

Each call creates `/evidence/<unique-run>/comparison.json` and changed-path
`.metadata.json` records. Plan files and earlier runs are never overwritten.
Results are bounded and traversal paths, duplicate paths, and inconsistent
counts are rejected before writes. Metadata is explicitly labelled; captured
contents and transcript records are not supplied. Workspace edits are temporary
and reset with the lesson. Pkl-driven editor hints remain a subsequent slice.

The frontend stays suitable for static Netlify hosting, but the native process
requires a VM and a supervised deployment. Current draft preview:
https://dev-gap-retrospective-preview--null-hype-tutorial-app.netlify.app/part-1/chapter-1/lesson-4/

The legacy Cloudflare Access application and policy were repurposed for
`retrospective-mcp.tidelands.dev` after the API token gained Access write
permission (CIT-66). A dedicated tunnel routes to this VM's loopback port
8812, protected by an email allow policy. The bridge and connector run under
a local process supervisor. That supervisor survives terminal disconnects
but is not installed as a boot service; its current deployment is under `/tmp`.
Set `RETRO_PUBLIC_ORIGIN=https://retrospective-mcp.tidelands.dev` for the
bridge's Host/Origin checks. The Inspector still binds to local port 6274.
The public sign-in redirect has been checked; authenticated public calls and
iframe cookie behavior require sign-in verification before merging this draft.
