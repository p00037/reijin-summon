import { findLeader, isUnitAlive, oppositeTeam } from "../core/battleState.js";
import type { BattleConfig, BattleState, SummonedUnitState, Vec2 } from "../core/types.js";
import { damageSummonedUnit } from "./combatDamage.js";
import { getSummonBeam, isCircleInBeam } from "./summonGeometry.js";

// Approved provisional values; see the summon selection design document.
export const summonSpecialSettings = {
  jackpot: { initialDamage: 300, interval: 0.5 },
  yggdrasil: { elementalInitialDamage: 10, interval: 1.5 },
  leviathan: { initialDamage: 100, periodicDamage: 20, interval: 5 }
} as const;

export function applySummonSpecialAttack(
  state: BattleState, config: BattleConfig, summoned: SummonedUnitState, initial: boolean
): void {
  if (summoned.summonId === "jackpot") {
    applyBeamAttack(state, config, summoned, initial);
  } else if (summoned.summonId === "yggdrasil") {
    applyGlobalAttack(state, summoned, summoned.attackDamage, summoned.leaderAttackDamage, "roots");
    if (initial) {
      for (const elemental of state.elementals) {
        if (elemental.team !== summoned.team && elemental.isComplete && elemental.currentHp > 0) {
          elemental.currentHp = Math.max(0, elemental.currentHp - summonSpecialSettings.yggdrasil.elementalInitialDamage);
        }
      }
    }
  } else if (summoned.summonId === "leviathan") {
    const settings = summonSpecialSettings.leviathan;
    const damage = initial ? settings.initialDamage : settings.periodicDamage;
    applyGlobalAttack(state, summoned, damage, damage, "wave");
  }
}

function applyGlobalAttack(
  state: BattleState, summoned: SummonedUnitState, damage: number, leaderDamage: number, kind: "roots" | "wave"
): void {
  const targets: Vec2[] = [];
  for (const unit of state.units) {
    if (unit.team !== summoned.team && isUnitAlive(unit)) {
      unit.currentHp = Math.max(0, unit.currentHp - damage);
      targets.push({ ...unit.position });
    }
  }
  for (const target of state.summonedUnits) {
    if (target.team !== summoned.team && target.currentHp > 0) {
      damageSummonedUnit(target, damage);
      targets.push({ ...target.position });
    }
  }
  const leader = findLeader(state, oppositeTeam(summoned.team));
  if (leader.currentHp > 0) {
    leader.currentHp = Math.max(0, leader.currentHp - leaderDamage);
    targets.push({ ...leader.position });
  }
  state.recentSummonAttackEvents.push({ summonId: summoned.summonId, team: summoned.team, origin: { ...summoned.position }, targets, kind });
}

function applyBeamAttack(state: BattleState, config: BattleConfig, summoned: SummonedUnitState, initial: boolean): void {
  const beam = getSummonBeam(summoned, state, config);
  const damage = initial ? summonSpecialSettings.jackpot.initialDamage : summoned.attackDamage;
  for (const unit of state.units) {
    if (isUnitAlive(unit) && isCircleInBeam(unit.position, config.unitCollisionRadius, beam)) {
      unit.currentHp = Math.max(0, unit.currentHp - damage);
    }
  }
  for (const target of state.summonedUnits) {
    if (target.team !== summoned.team && target.currentHp > 0 && isCircleInBeam(target.position, config.summonedUnitCollisionRadius, beam)) {
      damageSummonedUnit(target, damage);
    }
  }
  const leader = findLeader(state, oppositeTeam(summoned.team));
  leader.currentHp = Math.max(0, leader.currentHp - (initial ? summonSpecialSettings.jackpot.initialDamage : summoned.leaderAttackDamage));
  const ownLeader = findLeader(state, summoned.team);
  if (!initial && isCircleInBeam(ownLeader.position, 0, beam)) {
    ownLeader.currentHp = Math.max(0, ownLeader.currentHp - summoned.leaderAttackDamage);
  }
}
