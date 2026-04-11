# null-hype.github.io

Plain Astro site for the `null-hype.github.io` Pages deployment.

## Render PR Pipeline

This repo includes dedicated Render services for PR-scoped Dagger module checks.

`render.yaml` defines two base Render services:

- Service name: `null-hype-dagger-pr-check`
- Purpose: preview-safe check for the `infra` Dagger module
- Service name: `null-hype-bountybench-pr-check`
- Purpose: preview-safe check for the BountyBench Lunary slice under `dagger/bountybench`
- Branch: `master`
- Runtime: Node
- Preview generation: manual
- Preview trigger: add the GitHub label `render-preview` to a PR
- Auto deploy on branch commits: off

The preview service is intended to exercise the Dagger module itself, not to run Terraform against live infrastructure.

Required environment for preview checks:

- Remote Dagger engine: `SSH_PRIVATE_KEY`, `REMOTE_DOCKER_SSH_TARGET`

Local bootstrap order for the current Render setup:

1. Run the long-lived infra provisioner locally with `deploy`, not `check`.
2. SSH to the created VM and run [`infra/scripts/bootstrap-docker-engine.sh`](/workspaces/null-hype.github.io/infra/scripts/bootstrap-docker-engine.sh).
3. Set `REMOTE_DOCKER_SSH_TARGET` in Render to that host, for example `smallweb@203.0.113.10`.
4. Redeploy the Render service so Dagger uses the remote Docker engine over SSH.
5. The infra preview runs `dagger call -m ./infra module-check --src=infra`, which installs module dependencies, builds the TypeScript module, and runs a small Node smoke test.
6. The BountyBench preview runs `dagger check -m ./dagger/bountybench/bounty` against the remote Dagger engine.

The BountyBench lane is intended to be usable as a TDD/Jules handoff surface: a PR can intentionally stage a red native Dagger check, let Render expose the failing preview, and then delegate the fix in a follow-up PR.

## Quick Mutagen Deploy

For a first quick-and-dirty Smallweb deploy, the Dagger module now exports a Mutagen-ready artifact set:

1. Build the site and generate the sync bundle:
   `ADMIN_AUTHORIZED_EMAILS='you@example.com' MUTAGEN_DESTINATION='smallweb@203.0.113.10:/opt/tidelands/smallweb' ./infra/scripts/start-smallweb-mutagen-sync.sh`
2. Point the remote Smallweb process at `<remote root>/.smallweb-root`.

If `MUTAGEN_DESTINATION` is unset, the helper now tries to derive it from Terraform state via the `ssh_connection` output and defaults the remote root to `/opt/tidelands/smallweb`. That path can be overridden with `MUTAGEN_REMOTE_ROOT`.

The helper also:

- sources `.env` from the repo root by default
- accepts `CLOUDFLARE_API_KEY` as a fallback for `CLOUDFLARE_API_TOKEN`
- defaults `BACKEND_PREFIX_ROOT` to `tidelands-dev`
- generates `~/.ssh/null_hype_render_plan_key(.pub)` automatically when no SSH public key is configured
- prefers repo-local CLI installs in `.tools/bin/`

The generated bundle contains only:

- `.smallweb-root/`
- `dist/`

The accompanying Mutagen config uses one-way replica mode and ignores VCS metadata so the remote path behaves like a deployed mirror, not a collaborative working tree.

For an existing production Smallweb instance, the generated Mutagen config preserves the remote-managed files:

- `.smallweb-root/.smallweb/config.json`
- `.smallweb-root/jules/.env`
- `.smallweb-root/jules/data/`
- `.smallweb-root/linear-agent/.env`
- `.smallweb-root/linear-agent/data/`

## Commands

All commands are run from the project root:

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local Astro dev server |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run smallweb:start` | Start the Smallweb stack locally, including `linear-agent` and `jules` |
| `npm run jules:start` | Alias for `npm run smallweb:start` |
| `npm run agent:start` | Start the legacy standalone Node webhook receiver locally |
| `npm run agent:test` | Run the webhook unit tests |
| `npm run agent:mock-created` | Send a signed local `AgentSessionEvent created` to the webhook server |

## Linear To Jules

The production ingress now lives inside Smallweb:

1. `npm run smallweb:start`
2. Point Linear's webhook URL at `https://linear-agent.tidelands.dev/webhooks/linear`

Required `.env` entries:

- `LINEAR_WEBHOOK_SECRET`
- `LINEAR_OAUTH_ACCESS_TOKEN`
- `JULES_API_KEY`
- `JULES_SOURCE_ID=github/null-hype/null-hype.github.io`
- `JULES_PROXY_URL=http://127.0.0.1:7777`
- `JULES_PROXY_HOST=jules.tidelands.dev`
- `JULES_PROXY_TOKEN=<shared-secret>`

The Mutagen Smallweb bundle already includes both `.smallweb-root/linear-agent/` and `.smallweb-root/jules/`, so the production deploy surface is now the Smallweb root rather than the standalone Node harness.

With the stack running, signed webhook deliveries to `linear-agent.tidelands.dev/webhooks/linear` exercise the same delegation path used by real Linear issue assignment. Successful Jules dispatches are recorded in `.smallweb-root/jules/data/sessions.jsonl`.

## Devcontainer Setup

This repo now includes the devcontainer and MCP setup from `null-hype/null-hype`'s `development` and `codespace-claude-linear-verification-gpv6jvr7pr629j9v` branches.

Set `ANTHROPIC_API_KEY`, `LINEAR_API_KEY`, and `GITHUB_PERSONAL_ACCESS_TOKEN` in your local environment or Codespaces secrets before creating or rebuilding the devcontainer.

Because `.devcontainer/devcontainer.json` maps those values from `${localEnv:...}` into `containerEnv`, changing them usually requires a rebuild or restart of the devcontainer/Codespace to take effect.

## Structure

The site now follows a normal Astro layout:

```
.
├── public/
├── src/
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

`astro.config.mjs` keeps the `SITE` and `BASE_PATH` environment variables for Astro project/user-path builds, while GitHub Actions now publishes Storybook to GitHub Pages.
