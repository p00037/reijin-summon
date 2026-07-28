import type {
  BattleCommand,
  PlayerUnitId,
  UnitState,
  Vec2
} from "../core/types";
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

export type DragMovementState = {
  draggedUnitId: PlayerUnitId | null;
  moveMarkers: ReadonlyMap<PlayerUnitId, Vec2>;
};

export type DragReleaseTransition = {
  draggedUnitId: null;
  moveMarkers: Map<PlayerUnitId, Vec2>;
  command: Extract<
    BattleCommand,
    { commandType: "MoveUnit"; team: "Player" }
  > | null;
};

export function transitionDragRelease(
  state: DragMovementState,
  context: DragReleaseContext,
  targetPosition: Vec2
): DragReleaseTransition {
  const moveMarkers = new Map(state.moveMarkers);
  if (!state.draggedUnitId || !canCommitDragMovement(context)) {
    return {
      draggedUnitId: null,
      moveMarkers,
      command: null
    };
  }

  const command = {
    commandType: "MoveUnit" as const,
    team: "Player" as const,
    unitId: state.draggedUnitId,
    targetPosition: { ...targetPosition }
  };
  moveMarkers.set(state.draggedUnitId, { ...targetPosition });
  return {
    draggedUnitId: null,
    moveMarkers,
    command
  };
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
