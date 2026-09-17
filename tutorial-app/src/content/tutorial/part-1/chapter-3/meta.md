---
type: chapter
title: CI Evidence & Capability Decisions
---

This chapter is built from real exported evidence and real capability-spike code, not scripted examples: CIT-147's exporter turns one GitHub Actions run plus its restic snapshots into a browsable lesson (lesson 1). CIT-147 slice 2 turns capability-spike's real acquire-the-capability cycle into two model-driven lessons, both built on the same two real axioms -- `Inventory.pkl`'s `missingItems()` (declared vs. observed inventory) and `Ledger.pkl`'s `checkAccess()` (supervisor approval) -- generated to TypeScript and exercised by a real `vitest` run TutorialKit executes in the lesson's own terminal: lesson 2 walks a request the supervisor approves, and lesson 3 walks the same four steps for a request the supervisor rejects, where refreshing observed state resolves nothing because there was never a grant to materialize.
