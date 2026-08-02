import { findLeader, findUnit, isUnitAlive, oppositeTeam } from "../core/battleState";
import type {
  BattleCommand,
  BattleConfig,
  BattleState,
  ElementalState,
  LeaderState,
  SummonedUnitState,
  UnitId,
  UnitState,
  Vec2
} from "../core/types";
import { clampVec2, distanceSq, moveTowards } from "../core/vector";
import { areCollisionCirclesTouching } from "./collisionGeometry";

type MoveUnitCommand = Extract<BattleCommand, { commandType: "MoveUnit" }>;

type AttackTarget =
  | { kind: "Unit"; position: Vec2; target: UnitState }
  | { kind: "Elemental"; position: Vec2; target: ElementalState }
  | { kind: "SummonedUnit"; position: Vec2; target: SummonedUnitState }
  | { kind: "Leader"; position: Vec2; target: LeaderState };

export type UnitMovementTimeline = {
  initialPosition: Vec2;
  finalPosition: Vec2;
  activeStartSeconds: number;
  activeSeconds: number;
  movementSeconds: number;
};

export type UnitHealingElapsed = {
  leaderAreaSeconds: number;
  leaderEndsInArea: boolean;
  restSeconds: number;
  restEndsStopped: boolean;
  resetTimersBeforeHealing: boolean;
};

export function applyMoveCommand(state: BattleState, config: BattleConfig, command: MoveUnitCommand): void {
  const unit = findUnit(state, command.unitId);
  if (unit.team !== command.team || !isUnitAlive(unit)) {
    return;
  }
  if (unit.mode === "BuildingElemental") {
    unit.mode = "Active";
    unit.buildTimerSeconds = 0;
    unit.pendingElementalId = null;
  }
  resetUnitHealingTimers(unit);
  unit.destination = clampVec2(command.targetPosition, config.battlefieldMin, config.battlefieldMax);
}

export function tickMovement(
  state: BattleState,
  config: BattleConfig,
  deltaSeconds: number,
  activityStartSecondsByUnit: ReadonlyMap<UnitId, number> = new Map()
): ReadonlyMap<UnitId, UnitMovementTimeline> {
  const timelines = new Map<UnitId, UnitMovementTimeline>();
  for (const unit of state.units) {
    if (unit.mode !== "Active" || !isUnitAlive(unit)) {
      continue;
    }
    const activeStartSeconds = Math.min(deltaSeconds, Math.max(0, activityStartSecondsByUnit.get(unit.unitId) ?? 0));
    const activeSeconds = Math.max(0, deltaSeconds - activeStartSeconds);
    const initialPosition = { ...unit.position };
    const speedMultiplier = hasEnemyContact(state, config, unit) ? config.contactSlowMultiplier : 1;
    const moveSpeed = unit.stats.moveSpeed * speedMultiplier;
    const targetDistance = Math.sqrt(distanceSq(unit.position, unit.destination));
    const movementSeconds = moveSpeed > 0 ? Math.min(activeSeconds, targetDistance / moveSpeed) : 0;
    unit.position = moveTowards(unit.position, unit.destination, moveSpeed * activeSeconds);
    timelines.set(unit.unitId, {
      initialPosition,
      finalPosition: { ...unit.position },
      activeStartSeconds,
      activeSeconds,
      movementSeconds
    });
  }
  return timelines;
}

export function tickCombat(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  state.recentAttackEvents = [];

  for (const unit of state.units) {
    if (unit.mode !== "Defeated" && unit.currentHp <= 0) {
      defeatUnit(unit, config);
    }
  }

  for (const unit of state.units) {
    if (unit.mode !== "Active" || !isUnitAlive(unit)) {
      continue;
    }
    unit.attackTimerSeconds = Math.max(0, unit.attackTimerSeconds - deltaSeconds);
    unit.leaderAttackTimerSeconds = Math.max(0, unit.leaderAttackTimerSeconds - deltaSeconds);
    if (!canAttack(state, config, unit)) {
      continue;
    }

    const target = findAttackTarget(state, unit);
    if (!target) {
      continue;
    }

    const attackTimerSeconds = target.kind === "Leader" ? unit.leaderAttackTimerSeconds : unit.attackTimerSeconds;
    if (attackTimerSeconds > Number.EPSILON) {
      continue;
    }

    const damage =
      target.kind === "Elemental"
        ? unit.stats.attackDamage * unit.stats.elementalAttackMultiplier
        : unit.stats.attackDamage;
    applyDamage(target, damage, config);
    state.recentAttackEvents.push({
      attackerUnitId: unit.unitId,
      origin: { ...unit.position },
      targetPosition: { ...target.position }
    });
    if (target.kind === "Leader") {
      unit.leaderAttackTimerSeconds = config.unitLeaderAttackIntervalSeconds;
    } else {
      unit.attackTimerSeconds = unit.stats.attackIntervalSeconds;
    }
  }

  for (const unit of state.units) {
    if (unit.mode !== "Defeated" && unit.currentHp <= 0) {
      defeatUnit(unit, config);
    }
  }
}

