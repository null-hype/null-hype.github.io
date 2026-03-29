# null-hype.github.io

Plain Astro site for the `null-hype.github.io` Pages deployment.

## Render PR Pipeline

This repo includes a dedicated Render service for PR-scoped Dagger module checks.

`render.yaml` defines the base Render service:

- Service name: `null-hype-dagger-pr-check`
- Branch: `plan-188` for the current stacked-branch setup, then back to `master` after merge
- Runtime: Node
- Preview generation: manual
- Preview trigger: add the GitHub label `render-preview` to a PR
- Auto deploy on branch commits: off

The preview service is intended to exercise the Dagger module itself, not to run
Terraform against live infrastructure.

Required environment for preview checks:

- Remote Dagger engine: `SSH_PRIVATE_KEY`, `REMOTE_DOCKER_SSH_TARGET`

Local bootstrap order for the current Render setup:

1. Run the long-lived infra provisioner locally with `deploy`, not `check`.
2. SSH to the created VM and run [`infra/scripts/bootstrap-docker-engine.sh`](/workspaces/null-hype.github.io/infra/scripts/bootstrap-docker-engine.sh).
3. Set `REMOTE_DOCKER_SSH_TARGET` in Render to that host, for example `smallweb@203.0.113.10`.
4. Redeploy the Render service so Dagger uses the remote Docker engine over SSH.
5. Render previews run `dagger check --src=infra`, which installs module dependencies, builds the TypeScript module, and runs a tiny Node smoke test so the logs show an explicit passing test.

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
