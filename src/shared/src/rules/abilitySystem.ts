import type { BattleConfig, BattleState, UnitState, TimedAbilityEffect } from '../core/types.js';
import { getSummonGauge, isUnitAlive, setSummonGauge } from '../core/battleState.js';
import { getAbilityDefinition } from './abilityCatalog.js';
import { abilityTargets, matchingElemental } from './abilityTargets.js';
import { applyTimedEffect, clearUnitEffects, effectiveAttackDamage, effectiveIntelligence, effectiveMoveSpeed, intelligenceMultiplier, tickUnitEffects } from './abilityEffects.js';
import { enchantElemental, hasActiveSummon, tickEnchantments } from './abilityEnchantments.js';
import { damageUnit } from './combatDamage.js';
export { abilityArea, abilityTargets } from './abilityTargets.js';
export type { AbilityArea, AbilityTargets } from './abilityTargets.js';
export { effectiveAttackDamage } from './abilityEffects.js';
export function abilityApCost(unit: UnitState): number | null {
  return getAbilityDefinition(unit.cardId)?.apCost ?? null;
}
export function resetUnitAbilityState(unit: UnitState): void {
  unit.abilityAp = 0;
  unit.abilityRecoverySeconds = 0;
  clearUnitEffects(unit);
}
function resolveAbilityUse(state: BattleState, config: BattleConfig, unitId: string, facingRotation: number) {
  if (!Number.isFinite(facingRotation) || state.phase !== 'InProgress' || state.result !== 'InProgress')
    return null;
  const unit = state.units.find(u => u.unitId === unitId), def = getAbilityDefinition(unit?.cardId);
  if (!unit || !def || !isUnitAlive(unit) || unit.abilityAp < def.apCost || (def.rainOnly && state.rainRemainingSeconds <= 0))
    return null;
  if (def.effect.kind === 'gauge' && (getSummonGauge(state, unit.team) >= 1 || hasActiveSummon(state, unit.team)))
    return null;
  const targets = abilityTargets(state, config, unit.unitId, facingRotation);
  if (def.target !== 'none' && targets.unitIds.length + targets.elementalIds.length === 0)
    return null;
  return { unit, def, targets };
}
export function canUseAbility(state: BattleState, config: BattleConfig, unitId: string, facingRotation: number): boolean {
  return resolveAbilityUse(state, config, unitId, facingRotation) !== null;
}
export function tryUseAbility(state: BattleState, config: BattleConfig, unitId: string, facingRotation: number, random: () => number = Math.random): boolean {
  const context = resolveAbilityUse(state, config, unitId, facingRotation);
  if (!context)
    return false;
  const { unit, def, targets } = context;
  const ids = def.random ? [targets.unitIds[Math.min(targets.unitIds.length - 1, Math.max(0, Math.floor(random() * targets.unitIds.length)))]] : targets.unitIds;
  const selected = ids.map(id => state.units.find(u => u.unitId === id)!);
  const castId = state.nextAbilityEventId++;
  const casterInt = effectiveIntelligence(unit);
  const add = (target: UnitState, kind: TimedAbilityEffect['kind'], amount: number, duration: number) => applyTimedEffect(target, { abilityId: def.id, sourceUnitId: unit.unitId, castId, kind, amount, remainingSeconds: duration });
  const effect = def.effect;
  switch (effect.kind) {
    case 'timed': {
      const durations = selected.map(target => effect.duration * (effect.intelligenceScaled ? intelligenceMultiplier(casterInt, effectiveIntelligence(target)) : 1));
      selected.forEach((target, i) => effect.modifiers.forEach(m => add(target, m.kind, m.amount, durations[i])));
      break;
    }
    case 'dispel':
      selected.forEach(clearUnitEffects);
      break;
    case 'rain':
      state.rainRemainingSeconds = 100;
      break;
    case 'gauge':
      setSummonGauge(state, unit.team, Math.min(1, getSummonGauge(state, unit.team) + .3));
      break;
    case 'rose': {
      const n = state.elementals.filter(e => matchingElemental(unit, e)).length;
      add(unit, 'speed', 1 + n / 6, 10);
      add(unit, 'defense', Math.max(.7, 1 - .05 * n), 10);
      break;
    }
    case 'wave':
      selected.forEach(target => damageUnit(target, 415 * intelligenceMultiplier(casterInt, effectiveIntelligence(target)), 'ability'));
      break;
    case 'absorb': {
      for (const target of state.units)
        target.abilityEffects = target.abilityEffects.filter(e => !(e.abilityId === def.id && e.sourceUnitId === unit.unitId));
      const target = selected[0], amount = Math.floor(effectiveAttackDamage(target, state, config) / 2);
      add(target, 'attack', -amount, 22);
      add(unit, 'attack', amount, 22);
      break;
    }
    case 'enchant':
      state.elementals.filter(e => targets.elementalIds.includes(e.elementalId)).forEach(e => enchantElemental(e, effect.enchantment));
      break;
  }
  unit.abilityAp = 0;
  unit.abilityRecoverySeconds = 0;
  state.recentAbilityEvents.push({ eventId: castId, sourceUnitId: unit.unitId, abilityId: def.id, targets: selected.map(t => ({ unitId: t.unitId, position: { ...t.position } })) });
  if (state.recentAbilityEvents.length > 128)
    state.recentAbilityEvents.splice(0, state.recentAbilityEvents.length - 128);
  return true;
}
export function effectiveAttackRange(unit: UnitState): number {
  return unit.stats.attackRange;
}
export function effectiveMoveSpeedMultiplier(state: BattleState, config: BattleConfig, unit: UnitState): number {
  return unit.stats.moveSpeed > 0 ? effectiveMoveSpeed(state, config, unit) / unit.stats.moveSpeed : 1;
}
export function tickAbilities(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  if (state.phase !== 'InProgress' || state.result !== 'InProgress' || !Number.isFinite(deltaSeconds))
    return;
  const elapsed = Math.max(0, deltaSeconds);
  state.rainRemainingSeconds = Math.max(0, state.rainRemainingSeconds - elapsed);
  tickEnchantments(state, config, elapsed);
  for (const unit of state.units) {
    if (!isUnitAlive(unit)) {
      resetUnitAbilityState(unit);
      continue;
    }
    tickUnitEffects(unit, elapsed);
    const cap = abilityApCost(unit);
    if (cap === null) {
      unit.abilityAp = 0;
      unit.abilityRecoverySeconds = 0;
      continue;
    }
    const total = unit.abilityRecoverySeconds + elapsed, gained = Math.floor((total + 1e-9) / 20);
    unit.abilityAp = Math.min(cap, unit.abilityAp + gained);
    unit.abilityRecoverySeconds = unit.abilityAp >= cap ? 0 : Math.max(0, total - gained * 20);
  }
}
