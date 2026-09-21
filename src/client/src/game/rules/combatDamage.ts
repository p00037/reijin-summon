import type { SummonedUnitState } from "../core/types";

export function damageSummonedUnit(target: SummonedUnitState, damage: number): void {
  target.currentHp = Math.max(0, target.currentHp - damage * target.damageMultiplier);
}
