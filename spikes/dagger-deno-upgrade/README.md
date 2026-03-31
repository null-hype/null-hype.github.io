# Dagger Deno Upgrade Spike

This spike verifies that a modern Dagger TypeScript module can run with the
Deno runtime in this workspace.

## Result

The spike passed with the bundled Dagger CLI at `v0.20.3`.

Command used:

```sh
../../.render/bin/dagger call container-echo --string-arg=deno-spike-ok stdout
```

Observed output included:

```text
deno-spike-ok
```

## What changed versus `infra/`

The working spike differs from the current `infra/` module in a few important
ways:

- `dagger.json` uses `engineVersion: "v0.20.3"` instead of `v0.13.0`
- Dagger generated a bundled `sdk/` directory instead of relying on
  `@dagger.io/dagger` from `node_modules`
- `deno.json` was rewritten with import mappings for `@dagger.io/dagger` and
  Deno compatibility flags
- No `package.json` or `tsconfig.json` is required for the Deno-backed module

## Reproduce

From this directory:

```sh
../../.render/bin/dagger develop -y
../../.render/bin/dagger functions
../../.render/bin/dagger call container-echo --string-arg=deno-spike-ok stdout
```

Note: `sdk/` is generated and ignored by git, so run `dagger develop -y` after
a fresh checkout before calling the module.

## Migration implication

The plausible migration path is not "upgrade the old npm-installed SDK in
place". It is "regenerate `infra/` as a modern Dagger TypeScript module, then
port the existing functions into that generated structure".
