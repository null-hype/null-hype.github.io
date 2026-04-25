# Tidelane Infrastructure Runbook

This is an interactive runbook for the Tidelane infrastructure. You can execute these blocks directly in Zed using the REPL (`Ctrl+Shift+Enter`).

## 1. Setup

Ensure you have the Deno Jupyter kernel installed:

```bash
deno jupyter --install
```

## 2. Initialize

Import the infrastructure tasks from the runbook.

```typescript
import { plan, deploy, outputs, verify, destroy } from "./infra/runbook.ts";
```

## 3. Operations

### Plan
Run a non-mutating Terraform plan to see what changes will be applied.

```typescript
await plan();
```

### Deploy
Apply the Terraform changes, build the Astro site, and deploy the Smallweb bundle.

```typescript
await deploy();
```

### Outputs
View the current infrastructure outputs (IP addresses, domains, etc.).

```typescript
await outputs();
```

### Verify
Run external smoke checks against the live domain.

```typescript
await verify();
```

### Destroy
**Warning:** This will tear down the infrastructure for the current slot.

```typescript
await destroy();
```