function canAttack(state: BattleState, config: BattleConfig, unit: UnitState): boolean {
  if (unit.unitType !== "Ranged") {
    return true;
  }
  const isStopped = distanceSq(unit.position, unit.destination) <= Number.EPSILON;
  return isStopped || hasEnemyContact(state, config, unit);
}

export function tickUnitHealing(
  state: BattleState,
  config: BattleConfig,
  deltaSeconds: number,
  elapsedByUnit: ReadonlyMap<UnitId, UnitHealingElapsed> = new Map()
): void {
  const healingRadiusSq = config.leaderHealingRadius * config.leaderHealingRadius;
  for (const unit of state.units) {
    if (unit.mode !== "Active" || !isUnitAlive(unit)) {
      resetUnitHealingTimers(unit);
      continue;
    }
    const elapsed = elapsedByUnit.get(unit.unitId);
    if (elapsed?.resetTimersBeforeHealing) {
      resetUnitHealingTimers(unit);
    }
    const leader = findLeader(state, unit.team);
    const leaderEndsInArea = elapsed?.leaderEndsInArea ?? distanceSq(unit.position, leader.position) <= healingRadiusSq;
    const leaderAreaSeconds = elapsed?.leaderAreaSeconds ?? (leaderEndsInArea ? deltaSeconds : 0);
    if (leaderAreaSeconds > 0) {
      const { count, remainder } = elapsedIntervals(
        unit.leaderHealingElapsedSeconds + leaderAreaSeconds,
        config.leaderHealingIntervalSeconds
      );
      unit.leaderHealingElapsedSeconds = remainder;
      healUnit(unit, count * unit.stats.maxHp * config.leaderHealingPercent);
    }
    if (!leaderEndsInArea) {
      unit.leaderHealingElapsedSeconds = 0;
    }

    const isStopped = distanceSq(unit.position, unit.destination) <= Number.EPSILON;
    const restEndsStopped = elapsed?.restEndsStopped ?? (unit.unitType === "Melee" && isStopped);
    const restSeconds = elapsed?.restSeconds ?? (restEndsStopped ? deltaSeconds : 0);
    if (restSeconds > 0) {
      const { count, remainder } = elapsedIntervals(
        unit.restHealingElapsedSeconds + restSeconds,
        config.keeperRestHealingIntervalSeconds
      );
      unit.restHealingElapsedSeconds = remainder;
      healUnit(unit, count * config.keeperRestHealingAmount);
    }
    if (!restEndsStopped) {
      unit.restHealingElapsedSeconds = 0;
    }
  }
}

export function calculateUnitHealingElapsed(
  state: BattleState,
  config: BattleConfig,
  timelines: ReadonlyMap<UnitId, UnitMovementTimeline>
): ReadonlyMap<UnitId, UnitHealingElapsed> {
  const elapsedByUnit = new Map<UnitId, UnitHealingElapsed>();
  for (const unit of state.units) {
    const timeline = timelines.get(unit.unitId);
    if (!timeline || timeline.activeSeconds <= 0) {
      elapsedByUnit.set(unit.unitId, {
        leaderAreaSeconds: 0,
        leaderEndsInArea: false,
        restSeconds: 0,
        restEndsStopped: false,
        resetTimersBeforeHealing: Boolean(timeline && timeline.activeStartSeconds > 0)
      });
      continue;
    }

    const leader = findLeader(state, unit.team);
    const leaderEndsInArea = distanceSq(timeline.finalPosition, leader.position) <= config.leaderHealingRadius * config.leaderHealingRadius;
    const stoppedSeconds = Math.max(0, timeline.activeSeconds - timeline.movementSeconds);
    const leaderAreaSeconds =
      secondsWithinRadius(timeline.initialPosition, timeline.finalPosition, timeline.movementSeconds, leader.position, config.leaderHealingRadius) +
      (leaderEndsInArea ? stoppedSeconds : 0);
    elapsedByUnit.set(unit.unitId, {
      leaderAreaSeconds,
      leaderEndsInArea,
      restSeconds: unit.unitType === "Melee" ? stoppedSeconds : 0,
      restEndsStopped: unit.unitType === "Melee" && stoppedSeconds > 0,
      resetTimersBeforeHealing: timeline.activeStartSeconds > 0
    });
  }
  return elapsedByUnit;
}

export function tickRespawns(state: BattleState, deltaSeconds: number): void {
  for (const unit of state.units) {
    if (unit.mode !== "Defeated") {
      continue;
    }
    unit.respawnTimerSeconds = Math.max(0, unit.respawnTimerSeconds - deltaSeconds);
    if (unit.respawnTimerSeconds > 0) {
      continue;
    }
    unit.mode = "Active";
    unit.currentHp = unit.stats.maxHp;
    unit.position = { ...unit.spawnPosition };
    unit.destination = { ...unit.spawnPosition };
    unit.attackTimerSeconds = 0;
    unit.leaderAttackTimerSeconds = 0;
    resetUnitHealingTimers(unit);
    unit.buildTimerSeconds = 0;
    unit.pendingElementalId = null;
  }
}

