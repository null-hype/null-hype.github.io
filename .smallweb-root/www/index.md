---
title: Tidelands Smallweb
---

# Tidelands Smallweb

This Smallweb workspace now exposes two intentional surfaces:

- `https://tidelands.dev/` via the `www` app
- `https://admin.tidelands.dev/` via the private `admin` app

The admin app is protected by Smallweb OIDC and keeps `/healthz` and `/readyz` public for smoke checks and load balancers.

You can find more information about Smallweb at [smallweb.run](https://smallweb.run).
