import type { Grant } from './grant_state.pkl';
import type { ObservedInventory, VaultSpec } from './inventory.pkl';
import { checkAccess } from './ledgerCheckAccess';
import { missingItems } from './inventoryCheck';

export interface Verdict {
  code: string;
  message: string;
}

export type AxiomId = 'ledger.checkAccess' | 'inventory.missingItems';

export interface LedgerWorld {
  vault: string;
  grantsByFactId: ReadonlyMap<string, Grant>;
}

export interface InventoryWorld {
  requirement: VaultSpec;
  observed: ObservedInventory;
}

/**
 * checkAccess/missingItems stay plain functions, validated on their own
 * terms; this registry only normalizes their output to a uniform
 * {code, message} so toHaveVerdict can compare a verdict code without
 * special-casing a thrown-and-caught axiom against a returned-array one.
 */
export const axioms: Record<AxiomId, (fact: string, world: any) => Verdict> = {
  'ledger.checkAccess': (fact, world: LedgerWorld) => {
    const denial = checkAccess(fact, world.vault, world.grantsByFactId);
    return denial ?? { code: 'PASS', message: 'access granted for this fact and vault' };
  },
  'inventory.missingItems': (fact, world: InventoryWorld) => {
    const missing = missingItems(world.requirement, world.observed);
    return missing.length === 0
      ? { code: 'PASS', message: 'all declared items are present in observed inventory' }
      : { code: 'INV_MISSING', message: `missing from vault "${world.requirement.name}": ${missing.join(', ')}` };
  },
};
