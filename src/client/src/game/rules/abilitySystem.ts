import type {
  BattleConfig,
  BattleState,
  ElementalId,
  UnitId,
  UnitState,
  UnitType,
  Vec2
} from "../core/types";
import { findUnit, isUnitAlive } from "../core/battleState";
import { distanceSq } from "../core/vector";

const apCostByType: Record<UnitType, number> = { Melee: 2, Speed: 3, Ranged: 2 };
const secondsPerAp = 20;
const masterRangeBoostSeconds = 20;
const seekerAttackBoostSeconds = 15;

export type AbilityArea = { center: Vec2; radius: number };
export type AbilityTargets = { unitIds: UnitId[]; elementalIds: ElementalId[] };
type AbilityUseContext = { unit: UnitState; targets: AbilityTargets };

export function abilityApCost(unitType: UnitType): number {
  return apCostByType[unitType];
}

export function resetUnitAbilityState(unit: UnitState): void {
  unit.abilityAp = 0;
  unit.abilityRecoverySeconds = 0;
  unit.masterRangeBoostRemainingSeconds = 0;
  unit.seekerAttackBoostRemainingSeconds = 0;
}

export function abilityArea(
  state: BattleState,
  config: BattleConfig,
  unitId: UnitId,
  facingRotation = 0
): AbilityArea | null {
  const unit = findUnit(state, unitId);
  if (unit.unitType === "Ranged") {
    return null;
  }
  if (unit.unitType === "Speed") {
    return { center: { ...unit.position }, radius: config.unitCardWorldHeight * 1.5 };
  }
  const height = config.unitCardWorldHeight;
  if (unit.team !== "Player") {
    return {
      center: { x: unit.position.x, y: unit.position.y + height },
      radius: height / 2
    };
  }
  return {
    center: {
      x: unit.position.x - Math.sin(facingRotation) * height,
      y: unit.position.y + Math.cos(facingRotation) * height
    },
    radius: height / 2
  };
}

export function abilityTargets(
  state: BattleState,
  config: BattleConfig,
  unitId: UnitId,
  facingRotation = 0
): AbilityTargets {
  const unit = findUnit(state, unitId);
  const area = abilityArea(state, config, unitId, facingRotation);
  if (!area) {
    return { unitIds: [], elementalIds: [] };
  }
  const radiusSq = area.radius * area.radius;
  if (unit.unitType === "Speed") {
    return {
      unitIds: state.units
        .filter((candidate) => candidate.team === unit.team && isUnitAlive(candidate) && distanceSq(candidate.position, area.center) <= radiusSq)
        .map((candidate) => candidate.unitId),
      elementalIds: []
    };
  }
  return {
    unitIds: [],
    elementalIds: state.elementals
      .filter(
        (elemental) =>
          elemental.team === unit.team &&
          elemental.isComplete &&
          elemental.currentHp > 0 &&
          distanceSq(elemental.position, area.center) <= radiusSq
      )
      .map((elemental) => elemental.elementalId)
  };
}

export function canUseAbility(state: BattleState, config: BattleConfig, unitId: string, facingRotation = 0): boolean {
  return resolveAbilityUse(state, config, unitId, facingRotation) !== null;
}

export function tryUseAbility(state: BattleState, config: BattleConfig, unitId: string, facingRotation = 0): boolean {
  const context = resolveAbilityUse(state, config, unitId, facingRotation);
  if (!context) {
    return false;
  }
  const { unit, targets } = context;
  if (unit.unitType === "Ranged") {
    unit.masterRangeBoostRemainingSeconds = masterRangeBoostSeconds;
  } else if (unit.unitType === "Speed") {
    for (const targetUnitId of targets.unitIds) {
      findUnit(state, targetUnitId).seekerAttackBoostRemainingSeconds = seekerAttackBoostSeconds;
    }
  } else {
    const targetIds = new Set(targets.elementalIds);
    for (const elemental of state.elementals) {
      if (targetIds.has(elemental.elementalId)) {
        elemental.hasKeeperSpeedAura = true;
      }
    }
  }
  unit.abilityAp = 0;
  unit.abilityRecoverySeconds = 0;
  return true;
}

function resolveAbilityUse(
  state: BattleState,
  config: BattleConfig,
  unitId: string,
  facingRotation: number
): AbilityUseContext | null {
  if (!Number.isFinite(facingRotation)) {
    return null;
  }
  if (state.result !== "InProgress" || state.phase !== "InProgress") {
    return null;
  }
  const unit = state.units.find((candidate) => candidate.unitId === unitId);
  if (!unit || unit.team !== "Player" || !isUnitAlive(unit) || unit.abilityAp < abilityApCost(unit.unitType)) {
    return null;
  }
  const targets = abilityTargets(state, config, unit.unitId, facingRotation);
  if (unit.unitType !== "Ranged" && targets.unitIds.length === 0 && targets.elementalIds.length === 0) {
    return null;
  }
  return { unit, targets };
}

export function effectiveAttackRange(unit: UnitState): number {
  return unit.stats.attackRange * (unit.masterRangeBoostRemainingSeconds > 0 ? 1.5 : 1);
}

export function effectiveAttackDamage(unit: UnitState): number {
  return unit.stats.attackDamage + (unit.seekerAttackBoostRemainingSeconds > 0 ? 10 : 0);
}

export function effectiveMoveSpeedMultiplier(state: BattleState, config: BattleConfig, unit: UnitState): number {
  if (!isUnitAlive(unit)) {
    return 1;
  }
  const radiusSq = (config.unitCardWorldHeight * 1.5) ** 2;
  return state.elementals.some(
    (elemental) =>
      elemental.team === unit.team &&
      elemental.isComplete &&
      elemental.currentHp > 0 &&
      elemental.hasKeeperSpeedAura === true &&
      distanceSq(elemental.position, unit.position) <= radiusSq
  )
    ? 1.5
    : 1;
}

export function tickAbilities(state: BattleState, _config: BattleConfig, deltaSeconds: number): void {
  const elapsedSeconds = Math.max(0, deltaSeconds);
  for (const unit of state.units) {
    unit.masterRangeBoostRemainingSeconds = remainingDuration(unit.masterRangeBoostRemainingSeconds, elapsedSeconds);
    unit.seekerAttackBoostRemainingSeconds = remainingDuration(unit.seekerAttackBoostRemainingSeconds, elapsedSeconds);
  }
  if (state.phase !== "InProgress") {
    return;
  }

  for (const unit of state.units) {
    const maxAbilityAp = abilityApCost(unit.unitType);
    if (unit.team !== "Player" || !isUnitAlive(unit) || unit.abilityAp >= maxAbilityAp) {
      continue;
    }
    const total = unit.abilityRecoverySeconds + elapsedSeconds;
    const gainedAp = Math.floor(total / secondsPerAp);
    unit.abilityAp = Math.min(maxAbilityAp, unit.abilityAp + gainedAp);
    unit.abilityRecoverySeconds = unit.abilityAp >= maxAbilityAp ? 0 : total - gainedAp * secondsPerAp;
  }
}

function remainingDuration(durationSeconds: number, elapsedSeconds: number): number {
  const remaining = durationSeconds - elapsedSeconds;
  return remaining > 1e-9 ? remaining : 0;
}
