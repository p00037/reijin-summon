import { findLeader, getSummonGauge, isUnitAlive, oppositeTeam, setSummonGauge } from "../core/battleState.js";
import type { BattleConfig, BattleState, ElementalState, SummonedUnitState, TeamId, UnitState } from "../core/types.js";
import { moveTowards } from "../core/vector.js";
import { calculateSummonArea, calculateSummonCentroid } from "./areaCalculator.js";
import { areCollisionCirclesTouching } from "./collisionGeometry.js";
import { completedElementalsForTeam } from "./elementalSystem.js";
import { getSummonDefinition } from "../core/summonCatalog.js";
import { damageSummonedUnit } from "./combatDamage.js";
import { applySummonSpecialAttack, summonSpecialSettings } from "./summonAttacks.js";

export function canSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  return summonUnavailableReason(state, config, team) === null;
}

export function summonUnavailableReason(state: BattleState, config: BattleConfig, team: TeamId): string | null {
  if (findLeader(state, team).currentHp <= 0) return "召喚士が倒れています";
  if (state.summonedUnits.some(summon => summon.team === team && summon.currentHp > 0)) return "召喚獣が活動中です";
  if (getSummonGauge(state, team) < 1) return "召喚ゲージをためてください";
  if (summonMaxHp(state, config, team) <= 0) return "魔法陣の面積が必要です";
  return null;
}

function summonMaxHp(state: BattleState, config: BattleConfig, team: TeamId): number {
  const definition = getSummonDefinition(team === "Player" ? state.playerSummonId : state.cpuSummonId);
  const points = [findLeader(state, team).position, ...completedElementalsForTeam(state, team).map(elemental => elemental.position)];
  const battlefieldArea = (config.battlefieldMax.x - config.battlefieldMin.x) * (config.battlefieldMax.y - config.battlefieldMin.y);
  const fieldPercent = battlefieldArea > 0 ? calculateSummonArea(points) / battlefieldArea * 100 : 0;
  return definition.baseHp + config.summonedUnitHpPerFieldPercent * fieldPercent;
}

