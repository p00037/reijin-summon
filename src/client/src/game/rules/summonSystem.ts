import { findLeader, getSummonGauge, isUnitAlive, oppositeTeam, setSummonGauge } from "../core/battleState";
import type { BattleConfig, BattleState, ElementalState, SummonedUnitState, TeamId, UnitState } from "../core/types";
import { distance, moveTowards } from "../core/vector";
import { calculateSummonArea, calculateSummonCentroid } from "./areaCalculator";
import { completedElementalsForTeam } from "./elementalSystem";

export function canSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  return (
    findLeader(state, team).currentHp > 0 &&
    getSummonGauge(state, team) >= 1
  );
}

export function tryExecuteSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  if (!canSummon(state, config, team)) {
    return false;
  }

  const leader = findLeader(state, team);
  const enemyLeader = findLeader(state, oppositeTeam(team));
  const elementals = completedElementalsForTeam(state, team);
  const summonPoints = [leader.position, ...elementals.map((elemental) => elemental.position)];
  const area = calculateSummonArea(summonPoints);
  const summonPosition = calculateSummonCentroid(summonPoints, leader.position);
  const battlefieldArea =
    (config.battlefieldMax.x - config.battlefieldMin.x) *
    (config.battlefieldMax.y - config.battlefieldMin.y);
  const fieldPercent = area / battlefieldArea * 100;
  const maxHp = config.summonedUnitBaseHp + config.summonedUnitHpPerFieldPercent * fieldPercent;

  state.summonedUnits.push({
    summonedUnitId: state.nextSummonedUnitId,
    team,
    position: summonPosition,
    destination: { ...enemyLeader.position },
    maxHp,
    currentHp: maxHp,
    attackDamage: config.summonedUnitAttackDamage,
    leaderAttackDamage: config.summonedUnitLeaderAttackDamage,
    attackIntervalSeconds: config.summonedUnitAttackIntervalSeconds,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: config.summonedUnitLeaderAttackIntervalSeconds,
    leaderAttackTimerSeconds: 0,
    moveSpeed: config.summonedUnitMoveSpeed,
    healthDecayPerSecond: config.summonedUnitHealthDecayPerSecond
  });
  state.nextSummonedUnitId += 1;
  setSummonGauge(state, team, 0);
  return true;
}

export function tickSummonGauges(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const team of ["Player", "Cpu"] as const) {
    const hasLivingSummonedUnit = state.summonedUnits.some(
      (summoned) => summoned.team === team && summoned.currentHp > 0
    );
    if (hasLivingSummonedUnit) {
      continue;
    }
    const elementalCount = completedElementalsForTeam(state, team).length;
    if (elementalCount === 0) {
      continue;
    }
    const gaugePerSecond = elementalCount / config.maxElementalsPerTeam / config.summonGaugeSecondsAtMaxElementals;
    setSummonGauge(state, team, Math.min(1, getSummonGauge(state, team) + gaugePerSecond * deltaSeconds));
  }
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
    summoned.attackTimerSeconds = Math.max(0, summoned.attackTimerSeconds - deltaSeconds);
    summoned.leaderAttackTimerSeconds = Math.max(
      0,
      summoned.leaderAttackTimerSeconds - deltaSeconds
    );

    const enemyLeader = findLeader(state, oppositeTeam(summoned.team));
    summoned.destination = { ...enemyLeader.position };
    const touchingLeader = distance(summoned.position, enemyLeader.position) <= config.contactSlowRadius;
    const touchingUnits = enemyUnitsInContact(state, config, summoned);
    const touchingSummonedUnits = enemySummonedUnitsInContact(state, config, summoned);
    const touchingElementals = enemyElementalsInContact(state, config, summoned);
    const touchingNormalTargets =
      touchingUnits.length > 0 ||
      touchingSummonedUnits.length > 0 ||
      touchingElementals.length > 0;
    if (touchingNormalTargets && summoned.attackTimerSeconds <= Number.EPSILON) {
      for (const target of touchingUnits) {
        target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage);
      }
      for (const target of touchingSummonedUnits) {
        target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage);
      }
      for (const target of touchingElementals) {
        target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage);
      }
      summoned.attackTimerSeconds = summoned.attackIntervalSeconds;
    }

    if (touchingLeader && summoned.leaderAttackTimerSeconds <= Number.EPSILON) {
      enemyLeader.currentHp = Math.max(0, enemyLeader.currentHp - summoned.leaderAttackDamage);
      summoned.leaderAttackTimerSeconds = summoned.leaderAttackIntervalSeconds;
    }

    if (!touchingLeader) {
      const speedMultiplier =
        touchingUnits.length > 0 ||
        touchingSummonedUnits.length > 0 ||
        touchingElementals.length > 0
          ? config.contactSlowMultiplier
          : 1;
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

function enemyElementalsInContact(
  state: BattleState,
  config: BattleConfig,
  summoned: SummonedUnitState
): ElementalState[] {
  const enemyTeam = oppositeTeam(summoned.team);
  return state.elementals.filter(
    (elemental) =>
      elemental.team === enemyTeam &&
      elemental.isComplete &&
      elemental.currentHp > 0 &&
      distance(summoned.position, elemental.position) <= config.contactSlowRadius
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
