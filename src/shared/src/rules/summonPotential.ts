import { findLeader, getMpState, isUnitAlive, oppositeTeam, setMpState } from '../core/battleState.js';
import { summonPotentialSettings as settings } from '../core/summonPotentialCatalog.js';
import type { BattleConfig, BattleState, SummonedUnitState, TeamId, TimedAbilityEffect, UnitState, Vec2 } from '../core/types.js';
import { applyTimedEffect } from './abilityEffects.js';
import { abilityApCost } from './abilitySystem.js';
import { damageSummonedUnit, damageUnit } from './combatDamage.js';
import { restoreUnit } from './resurrectionSystem.js';
import { healUnit } from './skillEffects.js';

export function isSummonPotentialReady(state: BattleState, team: TeamId): boolean {
  const leader = findLeader(state, team);
  return state.phase === 'InProgress' && state.result === 'InProgress'
    && leader.currentHp > 0 && leader.currentHp <= leader.maxHp * settings.leaderHpRatio;
}

function eligible(unit: UnitState): boolean {
  return isUnitAlive(unit) && (unit.potentialProtectionSeconds ?? 0) <= 1e-9;
}

function addEffect(unit: UnitState, summon: SummonedUnitState, kind: TimedAbilityEffect['kind'], amount: number, seconds: number): void {
  applyTimedEffect(unit, {
    abilityId: `potential:${summon.summonId}`, sourceUnitId: '',
    sourceSummonedUnitId: summon.summonedUnitId, sourcePosition: { ...summon.position },
    castId: summon.summonedUnitId, kind, amount, remainingSeconds: seconds
  });
}

export function applySummonPotential(state: BattleState, config: BattleConfig, summon: SummonedUnitState): void {
  if (!isSummonPotentialReady(state, summon.team) || summon.potentialActive) return;
  summon.potentialActive = true;
  // 召喚時の対象を固定し、同じ発動で復活した仲間への二重適用を防ぐ。
  const allies = state.units.filter(unit => unit.team === summon.team && eligible(unit));
  const enemies = state.units.filter(unit => unit.team !== summon.team && eligible(unit));
  const defeated = state.units.filter(unit => unit.team === summon.team && unit.mode === 'Defeated');
  const enemySummons = state.summonedUnits.filter(unit => unit.team !== summon.team && unit.currentHp > 0);
  const points: Vec2[] = [];
  const revive = (hpRatio: number, halfAp: boolean) => {
    for (const unit of defeated) {
      restoreUnit(unit, findLeader(state, summon.team).position);
      unit.currentHp = unit.stats.maxHp * hpRatio;
      unit.abilityAp = halfAp ? Math.floor((abilityApCost(unit) ?? 0) / 2) : 0;
      points.push({ ...unit.position });
    }
  };
  switch (summon.summonId) {
    case 'raphael':
      allies.forEach(unit => healUnit(unit, settings.raphael.heal));
      points.push(...allies.map(unit => ({ ...unit.position })));
      revive(settings.raphael.revivedHpRatio, true);
      break;
    case 'jackpot':
      for (const unit of enemies) {
        damageUnit(unit, settings.jackpot.unitDamage, 'ability', state);
        unit.abilityAp = 0;
        unit.abilityRecoverySeconds = 0;
      }
      enemySummons.forEach(unit => damageSummonedUnit(unit, settings.jackpot.summonDamage));
      points.push(...[...enemies, ...enemySummons].map(unit => ({ ...unit.position })));
      break;
    case 'yggdrasil': {
      for (const unit of allies) {
        unit.abilityAp = abilityApCost(unit) ?? 0;
        unit.abilityRecoverySeconds = 0;
      }
      const mp = getMpState(state, summon.team);
      const current = Math.min(config.maxMp, mp.current + settings.yggdrasil.mp);
      setMpState(state, summon.team, current, current >= config.maxMp ? 0 : mp.recoveryProgress,
        current >= config.maxMp ? 0 : mp.leaderDamageProgress);
      summon.potentialTargets = enemies.map(unit => ({ unitId: unit.unitId }));
      points.push(...allies.map(unit => ({ ...unit.position })));
      break;
    }
    case 'leviathan': {
      const effect = settings.leviathan;
      for (const unit of allies) {
        addEffect(unit, summon, 'attack', effect.attack, effect.seconds);
        addEffect(unit, summon, 'speed', effect.speedMultiplier, effect.seconds);
        addEffect(unit, summon, 'defense', effect.defenseMultiplier, effect.seconds);
      }
      summon.potentialRemainingSeconds = effect.seconds;
      summon.attackDamage += effect.attack;
      summon.moveSpeed *= effect.speedMultiplier;
      summon.damageMultiplier *= effect.defenseMultiplier;
      enemies.forEach(unit => damageUnit(unit, effect.unitDamage, 'ability', state));
      enemySummons.forEach(unit => damageSummonedUnit(unit, effect.summonDamage));
      const leader = findLeader(state, oppositeTeam(summon.team));
      leader.currentHp = Math.max(0, leader.currentHp - effect.leaderDamage);
      points.push(...[...allies, ...enemies, ...enemySummons, leader].map(unit => ({ ...unit.position })));
      break;
    }
    case 'bahamut':
      summon.attackDamage += settings.bahamut.attack;
      enemies.forEach(unit => addEffect(unit, summon, 'pull', settings.bahamut.pullSpeed, settings.bahamut.pullSeconds));
      points.push(...enemies.map(unit => ({ ...unit.position })));
      break;
    case 'dullahan':
      enemies.forEach(unit => addEffect(unit, summon, 'attack', settings.dullahan.attack, settings.dullahan.seconds));
      points.push(...enemies.map(unit => ({ ...unit.position })));
      revive(1, false);
      break;
  }
  state.recentSummonPotentialEvents.push({
    eventId: state.nextSummonPotentialEventId++, summonedUnitId: summon.summonedUnitId,
    summonId: summon.summonId, team: summon.team, origin: { ...summon.position }, targets: points
  });
  if (state.recentSummonPotentialEvents.length > 128)
    state.recentSummonPotentialEvents.splice(0, state.recentSummonPotentialEvents.length - 128);
}

