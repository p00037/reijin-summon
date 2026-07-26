import type { UnitState } from "../core/types";
import { distanceSq } from "../core/vector";

export type DragReleaseContext = {
  matchInProgress: boolean;
  overHud: boolean;
  insideBattlefield: boolean;
  targetUnitAlive: boolean;
};

export function canCommitDragMovement(context: DragReleaseContext): boolean {
  return (
    context.matchInProgress &&
    !context.overHud &&
    context.insideBattlefield &&
    context.targetUnitAlive
  );
}

export function shouldKeepMoveMarker(
  unit: Pick<UnitState, "currentHp" | "mode" | "position" | "destination">
): boolean {
  return (
    unit.currentHp > 0 &&
    unit.mode !== "Defeated" &&
    distanceSq(unit.position, unit.destination) > Number.EPSILON
  );
}
