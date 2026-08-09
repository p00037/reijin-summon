import type { TeamId, Vec2 } from "../core/types";
import {
  cardRotationAfterRevival,
  cardRotationForMovement,
  initialCardRotation
} from "./cardFacing";

export type UnitCardRenderState = {
  positions: Map<string, Vec2>;
  rotations: Map<string, number>;
};

export function applyPlayerRevivalCardState(
  state: UnitCardRenderState,
  revivedUnitId: string | null
): void {
  if (revivedUnitId === null) {
    return;
  }

  state.positions.delete(revivedUnitId);
  state.rotations.set(revivedUnitId, cardRotationAfterRevival("Player"));
}

export function updateUnitCardRenderState(
  state: UnitCardRenderState,
  unitId: string,
  screen: Vec2,
  team: TeamId
): number {
  const rotation = cardRotationForMovement(
    state.positions.get(unitId) ?? screen,
    screen,
    state.rotations.get(unitId) ?? initialCardRotation(team)
  );
  state.positions.set(unitId, { ...screen });
  state.rotations.set(unitId, rotation);
  return rotation;
}
