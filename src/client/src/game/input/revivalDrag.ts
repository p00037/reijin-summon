import type {
  BattleCommand,
  MatchPhase,
  PlayerUnitId,
  Vec2
} from "../core/types";

export type RevivalDragState = {
  draggedUnitId: PlayerUnitId | null;
};

export type RevivalDropContext = {
  phase: MatchPhase;
  targetDefeated: boolean;
  enoughMp: boolean;
  insideBattlefield: boolean;
  insideHealingArea: boolean;
};

export function transitionRevivalDragRelease(
  state: RevivalDragState,
  context: RevivalDropContext,
  targetPosition: Vec2
): {
  draggedUnitId: null;
  command: Extract<BattleCommand, { commandType: "ReviveUnit" }> | null;
} {
  const canRevive =
    state.draggedUnitId !== null &&
    context.phase === "InProgress" &&
    context.targetDefeated &&
    context.enoughMp &&
    context.insideBattlefield &&
    context.insideHealingArea;

  return {
    draggedUnitId: null,
    command: canRevive
      ? {
          commandType: "ReviveUnit",
          team: "Player",
          unitId: state.draggedUnitId!,
          targetPosition: { ...targetPosition }
        }
      : null
  };
}
