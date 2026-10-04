import type { BattleState, SummonedUnitState, UnitState, UnitId } from "../core/types.js";
import { unitDamageMultiplier } from './abilityEffects.js';

export function damageUnit(target: UnitState, amount: number, kind: 'normal' | 'summon' | 'ability', state?: BattleState, sourceUnitId: UnitId | null = null): void {
  if (target.currentHp <= 0 || target.mode === 'Defeated') return;
  target.currentHp = Math.max(0, target.currentHp - Math.max(0, amount) * (kind === 'ability' ? 1 : unitDamageMultiplier(target, state)));
  if (target.currentHp === 0) target.lethalSourceUnitId = sourceUnitId;
}

export function damageSummonedUnit(target: SummonedUnitState, damage: number): void {
  target.currentHp = Math.max(0, target.currentHp - damage * target.damageMultiplier);
}