export function applyYggdrasilPotentialSlow(state: BattleState, summon: SummonedUnitState): void {
  if (!summon.potentialActive) return;
  for (const target of summon.potentialTargets ?? []) {
    const unit = state.units.find(candidate => candidate.unitId === target.unitId);
    if (unit && eligible(unit))
      addEffect(unit, summon, 'speed', settings.yggdrasil.slowMultiplier, settings.yggdrasil.slowSeconds);
  }
}

export function tickSummonPotential(summon: SummonedUnitState, seconds: number): void {
  if (summon.summonId !== 'leviathan') return;
  if ((summon.potentialRemainingSeconds ?? 0) <= 0) return;
  summon.potentialRemainingSeconds = Math.max(0, summon.potentialRemainingSeconds! - seconds);
  if (summon.potentialRemainingSeconds > 1e-9) return;
  summon.potentialRemainingSeconds = 0;
  summon.attackDamage -= settings.leviathan.attack;
  summon.moveSpeed /= settings.leviathan.speedMultiplier;
  summon.damageMultiplier /= settings.leviathan.defenseMultiplier;
}

export function potentialPull(state: BattleState, unit: UnitState): { destination: Vec2; speed: number } | null {
  const pull = unit.abilityEffects.find(effect => effect.kind === 'pull' && effect.remainingSeconds > 1e-9);
  if (!pull) return null;
  const summon = state.summonedUnits.find(candidate => candidate.summonedUnitId === pull.sourceSummonedUnitId && candidate.currentHp > 0);
  if (summon) pull.sourcePosition = { ...summon.position };
  return pull.sourcePosition ? { destination: pull.sourcePosition, speed: pull.amount } : null;
}

export function rememberPotentialSourcePositions(state: BattleState): void {
  for (const unit of state.units) {
    for (const effect of unit.abilityEffects) {
      if (effect.kind !== 'pull') continue;
      const summon = state.summonedUnits.find(candidate => candidate.summonedUnitId === effect.sourceSummonedUnitId);
      // 生成中の対象も更新し、消滅する本体を除去する前に最終位置を保存する。
      if (summon) effect.sourcePosition = { ...summon.position };
    }
  }
}

export function potentialMpRecoveryMultiplier(state: BattleState, team: TeamId): number {
  return state.summonedUnits.some(summon => summon.team === team && summon.summonId === 'yggdrasil'
    && summon.currentHp > 0 && summon.potentialActive) ? settings.yggdrasil.mpRecoveryMultiplier : 1;
}
