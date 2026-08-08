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

type AttackProjectile<TBlendMode> = {
  setDisplaySize: (width: number, height: number) => unknown;
  setRotation: (rotation: number) => unknown;
  setDepth: (depth: number) => unknown;
  setBlendMode: (blendMode: TBlendMode) => unknown;
  destroy: () => void;
};

type AttackProjectileTween<TProjectile> = {
  targets: TProjectile;
  x: number;
  y: number;
  duration: number;
  ease: "Linear";
  onComplete: () => void;
};

type AttackEventRendererDependencies<
  TProjectile,
  TBlendMode
> = {
  drawLine: (origin: Vec2, target: Vec2) => void;
  createImage: (x: number, y: number, textureKey: string) => TProjectile;
  addTween: (tween: AttackProjectileTween<TProjectile>) => void;
  additiveBlendMode: TBlendMode;
};

export function createAttackEventRenderer<
  TBlendMode,
  TProjectile extends AttackProjectile<TBlendMode>
>(
  dependencies: AttackEventRendererDependencies<TProjectile, TBlendMode>
): AttackEventRenderer<TProjectile> {
  return {
    drawLine: dependencies.drawLine,
    createProjectile: (presentation) => {
      const projectile = dependencies.createImage(
        presentation.origin.x,
        presentation.origin.y,
        rangedAttackProjectileTextureKey
      );
      projectile.setDisplaySize(
        presentation.displayWidth,
        presentation.displayHeight
      );
      projectile.setRotation(presentation.rotation);
      projectile.setDepth(presentation.depth);
      projectile.setBlendMode(dependencies.additiveBlendMode);
      return projectile;
    },
    createProjectileTween: (projectile, presentation) => {
      dependencies.addTween({
        targets: projectile,
        x: presentation.target.x,
        y: presentation.target.y,
        duration: presentation.durationMs,
        ease: "Linear",
        onComplete: () => projectile.destroy()
      });
    }
  };
}

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
