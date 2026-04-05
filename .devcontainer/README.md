# Devcontainer

The devcontainer owns the repo operator environment. Local workstation tools are no longer the source of truth for Terraform, Mutagen, Dagger, or gcloud.

## Operator Toolchain

The repo-specific tool bundle is implemented as a local devcontainer feature at [`./features/src/operator-tools`](/workspaces/null-hype.github.io/.devcontainer/features/src/operator-tools/devcontainer-feature.json) and wired into [`devcontainer.json`](/workspaces/null-hype.github.io/.devcontainer/devcontainer.json).

Test the feature with the built-in CLI workflow:

```bash
npm run devcontainer:test-features
```

## Persistent State

The devcontainer now persists these operator state directories in named volumes:

- `/home/vscode/.config/gcloud`
- `/home/vscode/.mutagen`
- `/home/vscode/.terraform.d`
- `/home/vscode/.ssh`

That keeps auth, caches, generated SSH keys, and Mutagen state inside the devcontainer instead of relying on ad hoc host state.

## Day-to-Day Commands

Run these from the repo root inside the devcontainer:

```bash
npm run devcontainer:doctor
npm run worktree:audit
```

If you need extra env files for infra scripts, set `NULL_HYPE_ENV_FILES` to a colon-separated list. This replaces the old hardcoded references to specific worktree paths.
