---
type: chapter
title: CI Evidence & Capability Decisions
---

This chapter is built from real exported evidence and real capability-spike code, not scripted examples: CIT-147's exporter turns one GitHub Actions run plus its restic snapshots into a browsable lesson (lesson 1). CIT-147 slice 2 and CIT-148 turn capability-spike's real acquire-the-capability cycle into two model-driven lessons, both built on the same two real axioms -- `Inventory.pkl`'s `missingItems()` (declared vs. observed inventory) and `Ledger.pkl`'s `checkAccess()` (supervisor approval) -- generated to TypeScript, wrapped by a shared `axioms.ts` registry, and exercised through a `toHaveVerdict` custom matcher that records every check, pass or fail, to `evaluations.jsonl`. Lesson 2 asks the reader to fix a stale declaration and then act as the supervisor -- Solve-as-supervisor writes the same grant-state file a real `supervisor.Decide` call would -- while lesson 3 walks the same axioms for a request the supervisor rejects, where refreshing observed state resolves nothing because there was never a grant to materialize.