function hasEnemyContact(state: BattleState, config: BattleConfig, unit: UnitState): boolean {
  const enemyTeam = oppositeTeam(unit.team);
  return (
    state.units.some(
      (candidate) =>
        candidate.team === enemyTeam &&
        candidate.unitId !== unit.unitId &&
        isUnitAlive(candidate) &&
        areCollisionCirclesTouching(config, unit.position, "Unit", candidate.position, "Unit")
    ) ||
    state.summonedUnits.some(
      (candidate) =>
        candidate.team === enemyTeam &&
        candidate.currentHp > 0 &&
        areCollisionCirclesTouching(config, unit.position, "Unit", candidate.position, "SummonedUnit")
    ) ||
    state.elementals.some(
      (candidate) =>
        candidate.team === enemyTeam &&
        candidate.currentHp > 0 &&
        areCollisionCirclesTouching(config, unit.position, "Unit", candidate.position, "Point")
    )
  );
}

function findAttackTarget(state: BattleState, attacker: UnitState): AttackTarget | null {
  const enemyTeam = oppositeTeam(attacker.team);
  const rangeSq = attacker.stats.attackRange * attacker.stats.attackRange;
  const enemyLeader = findLeader(state, enemyTeam);
  const targets: AttackTarget[] = [
    ...state.units
      .filter((unit) => unit.team === enemyTeam && isUnitAlive(unit))
      .map((unit): AttackTarget => ({ kind: "Unit", position: unit.position, target: unit })),
    ...state.elementals
      .filter((elemental) => elemental.team === enemyTeam && elemental.currentHp > 0)
      .map((elemental): AttackTarget => ({ kind: "Elemental", position: elemental.position, target: elemental })),
    ...state.summonedUnits
      .filter((summonedUnit) => summonedUnit.team === enemyTeam && summonedUnit.currentHp > 0)
      .map((summonedUnit): AttackTarget => ({
        kind: "SummonedUnit",
        position: summonedUnit.position,
        target: summonedUnit
      })),
    { kind: "Leader", position: enemyLeader.position, target: enemyLeader }
  ];

  return nearestInRange(attacker.position, targets, rangeSq);
}

function nearestInRange(position: Vec2, targets: AttackTarget[], rangeSq: number): AttackTarget | null {
  let nearest: AttackTarget | null = null;
  let nearestDistanceSq = Infinity;
  for (const target of targets) {
    const targetDistanceSq = distanceSq(position, target.position);
    if (targetDistanceSq <= rangeSq && targetDistanceSq < nearestDistanceSq) {
      nearest = target;
      nearestDistanceSq = targetDistanceSq;
    }
  }
  return nearest;
}

function secondsWithinRadius(
  start: Vec2,
  end: Vec2,
  durationSeconds: number,
  center: Vec2,
  radius: number
): number {
  if (durationSeconds <= 0) {
    return 0;
  }
  const directionX = end.x - start.x;
  const directionY = end.y - start.y;
  const fromCenterX = start.x - center.x;
  const fromCenterY = start.y - center.y;
  const directionLengthSq = directionX * directionX + directionY * directionY;
  if (directionLengthSq <= Number.EPSILON) {
    return distanceSq(start, center) <= radius * radius ? durationSeconds : 0;
  }
  const projection = fromCenterX * directionX + fromCenterY * directionY;
  const discriminant = projection * projection - directionLengthSq * (distanceSq(start, center) - radius * radius);
  if (discriminant < 0) {
    return 0;
  }
  const root = Math.sqrt(discriminant);
  const entry = Math.max(0, Math.min(1, (-projection - root) / directionLengthSq));
  const exit = Math.max(0, Math.min(1, (-projection + root) / directionLengthSq));
  return Math.max(0, exit - entry) * durationSeconds;
}

function applyDamage(target: AttackTarget, damage: number, config: BattleConfig): void {
  if (target.kind === "Leader") {
    target.target.currentHp = Math.max(0, target.target.currentHp - damage * config.directLeaderDamageMultiplier);
    return;
  }
  target.target.currentHp = Math.max(0, target.target.currentHp - damage);
}

function defeatUnit(unit: UnitState, config: BattleConfig): void {
  unit.mode = "Defeated";
  unit.currentHp = 0;
  unit.respawnTimerSeconds = config.unitRespawnSeconds;
  resetUnitHealingTimers(unit);
  unit.buildTimerSeconds = 0;
  unit.pendingElementalId = null;
}

function elapsedIntervals(elapsed: number, interval: number): { count: number; remainder: number } {
  const count = Math.floor((elapsed + Number.EPSILON) / interval);
  return { count, remainder: Math.max(0, elapsed - count * interval) };
}

function healUnit(unit: UnitState, amount: number): void {
  unit.currentHp = Math.min(unit.stats.maxHp, unit.currentHp + amount);
}

function resetUnitHealingTimers(unit: UnitState): void {
  unit.leaderHealingElapsedSeconds = 0;
  unit.restHealingElapsedSeconds = 0;
}
