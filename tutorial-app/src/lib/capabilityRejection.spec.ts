import { describe, expect, it } from 'vitest';
import type { Grant } from './grant_state.pkl';
import type { ObservedInventory, VaultSpec } from './inventory.pkl';
import { checkAccess } from './ledgerCheckAccess';
import { missingItems } from './inventoryCheck';

/**
 * The mirror image of capabilityAcquisition.spec.ts's scenario: same cycle,
 * same two axioms, but the supervisor's answer is no. A rejection isn't a
 * slower version of an approval -- it's a different terminal state, and
 * this file walks the same four steps to show where it actually diverges.
 *
 * Every literal value below is copied from a real committed Pkl fixture,
 * not invented for this test:
 *   - `fact`/`vault` and the "rejected" grant: worker/area51_site4.pkl and
 *     GrantState.pkl's `area51:site4:black-budget-vault-access` entry --
 *     `pkl test worker/area51_site4.pkl` really fails with CAP_REJECTED.
 *   - `requirement`: the same VaultSpec shape Inventory.test.pkl validates
 *     missingItems() against.
 *
 * GrantState.pkl is git-ignored and re-rendered by every local
 * `go run .`/`go test ./...` in capability-spike/ (see its own header
 * comment) -- this value is copied from a real `supervisor.Decide` run
 * captured once, not re-read from that file live, since it isn't meant to
 * persist between runs.
 */
describe('when the supervisor says no', () => {
  const fact = 'area51:site4:black-budget-vault-access';
  const vault = 'site4.internal';
  const requirement: VaultSpec = { name: vault, items: ['black-budget-vault-access'] };
  const notYetObserved: ObservedInventory = { vaults: [{ name: vault, items: [] }] };

  const grantsByFactId = new Map<string, Grant>();

  it('1. a task declares what it needs, using Inventory.pkl\'s VaultSpec shape', () => {
    expect(requirement).toEqual({ name: 'site4.internal', items: ['black-budget-vault-access'] });
  });

  it('2. the fact fails against the available inventory -- nothing has been requested yet', () => {
    expect(missingItems(requirement, notYetObserved)).toEqual(['black-budget-vault-access']);
    expect(checkAccess(fact, vault, grantsByFactId)?.code).toBe('CAP_NO_GRANT');
  });

  it('3. requesting the capability gets a real supervisor decision -- rejected', () => {
    // GrantState.pkl's own entry for this factID, not invented for this test.
    grantsByFactId.set(fact, { factID: fact, vault, approved: false });

    expect(checkAccess(fact, vault, grantsByFactId)?.code).toBe('CAP_REJECTED');
  });

  it('4. refreshing observed state changes nothing -- this is refused, not pending', () => {
    // Unlike an approved grant, there is no materialization step waiting to
    // happen. Re-running the same checks after a "refresh" produces the
    // exact same verdicts, because there is nothing left to resolve.
    expect(checkAccess(fact, vault, grantsByFactId)?.code).toBe('CAP_REJECTED');
    expect(missingItems(requirement, notYetObserved)).toEqual(['black-budget-vault-access']);
  });
});
