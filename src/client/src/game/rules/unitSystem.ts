import { findLeader, findUnit, isUnitAlive, oppositeTeam } from "../core/battleState";
import type {
  BattleCommand,
  BattleConfig,
  BattleState,
  ElementalState,
  LeaderState,
  SummonedUnitState,
  UnitState,
  Vec2
} from "../core/types";
import { clampVec2, distanceSq, moveTowards } from "../core/vector";

type MoveUnitCommand = Extract<BattleCommand, { commandType: "MoveUnit" }>;

type AttackTarget =
  | { kind: "Unit"; position: Vec2; target: UnitState }
  | { kind: "Elemental"; position: Vec2; target: ElementalState }
  | { kind: "SummonedUnit"; position: Vec2; target: SummonedUnitState }
  | { kind: "Leader"; position: Vec2; target: LeaderState };

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
  unit.destination = clampVec2(command.targetPosition, config.battlefieldMin, config.battlefieldMax);
}

export function tickMovement(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  for (const unit of state.units) {
    if (unit.mode !== "Active" || !isUnitAlive(unit)) {
      continue;
    }
    const speedMultiplier = hasEnemyContact(state, config, unit) ? config.contactSlowMultiplier : 1;
    unit.position = moveTowards(unit.position, unit.destination, unit.stats.moveSpeed * speedMultiplier * deltaSeconds);
  }
}

export function tickCombat(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
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
    if (unit.attackTimerSeconds > 0) {
      continue;
    }

    const target = findAttackTarget(state, unit);
    if (!target) {
      continue;
    }

    applyDamage(target, unit.stats.attackDamage, config);
    state.recentAttackEvents.push({
      attackerUnitId: unit.unitId,
      origin: { ...unit.position },
      targetPosition: { ...target.position }
    });
    unit.attackTimerSeconds = unit.stats.attackIntervalSeconds;
  }

  for (const unit of state.units) {
    if (unit.mode !== "Defeated" && unit.currentHp <= 0) {
      defeatUnit(unit, config);
    }
  }
}

export function tickLeaderHealing(state: BattleState, config: BattleConfig, deltaSeconds: number): void {
  const healingRadiusSq = config.leaderHealingRadius * config.leaderHealingRadius;
  for (const unit of state.units) {
    if (!isUnitAlive(unit)) {
      continue;
    }
    const leader = findLeader(state, unit.team);
    if (distanceSq(unit.position, leader.position) > healingRadiusSq) {
      continue;
    }
    unit.currentHp = Math.min(unit.stats.maxHp, unit.currentHp + unit.stats.attackDamage * deltaSeconds);
  }
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
    unit.buildTimerSeconds = 0;
    unit.pendingElementalId = null;
  }
}

function hasEnemyContact(state: BattleState, config: BattleConfig, unit: UnitState): boolean {
  const enemyTeam = oppositeTeam(unit.team);
  const contactRadiusSq = config.contactSlowRadius * config.contactSlowRadius;
  return (
    state.units.some(
      (candidate) =>
        candidate.team === enemyTeam &&
        candidate.unitId !== unit.unitId &&
        isUnitAlive(candidate) &&
        distanceSq(unit.position, candidate.position) <= contactRadiusSq
    ) ||
    state.summonedUnits.some(
      (candidate) =>
        candidate.team === enemyTeam && candidate.currentHp > 0 && distanceSq(unit.position, candidate.position) <= contactRadiusSq
    )
  );
}

function findAttackTarget(state: BattleState, attacker: UnitState): AttackTarget | null {
  const enemyTeam = oppositeTeam(attacker.team);
  const rangeSq = attacker.stats.attackRange * attacker.stats.attackRange;
  const groups: AttackTarget[][] = [
    state.units
      .filter((unit) => unit.team === enemyTeam && isUnitAlive(unit))
      .map((unit) => ({ kind: "Unit", position: unit.position, target: unit })),
    state.elementals
      .filter((elemental) => elemental.team === enemyTeam && elemental.currentHp > 0)
      .map((elemental) => ({ kind: "Elemental", position: elemental.position, target: elemental })),
    state.summonedUnits
      .filter((summonedUnit) => summonedUnit.team === enemyTeam && summonedUnit.currentHp > 0)
      .map((summonedUnit) => ({ kind: "SummonedUnit", position: summonedUnit.position, target: summonedUnit })),
    [{ kind: "Leader", position: findLeader(state, enemyTeam).position, target: findLeader(state, enemyTeam) }]
  ];

  for (const group of groups) {
    const nearest = nearestInRange(attacker.position, group, rangeSq);
    if (nearest) {
      return nearest;
    }
  }
  return null;
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
  unit.buildTimerSeconds = 0;
  unit.pendingElementalId = null;
}
