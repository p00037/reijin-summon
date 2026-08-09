import type { TeamId, Vec2 } from "../core/types";

export function initialCardRotation(team: TeamId): number {
  return team === "Player" ? 0 : Math.PI;
}

export function cardRotationAfterRevival(team: TeamId): number {
  return initialCardRotation(team);
}

export function cardRotationForMovement(previous: Vec2, current: Vec2, previousRotation: number): number {
  const deltaX = current.x - previous.x;
  const deltaY = current.y - previous.y;
  return deltaX === 0 && deltaY === 0 ? previousRotation : Math.atan2(deltaY, deltaX) + Math.PI / 2;
}
