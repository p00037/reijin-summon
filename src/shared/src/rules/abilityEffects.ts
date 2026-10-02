import type { BattleConfig, BattleState, TimedAbilityEffect, UnitState } from '../core/types.js';
import { elementalAttackPenalty, elementalSpeedBonus } from './abilityEnchantments.js';

export function intelligenceMultiplier(casterInt: number, targetInt: number): number {
  return Math.max(0.1, 1 + 0.1 * (casterInt - targetInt));
}

export function effectiveIntelligence(unit: UnitState): number {
  return unit.baseIntelligence + sumEffects(unit, 'intelligence');
}

export function applyTimedEffect(unit: UnitState, effect: TimedAbilityEffect): void {
  if (effect.abilityId !== 'SC018') {
    unit.abilityEffects = unit.abilityEffects.filter(existing => {
      const sameEffect = existing.abilityId === effect.abilityId && existing.kind === effect.kind;
      const sameAbsorption = effect.abilityId !== 'SC016' || existing.sourceUnitId === effect.sourceUnitId;
      return !(sameEffect && sameAbsorption);
    });
  }
  unit.abilityEffects.push({ ...effect });
}

export function clearUnitEffects(unit: UnitState): void {
  unit.abilityEffects = [];
}

export function tickUnitEffects(unit: UnitState, seconds: number): void {
  for (const effect of unit.abilityEffects) {
    effect.remainingSeconds -= seconds;
  }
  unit.abilityEffects = unit.abilityEffects.filter(effect => effect.remainingSeconds > 1e-9);
}

export function effectiveAttackDamage(unit: UnitState, state?: BattleState, config?: BattleConfig): number {
  const auraPenalty = state && config ? elementalAttackPenalty(state, config, unit) : 0;
  return Math.max(0, unit.stats.attackDamage + sumEffects(unit, 'attack') - auraPenalty);
}

export function effectiveMoveSpeed(state: BattleState, config: BattleConfig, unit: UnitState): number {
  const bonus = elementalSpeedBonus(state, config, unit);
  return (unit.stats.moveSpeed + bonus) * multiplyEffects(unit, 'speed');
}

export function unitDamageMultiplier(unit: UnitState): number {
  return multiplyEffects(unit, 'defense');
}

function sumEffects(unit: UnitState, kind: TimedAbilityEffect['kind']): number {
  return unit.abilityEffects.filter(effect => effect.kind === kind).reduce((sum, effect) => sum + effect.amount, 0);
}

function multiplyEffects(unit: UnitState, kind: TimedAbilityEffect['kind']): number {
  return unit.abilityEffects.filter(effect => effect.kind === kind).reduce((product, effect) => product * effect.amount, 1);
}
