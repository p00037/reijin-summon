import type { SummonedUnitState, UnitState } from "../core/types.js";
import { unitDamageMultiplier } from './abilityEffects.js';

export function damageUnit(target: UnitState, amount: number, kind: 'normal' | 'summon' | 'ability'): void {
  target.currentHp = Math.max(0, target.currentHp - Math.max(0, amount) * (kind === 'ability' ? 1 : unitDamageMultiplier(target)));
}

export function damageSummonedUnit(target: SummonedUnitState, damage: number): void {
  target.currentHp = Math.max(0, target.currentHp - damage * target.damageMultiplier);
}
