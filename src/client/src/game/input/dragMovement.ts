import type {
  BattleCommand,
  MatchPhase,
  PlayerUnitId,
  UnitState,
  Vec2
} from "../core/types";
import { distanceSq } from "../core/vector";

export type DragReleaseContext = {
  phase: MatchPhase;
  overHud: boolean;
  insideBattlefield: boolean;
  targetUnitAlive: boolean;
};

export function canCommitDragMovement(context: DragReleaseContext): boolean {
  return (
    context.phase !== "Countdown" &&
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
    | { commandType: "PlaceInitialUnit"; team: "Player" }
    | { commandType: "MoveUnit"; team: "Player" }
  > | null;
};

export type PointerDragState = ReadonlyMap<number, PlayerUnitId>;

export type PointerDragStartTransition = {
  draggedUnitIdsByPointer: Map<number, PlayerUnitId>;
  started: boolean;
};

export function transitionPointerDragStart(
  state: PointerDragState,
  pointerId: number,
  unitId: PlayerUnitId
): PointerDragStartTransition {
  const draggedUnitIdsByPointer = new Map(state);
  draggedUnitIdsByPointer.delete(pointerId);
  if ([...draggedUnitIdsByPointer.values()].includes(unitId)) {
    return { draggedUnitIdsByPointer, started: false };
  }
  draggedUnitIdsByPointer.set(pointerId, unitId);
  return { draggedUnitIdsByPointer, started: true };
}

export function clearPointerDrag(
  state: PointerDragState,
  pointerId: number
): Map<number, PlayerUnitId> {
  const draggedUnitIdsByPointer = new Map(state);
  draggedUnitIdsByPointer.delete(pointerId);
  return draggedUnitIdsByPointer;
}

export function clearUnitDrag(
  state: PointerDragState,
  unitId: PlayerUnitId
): Map<number, PlayerUnitId> {
  const draggedUnitIdsByPointer = new Map(state);
  for (const [pointerId, draggedUnitId] of draggedUnitIdsByPointer) {
    if (draggedUnitId === unitId) {
      draggedUnitIdsByPointer.delete(pointerId);
    }
  }
  return draggedUnitIdsByPointer;
}

export type PointerDragMovementState = {
  draggedUnitIdsByPointer: PointerDragState;
  moveMarkers: ReadonlyMap<PlayerUnitId, Vec2>;
};

export type PointerDragReleaseTransition = {
  draggedUnitIdsByPointer: Map<number, PlayerUnitId>;
  moveMarkers: Map<PlayerUnitId, Vec2>;
  command: DragReleaseTransition["command"];
};

export function transitionPointerDragRelease(
  state: PointerDragMovementState,
  pointerId: number,
  context: DragReleaseContext,
  targetPosition: Vec2
): PointerDragReleaseTransition {
  const draggedUnitId = state.draggedUnitIdsByPointer.get(pointerId) ?? null;
  const release = transitionDragRelease(
    { draggedUnitId, moveMarkers: state.moveMarkers },
    context,
    targetPosition
  );
  return {
    draggedUnitIdsByPointer: clearPointerDrag(
      state.draggedUnitIdsByPointer,
      pointerId
    ),
    moveMarkers: release.moveMarkers,
    command: release.command
  };
}

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

  const command =
    context.phase === "Setup"
      ? {
          commandType: "PlaceInitialUnit" as const,
          team: "Player" as const,
          unitId: state.draggedUnitId,
          targetPosition: { ...targetPosition }
        }
      : {
          commandType: "MoveUnit" as const,
          team: "Player" as const,
          unitId: state.draggedUnitId,
          targetPosition: { ...targetPosition }
        };
  if (context.phase === "InProgress") {
    moveMarkers.set(state.draggedUnitId, { ...targetPosition });
  }
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
