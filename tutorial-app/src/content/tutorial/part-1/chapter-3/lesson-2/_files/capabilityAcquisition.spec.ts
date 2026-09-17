// Vendored from tutorial-app/src/lib/capabilityAcquisition.spec.ts -- this
// is the exact spec `npm test` below runs, in this exact WebContainer,
// against the exact pkl/Ledger.pkl, pkl/Inventory.pkl and
// worker/flight_booking_area51.pkl files in the tree to the left.
import { describe, expect, it } from 'vitest';
import type { Grant } from './grant_state.pkl';
import { requirement } from './declaredRequirement';
import { observed, observedVaultNames } from './observedInventory';
import { checkAccess } from './ledgerCheckAccess';
import { missingItems } from './inventoryCheck';

/**
 * Two real, separate axioms govern whether a task can get what it needs:
 * pkl/Inventory.pkl's missingItems() (declared vs. observed inventory) and
 * pkl/Ledger.pkl's checkAccess() (supervisor approval). They fail for
 * different reasons, and only one of those reasons is yours to fix.
 *
 * `declaredRequirement.ts` is the one file this scenario asks you to edit.
 * Its value here is correct; the lesson's `_files/declaredRequirement.ts`
 * starts with the stale value instead, so `missingItems` fails until it's
 * corrected -- the same drift `.dagger/internal/devenv-base/pkl/Vaults.pkl`'s
 * own header comment documents really happened ("claude" moved from vault
 * "tidelands.dev" to vault "anthropic.ai" directly in Proton Pass, no
 * commit recording it). `observedInventory.ts` is read-only, same as real
 * observed state is never hand-edited.
 *
 * Every literal value below is copied from a real committed Pkl fixture,
 * not invented for this test:
 *   - the drift scenario: Inventory.test.pkl's `staleDeclaration`/
 *     `correctedDeclaration`/`driftObserved` -- `pkl test
 *     pkl/Inventory.test.pkl` really passes both facts.
 *   - `observedVaultNames`: Vaults.test.pkl-expected.pcf's own "observed
 *     vault names" golden snapshot, copied verbatim.
 *   - `fact`/`vault` and the "approved" grant: worker/flight_booking_area51.pkl
 *     and GrantState.pkl's `flight-booking:area51:vault-access` entry --
 *     `pkl test worker/flight_booking_area51.pkl` really passes.
 *
 * GrantState.pkl is git-ignored and re-rendered by every local
 * `go run .`/`go test ./...` in capability-spike/ (see its own header
 * comment) -- this value is copied from a real `supervisor.Decide` run
 * captured once, not re-read from that file live, since it isn't meant to
 * persist between runs.
 */
describe('a stale declaration is a bug you can fix yourself', () => {
  it('1. the declaration is checked against real observed inventory', () => {
    expect(missingItems(requirement, observed)).toEqual([]);
  });

  it('2. observed state carries more than any one declaration accounts for -- that is expected, not a bug', () => {
    // "api.linear.app" has no VaultSpec in Vaults.pkl at all. Per that
    // file's own header: "This is a decision, not a transcription of
    // `pass-cli vault list` output." This is the examples{}/.pkl-expected.pcf
    // golden-snapshot step's TypeScript equivalent -- a value you accept
    // by committing it, not a pass/fail assertion you make hold.
    expect(observedVaultNames).toMatchInlineSnapshot(`
      [
        "anthropic.ai",
        "api.linear.app",
        "infra",
        "jingling057",
        "test",
        "tidelands.dev",
      ]
    `);
  });
});

describe('access is a different axiom -- you cannot fix this one yourself', () => {
  const fact = 'flight-booking:area51:vault-access';
  const vault = 'thepentagon.com';
  const grantsByFactId = new Map<string, Grant>();

  it('3. no grant recorded yet -- denied, with a specific diagnostic', () => {
    expect(checkAccess(fact, vault, grantsByFactId)?.code).toBe('CAP_NO_GRANT');
  });

  it('4. only a real supervisor decision clears it', () => {
    // GrantState.pkl's own entry, not invented for this test.
    grantsByFactId.set(fact, { factID: fact, vault, approved: true });
    expect(checkAccess(fact, vault, grantsByFactId)).toBeNull();
  });
});