export function tryExecuteSummon(state: BattleState, config: BattleConfig, team: TeamId): boolean {
  if (!canSummon(state, config, team)) {
    return false;
  }

  const leader = findLeader(state, team);
  const enemyLeader = findLeader(state, oppositeTeam(team));
  const elementals = completedElementalsForTeam(state, team);
  const summonPoints = [leader.position, ...elementals.map((elemental) => elemental.position)];
  const summonPosition = calculateSummonCentroid(summonPoints, leader.position);
  const definition = getSummonDefinition(team === "Player" ? state.playerSummonId : state.cpuSummonId);
  const maxHp = summonMaxHp(state, config, team);
  const specialSettings = definition.id === "jackpot" || definition.id === "yggdrasil" || definition.id === "leviathan"
    ? summonSpecialSettings[definition.id] : null;

  const summoned: SummonedUnitState = {
    summonedUnitId: state.nextSummonedUnitId,
    summonId: definition.id,
    damageMultiplier: definition.damageMultiplier,
    specialAttackTimerSeconds: specialSettings?.interval ?? 0,
    team,
    position: summonPosition,
    destination: { ...enemyLeader.position },
    maxHp,
    currentHp: maxHp,
    attackDamage: definition.attackDamage,
    leaderAttackDamage: definition.leaderAttackDamage,
    attackIntervalSeconds: config.summonedUnitAttackIntervalSeconds,
    attackTimerSeconds: 0,
    leaderAttackIntervalSeconds: definition.leaderAttackIntervalSeconds,
    leaderAttackTimerSeconds: 0,
    moveSpeed: definition.moveSpeed,
    healthDecayPerSecond: config.summonedUnitHealthDecayPerSecond
  };
  state.summonedUnits.push(summoned);
  state.nextSummonedUnitId += 1;
  setSummonGauge(state, team, 0);
  applySummonSpecialAttack(state, config, summoned, true);
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
  deltaSeconds = Math.max(0, deltaSeconds);
  for (const summoned of state.summonedUnits) {
    if (summoned.currentHp <= 0) {
      continue;
    }
    const definition = getSummonDefinition(summoned.summonId);
    const specialSettings = summoned.summonId === "jackpot" || summoned.summonId === "yggdrasil" || summoned.summonId === "leviathan"
      ? summonSpecialSettings[summoned.summonId] : null;
    if (specialSettings) {
      const lifetime = summoned.healthDecayPerSecond > 0 ? summoned.currentHp / summoned.healthDecayPerSecond : Infinity;
      const activeSeconds = Math.min(deltaSeconds, Math.max(0, lifetime - 1e-8));
      summoned.specialAttackTimerSeconds -= activeSeconds;
      while (summoned.specialAttackTimerSeconds <= 1e-10) {
        applySummonSpecialAttack(state, config, summoned, false);
        summoned.specialAttackTimerSeconds += specialSettings.interval;
        if (state.leaders.some(leader => leader.currentHp <= 0)) break;
      }
    }
    summoned.currentHp = Math.max(0, summoned.currentHp - summoned.healthDecayPerSecond * deltaSeconds);
    if (summoned.currentHp <= 0) {
      continue;
    }
    if (definition.attackStyle !== "melee") continue;
    const enemyLeader = findLeader(state, oppositeTeam(summoned.team));
    summoned.destination = { ...enemyLeader.position };
    const touchingLeader = areCollisionCirclesTouching(
      config,
      summoned.position,
      "SummonedUnit",
      enemyLeader.position,
      "Point"
    );
    const touchingUnits = enemyUnitsInContact(state, config, summoned);
    const touchingSummonedUnits = enemySummonedUnitsInContact(state, config, summoned);
    const touchingElementals = enemyElementalsInContact(state, config, summoned);
    const touchingNormalTargets =
      touchingUnits.length > 0 ||
      touchingSummonedUnits.length > 0 ||
      touchingElementals.length > 0;
    const normal = advanceAttackTimer(summoned.attackTimerSeconds, summoned.attackIntervalSeconds, deltaSeconds, touchingNormalTargets);
    const leader = advanceAttackTimer(summoned.leaderAttackTimerSeconds, summoned.leaderAttackIntervalSeconds, deltaSeconds, touchingLeader);
    summoned.attackTimerSeconds = normal.remaining;
    summoned.leaderAttackTimerSeconds = leader.remaining;
    if (normal.count > 0) {
      for (const target of touchingUnits) {
        target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage * normal.count);
      }
      for (const target of touchingSummonedUnits) {
        damageSummonedUnit(target, summoned.attackDamage * normal.count);
      }
      for (const target of touchingElementals) {
        target.currentHp = Math.max(0, target.currentHp - summoned.attackDamage * normal.count);
      }
      state.recentSummonAttackEvents.push({ summonId: summoned.summonId, team: summoned.team, kind: "strike", origin: { ...summoned.position }, targets: [...touchingUnits, ...touchingSummonedUnits, ...touchingElementals].map(target => ({ ...target.position })) });
    }

    if (leader.count > 0) {
      enemyLeader.currentHp = Math.max(0, enemyLeader.currentHp - summoned.leaderAttackDamage * leader.count);
      state.recentSummonAttackEvents.push({ summonId: summoned.summonId, team: summoned.team, kind: "strike", origin: { ...summoned.position }, targets: [{ ...enemyLeader.position }] });
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

function advanceAttackTimer(remaining: number, interval: number, delta: number, hasTarget: boolean): { remaining: number; count: number } {
  if (!hasTarget) return { remaining: Math.max(0, remaining - delta), count: 0 };
  // A newly reached target receives one immediate strike; idle time never banks attacks.
  if (remaining <= 1e-10) return { remaining: interval, count: 1 };
  const next = remaining - delta;
  if (next > 1e-10) return { remaining: next, count: 0 };
  const count = 1 + Math.floor((-next + 1e-10) / interval);
  return { remaining: next + count * interval, count };
}

function enemyUnitsInContact(state: BattleState, config: BattleConfig, summoned: SummonedUnitState): UnitState[] {
  const enemyTeam = oppositeTeam(summoned.team);
  return state.units.filter(
    (unit) =>
      unit.team === enemyTeam &&
      isUnitAlive(unit) &&
      areCollisionCirclesTouching(
        config,
        summoned.position,
        "SummonedUnit",
        unit.position,
        "Unit"
      )
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
      areCollisionCirclesTouching(
        config,
        summoned.position,
        "SummonedUnit",
        elemental.position,
        "Point"
      )
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
      areCollisionCirclesTouching(
        config,
        summoned.position,
        "SummonedUnit",
        candidate.position,
        "SummonedUnit"
      )
  );
}
