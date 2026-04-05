# null-hype.github.io

Plain Astro site for the `null-hype.github.io` Pages deployment.

## Render PR Pipeline

This repo includes a dedicated Render service for PR-scoped Dagger plans.

`render.yaml` defines the base Render service:

- Service name: `null-hype-dagger-pr-plan`
- Branch: `plan-197` for the current stacked-branch setup, then back to `master` after merge
- Runtime: Node
- Preview generation: manual
- Preview trigger: add the GitHub label `render-preview` to a PR
- Auto deploy on branch commits: off

Required environment depends on the selected Dagger function:

- `plan`: `CLOUDFLARE_API_TOKEN`, `SSH_PUBLIC_KEY`, `BACKEND_BUCKET`, `GCP_PROJECT`, `CLOUDFLARE_ZONE_ID`, and either `BACKEND_PREFIX` or `BACKEND_PREFIX_ROOT`
- Optional deploy-shape env: `DEPLOYMENT_SLOT`, `MANAGE_DIRECT_DNS_RECORDS`, `GCP_ZONE`, `DOMAIN`, `INSTANCE_NAME`
- Remote Dagger engine: `SSH_PRIVATE_KEY`, `REMOTE_DOCKER_SSH_TARGET`

Local bootstrap order for the current Render setup:

1. Run the long-lived infra provisioner locally with `deploy`, not `check`.
2. SSH to the created VM and run [`infra/scripts/bootstrap-docker-engine.sh`](/workspaces/null-hype.github.io/infra/scripts/bootstrap-docker-engine.sh).
3. Set `REMOTE_DOCKER_SSH_TARGET` in Render to that host, for example `smallweb@203.0.113.10`.
4. Redeploy the Render service so Dagger uses the remote Docker engine over SSH.

## Quick Mutagen Deploy

For a first quick-and-dirty Smallweb deploy, the Dagger module now exports a Mutagen-ready artifact set:

1. Build the site and generate the sync bundle:
   `ADMIN_AUTHORIZED_EMAILS='you@example.com' MUTAGEN_DESTINATION='smallweb@203.0.113.10:/opt/tidelands/smallweb' ./infra/scripts/start-smallweb-mutagen-sync.sh`
2. Point the remote Smallweb process at `<remote root>/.smallweb-root`.

The generated bundle contains only:

- `.smallweb-root/`
- `dist/`

The accompanying Mutagen config uses one-way replica mode and ignores VCS metadata so the remote path behaves like a deployed mirror, not a collaborative working tree.

Run this from inside the devcontainer after `npm run devcontainer:doctor`. If you need a local override env file, export `NULL_HYPE_ENV_FILES=path/to/local.env`.

## Commands

All commands are run from the project root:

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local Astro dev server |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Preview the production build locally |

## Devcontainer Setup

This repo now includes the devcontainer and MCP setup from `null-hype/null-hype`'s `development` and `codespace-claude-linear-verification-gpv6jvr7pr629j9v` branches.

Set `ANTHROPIC_API_KEY`, `LINEAR_API_KEY`, and `GITHUB_PERSONAL_ACCESS_TOKEN` in your local environment or Codespaces secrets before creating or rebuilding the devcontainer.

Because `.devcontainer/devcontainer.json` maps those values from `${localEnv:...}` into `containerEnv`, changing them usually requires a rebuild or restart of the devcontainer/Codespace to take effect.

The repo-specific operator toolchain now lives in a local feature at [`.devcontainer/features/src/operator-tools`](/workspaces/null-hype.github.io/.devcontainer/features/src/operator-tools/devcontainer-feature.json). It installs Terraform, Dagger, Mutagen, gcloud, jq, and SSH client tools, while persistent state now lives in named devcontainer volumes for:

- `~/.config/gcloud`
- `~/.mutagen`
- `~/.terraform.d`
- `~/.ssh`

Useful commands:

| Command | Action |
| :--- | :--- |
| `npm run devcontainer:doctor` | Verify the operator toolchain and state directories inside the devcontainer |
| `npm run devcontainer:test-features` | Run the built-in `@devcontainers/cli` tests for the local `operator-tools` feature |
| `npm run worktree:audit` | Inventory registered worktrees, show clean/dirty state, and highlight in-repo worktrees |

Additional details live in [`.devcontainer/README.md`](/workspaces/null-hype.github.io/.devcontainer/README.md).

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
