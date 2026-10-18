import type { BattleConfig, Vec2 } from "../core/types.js";
import { distanceSq } from "../core/vector.js";
import { meleeAttackRange } from "../core/battleConfig.js";

export function isWithinZocRange(firstPosition: Vec2, secondPosition: Vec2): boolean {
  return distanceSq(firstPosition, secondPosition) <= meleeAttackRange * meleeAttackRange;
}

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
