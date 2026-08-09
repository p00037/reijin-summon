import type { BattleConfig, BattleState, UnitState, UnitType } from "../core/types";
import { isUnitAlive } from "../core/battleState";

const apCostByType: Record<UnitType, number> = { Melee: 2, Speed: 3, Ranged: 2 };
const secondsPerAp = 20;
const maxAbilityAp = 2;

export function abilityApCost(unitType: UnitType): number {
  return apCostByType[unitType];
}

export function resetUnitAbilityState(unit: UnitState): void {
  unit.abilityAp = 0;
  unit.abilityRecoverySeconds = 0;
  unit.masterRangeBoostRemainingSeconds = 0;
  unit.seekerAttackBoostRemainingSeconds = 0;
}

export function tickAbilities(state: BattleState, _config: BattleConfig, deltaSeconds: number): void {
  if (state.phase !== "InProgress") {
    return;
  }

  const elapsedSeconds = Math.max(0, deltaSeconds);
  for (const unit of state.units) {
    if (unit.team !== "Player" || !isUnitAlive(unit) || unit.abilityAp >= maxAbilityAp) {
      continue;
    }
    const total = unit.abilityRecoverySeconds + elapsedSeconds;
    const gainedAp = Math.floor(total / secondsPerAp);
    unit.abilityAp = Math.min(maxAbilityAp, unit.abilityAp + gainedAp);
    unit.abilityRecoverySeconds = unit.abilityAp >= maxAbilityAp ? 0 : total - gainedAp * secondsPerAp;
  }
}
