import { findLeader, isUnitAlive, oppositeTeam } from '../core/battleState.js';
import type { BattleConfig, BattleState, UnitState } from '../core/types.js';
import { getSkillDefinition } from './skillCatalog.js';

export function skillModifiers(unit: UnitState, state?: BattleState, config?: BattleConfig) {
  const result = { attack: 0, speed: 1, defense: 1, range: 0, active: false };
  const effect = getSkillDefinition(unit.cardId)?.effect;
  if (!effect || !isUnitAlive(unit) || (state && (state.phase !== 'InProgress' || state.result !== 'InProgress'))) return result;
  switch (effect.kind) {
    case 'apPower':
      result.attack = effect.attackPerAp * unit.abilityAp;
      // カード描画の横幅/高さは51.52/92＝0.56。
      result.range = effect.rangeWidthsPerAp * unit.abilityAp * (config?.unitCardWorldHeight ?? 2.25) * .56;
      result.active = unit.abilityAp > 0;
      break;
    case 'healing':
      result.active = true;
      break;
    case 'lateDefense':
      if (state && state.remainingSeconds <= effect.seconds) {
        result.defense = effect.multiplier;
        result.active = true;
      }
      break;
    case 'earlyAttack':
      if (state && state.remainingSeconds >= effect.seconds) { result.attack = effect.attack; result.active = true; }
      break;
    case 'leaderDamage': {
      if (!state) break;
      const leader = findLeader(state, unit.team);
      const ratio = leader.currentHp / leader.maxHp;
      const stage = ratio <= .25 ? 3 : ratio <= .5 ? 2 : ratio <= .75 ? 1 : 0;
      result.attack = stage * effect.attackPerStage;
      result.speed = stage >= 2 ? effect.speedMultiplier : 1;
      result.active = stage > 0;
      break;
    }
    case 'enemyHalf': {
      const center = config ? (config.battlefieldMin.y + config.battlefieldMax.y) / 2 : 0;
      if (state && (unit.team === 'Player' ? unit.position.y > center : unit.position.y < center)) {
        result.attack = effect.attack; result.active = true;
      }
      break;
    }
    case 'lowHpAttack':
      if (unit.currentHp <= unit.stats.maxHp * effect.hpRatio) { result.attack = effect.attack; result.active = true; }
      break;
    case 'enemyLeaderHp': {
      if (!state) break;
      const leader = findLeader(state, oppositeTeam(unit.team));
      if (leader.currentHp <= leader.maxHp * effect.hpRatio) { result.attack = effect.attack; result.active = true; }
      break;
    }
    case 'rain':
      if (state && state.rainRemainingSeconds > 0) { result.attack = effect.attack; result.speed = effect.speedMultiplier; result.active = true; }
      break;
  }
  return result;
}

export function healUnit(unit: UnitState, amount: number): number {
  if (!isUnitAlive(unit)) return 0;
  const effect = getSkillDefinition(unit.cardId)?.effect;
  const multiplier = effect?.kind === 'healing' ? effect.multiplier : 1;
  const previousHp = unit.currentHp;
  unit.currentHp = Math.min(unit.stats.maxHp, previousHp + Math.max(0, amount) * multiplier);
  return unit.currentHp - previousHp;
}
