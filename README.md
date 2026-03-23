# null-hype.github.io

Plain Astro site for the `null-hype.github.io` Pages deployment.

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

`astro.config.mjs` keeps the `SITE` and `BASE_PATH` environment variables so the existing GitHub Pages workflow can build correctly for project or user pages.
