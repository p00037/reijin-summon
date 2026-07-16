import { findLeader, getSummonCooldown, isUnitAlive, oppositeTeam, setSummonCooldown } from "../core/battleState";
import type { BattleConfig, BattleState, SummonedUnitState, TeamId, UnitState } from "../core/types";
import { distance, moveTowards } from "../core/vector";
import { calculateSummonArea } from "./areaCalculator";
import { completedElementalsForTeam } from "./elementalSystem";

export function canSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  return (
    findLeader(state, team).currentHp > 0 &&
    getSummonCooldown(state, team) === 0 &&
    completedElementalsForTeam(state, team).length >= config.requiredElementalsToSummon
  );
}

export function tryExecuteSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  if (!canSummon(state, config, team)) {
    return false;
  }

  const leader = findLeader(state, team);
  const enemyLeader = findLeader(state, oppositeTeam(team));
  const elementals = completedElementalsForTeam(state, team);
  const area = calculateSummonArea([leader.position, ...elementals.map((elemental) => elemental.position)]);
  const meleeStats = config.statsByType.Melee;
  const hpMultiplier = Math.min(
    config.summonedUnitMaxHpMultiplier,
    Math.max(config.summonedUnitMinHpMultiplier, config.summonedUnitMinHpMultiplier + area * config.summonedUnitHpPerAreaMultiplier)
  );
  const maxHp = meleeStats.maxHp * hpMultiplier;

  state.summonedUnits.push({
    summonedUnitId: state.nextSummonedUnitId,
    team,
    position: { ...leader.position },
    destination: { ...enemyLeader.position },
    maxHp,
    currentHp: maxHp,
    attackDamage: meleeStats.attackDamage * config.summonedUnitAttackDamageMultiplier,
    moveSpeed: meleeStats.moveSpeed,
    healthDecayPerSecond: meleeStats.maxHp * config.summonedUnitMinHpMultiplier * config.summonedUnitHealthDecayMinimumHpFactorPerSecond
  });
  state.nextSummonedUnitId += 1;
  setSummonCooldown(state, team, config.summonCooldownSeconds);
  return true;
}

export function tickSummonCooldowns(state: BattleState, deltaSeconds: number): void {
  state.playerSummonCooldownSeconds = Math.max(0, state.playerSummonCooldownSeconds - deltaSeconds);
  state.cpuSummonCooldownSeconds = Math.max(0, state.cpuSummonCooldownSeconds - deltaSeconds);
}

export function tickSummonedUnits(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const summoned of state.summonedUnits) {
    if (summoned.currentHp <= 0) {
      continue;
    }
    summoned.currentHp = Math.max(0, summoned.currentHp - summoned.healthDecayPerSecond * deltaSeconds);
    if (summoned.currentHp <= 0) {
      continue;
    }

    const enemyLeader = findLeader(state, oppositeTeam(summoned.team));
    summoned.destination = { ...enemyLeader.position };
    const touchingLeader = distance(summoned.position, enemyLeader.position) <= config.contactSlowRadius;
    const touchingUnits = enemyUnitsInContact(state, config, summoned);
    const touchingSummonedUnits = enemySummonedUnitsInContact(state, config, summoned);
    for (const target of touchingUnits) {
      target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage * deltaSeconds);
    }
    for (const target of touchingSummonedUnits) {
      target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage * deltaSeconds);
    }

    if (touchingLeader) {
      enemyLeader.currentHp = Math.max(0, enemyLeader.currentHp - summoned.attackDamage * deltaSeconds);
    } else {
      const speedMultiplier = touchingUnits.length > 0 || touchingSummonedUnits.length > 0 ? config.contactSlowMultiplier : 1;
      summoned.position = moveTowards(summoned.position, summoned.destination, summoned.moveSpeed * speedMultiplier * deltaSeconds);
    }
  }
  state.summonedUnits = state.summonedUnits.filter((summoned) => summoned.currentHp > 0);
}

function enemyUnitsInContact(state: BattleState, config: BattleConfig, summoned: SummonedUnitState): UnitState[] {
  const enemyTeam = oppositeTeam(summoned.team);
  return state.units.filter(
    (unit) => unit.team === enemyTeam && isUnitAlive(unit) && distance(summoned.position, unit.position) <= config.contactSlowRadius
  );
}

function enemySummonedUnitsInContact(
  state: BattleState,
  config: BattleConfig,
  summoned: SummonedUnitState
): SummonedUnitState[] {
  const enemyTeam = oppositeTeam(summoned.team);
  return state.summonedUnits.filter(
    (candidate) =>
      candidate.team === enemyTeam &&
      candidate.summonedUnitId !== summoned.summonedUnitId &&
      candidate.currentHp > 0 &&
      distance(summoned.position, candidate.position) <= config.contactSlowRadius
  );
}
