import type { UnitType, Vec2 } from "../core/types";

export const rangedAttackProjectileTextureKey = "ranged-attack-projectile";
export const rangedAttackProjectileAssetPath =
  "/assets/effects/melee_attack1.png";

type LineAttackPresentation = {
  kind: "Line";
  origin: Vec2;
  target: Vec2;
};

type RangedProjectilePresentation = {
  kind: "RangedProjectile";
  origin: Vec2;
  target: Vec2;
  rotation: number;
  displayWidth: number;
  displayHeight: number;
  durationMs: number;
  depth: number;
};

export type AttackEffectPresentation =
  | LineAttackPresentation
  | RangedProjectilePresentation;

export function attackEffectPresentation(
  unitType: UnitType | null,
  origin: Vec2,
  target: Vec2
): AttackEffectPresentation {
  if (unitType !== "Ranged") {
    return { kind: "Line", origin, target };
  }

  return {
    kind: "RangedProjectile",
    origin,
    target,
    rotation: Math.atan2(target.y - origin.y, target.x - origin.x),
    displayWidth: 72,
    displayHeight: 72,
    durationMs: 250,
    depth: 3
  };
}
