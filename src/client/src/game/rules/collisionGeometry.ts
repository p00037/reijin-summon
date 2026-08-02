import type { BattleConfig, Vec2 } from "../core/types";
import { distanceSq } from "../core/vector";

export type CollisionBodyKind = "Unit" | "SummonedUnit" | "Point";

export function collisionRadiusForKind(
  config: BattleConfig,
  kind: CollisionBodyKind
): number {
  switch (kind) {
    case "Unit":
      return config.unitCollisionRadius;
    case "SummonedUnit":
      return config.summonedUnitCollisionRadius;
    case "Point":
      return 0;
  }
}

export function combinedCollisionRadius(
  config: BattleConfig,
  firstKind: CollisionBodyKind,
  secondKind: CollisionBodyKind
): number {
  return (
    collisionRadiusForKind(config, firstKind) +
    collisionRadiusForKind(config, secondKind)
  );
}

export function areCollisionCirclesTouching(
  config: BattleConfig,
  firstPosition: Vec2,
  firstKind: CollisionBodyKind,
  secondPosition: Vec2,
  secondKind: CollisionBodyKind
): boolean {
  const radius = combinedCollisionRadius(config, firstKind, secondKind);
  return distanceSq(firstPosition, secondPosition) <= radius * radius;
}
