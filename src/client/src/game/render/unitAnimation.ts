import type { AttackEvent, UnitState } from "../core/types";
import { distanceSq } from "../core/vector";

export type RangedAnimationName = "idle" | "walk" | "attack" | "damage" | "defeated";
export type RangedAnimationKey =
  | "ranged-idle"
  | "ranged-walk"
  | "ranged-attack"
  | "ranged-damage"
  | "ranged-defeated";

const frameStarts: Record<RangedAnimationName, number> = {
  idle: 0,
  walk: 4,
  attack: 8,
  damage: 12,
  defeated: 16
};

export function rangedFrameStart(animation: RangedAnimationName): number {
  return frameStarts[animation];
}

export function rangedAnimationKey(animation: RangedAnimationName): RangedAnimationKey {
  return `ranged-${animation}`;
}

export function rangedAnimationKeyForUnit(unit: UnitState, recentAttackEvents: AttackEvent[]): RangedAnimationKey {
  if (unit.mode === "Defeated" || unit.currentHp <= 0) {
    return "ranged-defeated";
  }

  if (recentAttackEvents.some((event) => event.attackerUnitId === unit.unitId)) {
    return "ranged-attack";
  }

  if (distanceSq(unit.position, unit.destination) > 0.01) {
    return "ranged-walk";
  }

  return "ranged-idle";
}
