import type { UnitType, Vec2 } from "../core/types";
import { distanceSq } from "../core/vector";

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

type NoAttackEffectPresentation = {
  kind: "None";
};

export type AttackEffectPresentation =
  | NoAttackEffectPresentation
  | LineAttackPresentation
  | RangedProjectilePresentation;

type AttackEventRenderer<TProjectile> = {
  drawLine: (origin: Vec2, target: Vec2) => void;
  createProjectile: (presentation: RangedProjectilePresentation) => TProjectile;
  createProjectileTween: (
    projectile: TProjectile,
    presentation: RangedProjectilePresentation
  ) => void;
};

export function attackEffectPresentation(
  unitType: UnitType | null,
  attackDistance: number,
  origin: Vec2,
  target: Vec2
): AttackEffectPresentation {
  if (unitType !== "Ranged") {
    return { kind: "Line", origin, target };
  }
  if (attackDistance <= 1) {
    return { kind: "None" };
  }

  return {
    kind: "RangedProjectile",
    origin,
    target,
    rotation: Math.atan2(target.y - origin.y, target.x - origin.x),
    displayWidth: 72,
    displayHeight: 72,
    durationMs: 500,
    depth: 3
  };
}

export function drawAttackEvent<TProjectile>(
  unitType: UnitType | null,
  worldOrigin: Vec2,
  worldTarget: Vec2,
  origin: Vec2,
  target: Vec2,
  renderer: AttackEventRenderer<TProjectile>
): void {
  const attackDistance = Math.sqrt(distanceSq(worldOrigin, worldTarget));
  const presentation = attackEffectPresentation(
    unitType,
    attackDistance,
    origin,
    target
  );

  if (presentation.kind === "None") {
    return;
  }
  if (presentation.kind === "Line") {
    renderer.drawLine(presentation.origin, presentation.target);
    return;
  }

  const projectile = renderer.createProjectile(presentation);
  renderer.createProjectileTween(projectile, presentation);
}
