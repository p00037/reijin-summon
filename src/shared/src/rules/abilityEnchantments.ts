import type { BattleConfig, BattleState, ElementalState, EnchantmentKind, UnitState } from '../core/types.js';
import { getSummonGauge, isUnitAlive, setSummonGauge } from '../core/battleState.js';
import { distanceSq } from '../core/vector.js';
import { getAbilityDefinition } from './abilityCatalog.js';

export function enchantElemental(elemental: ElementalState, kind: EnchantmentKind): void {
  const enchantments = elemental.enchantments ??= [];
  if (!enchantments.some(enchantment => enchantment.kind === kind)) {
    enchantments.push({ kind, elapsedSeconds: 0 });
  }
}

function auraRadius(config: BattleConfig, kind: EnchantmentKind): number {
  const cardId = { speed: 'SC003', gauge: 'SC014', shell: 'SC019' }[kind];
  const effect = getAbilityDefinition(cardId)!.effect;
  return effect.kind === 'enchant'
    ? effect.auraRadiusWorld ?? (effect.auraRadiusHeight ?? 0) * config.unitCardWorldHeight
    : 0;
}

function inAura(elemental: ElementalState, unit: UnitState, config: BattleConfig, kind: EnchantmentKind): boolean {
  return elemental.isComplete && elemental.currentHp > 0
    && (elemental.enchantments ?? []).some(enchantment => enchantment.kind === kind)
    && distanceSq(elemental.position, unit.position) <= auraRadius(config, kind) ** 2 + 1e-9;
}

export function elementalSpeedBonus(state: BattleState, config: BattleConfig, unit: UnitState): number {
  const hasAura = state.elementals.some(elemental => elemental.team === unit.team && inAura(elemental, unit, config, 'speed'));
  return hasAura ? config.statsByType.Melee.moveSpeed * 0.5 : 0;
}

export function elementalAttackPenalty(state: BattleState, config: BattleConfig, unit: UnitState): number {
  return state.elementals.filter(elemental => elemental.team !== unit.team && inAura(elemental, unit, config, 'shell')).length * 11;
}

export function hasActiveSummon(state: BattleState, team: UnitState['team']): boolean {
  return state.summonedUnits.some(summon => summon.team === team && summon.currentHp > 0);
}

export function tickEnchantments(state: BattleState, config: BattleConfig, seconds: number): void {
  for (const elemental of state.elementals) {
    if (!elemental.isComplete || elemental.currentHp <= 0) continue;
    const enchantment = elemental.enchantments?.find(candidate => candidate.kind === 'gauge');
    if (!enchantment) continue;
    const total = enchantment.elapsedSeconds + seconds;
    const periods = Math.floor((total + 1e-9) / 20);
    enchantment.elapsedSeconds = Math.max(0, total - periods * 20);
    if (periods === 0 || hasActiveSummon(state, elemental.team)) continue;
    const count = state.units.filter(unit => isUnitAlive(unit) && unit.team === elemental.team && inAura(elemental, unit, config, 'gauge')).length;
    const gauge = getSummonGauge(state, elemental.team) + periods * count * 0.05;
    setSummonGauge(state, elemental.team, Math.min(1, gauge));
  }
}
