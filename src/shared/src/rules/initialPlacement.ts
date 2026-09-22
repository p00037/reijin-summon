import { isUnitAlive } from "../core/battleState.js";
import { distanceSq } from "../core/vector.js";
import type { BattleConfig, BattleState, UnitId, Vec2 } from "../core/types.js";

export function tryPlaceInitialUnit(
  state: BattleState,
  config: BattleConfig,
  unitId: UnitId,
  targetPosition: Vec2
): boolean {
  const unit = state.units.find((candidate) => candidate.unitId === unitId);
  if (!unit || !isUnitAlive(unit) || !Number.isFinite(targetPosition.x) || !Number.isFinite(targetPosition.y)) {
    return false;
  }

  const margin = config.initialPlacementMargin;
  const insidePlayerArea =
    targetPosition.x >= config.battlefieldMin.x + margin
    && targetPosition.x <= config.battlefieldMax.x - margin
    && (unit.team === "Player"
      ? targetPosition.y >= config.battlefieldMin.y + margin && targetPosition.y <= -margin
      : targetPosition.y >= margin && targetPosition.y <= config.battlefieldMax.y - margin);
  if (!insidePlayerArea) {
    return false;
  }

  const minimumDistanceSq =
    config.initialPlacementMinDistance * config.initialPlacementMinDistance;
  const overlapsUnit = state.units.some(
    (candidate) =>
      candidate.unitId !== unitId
      && candidate.team === unit.team
      && isUnitAlive(candidate)
      && distanceSq(candidate.position, targetPosition) < minimumDistanceSq
  );
  if (overlapsUnit) {
    return false;
  }

  unit.position = { ...targetPosition };
  unit.spawnPosition = { ...targetPosition };
  unit.destination = { ...targetPosition };
  return true;
}
