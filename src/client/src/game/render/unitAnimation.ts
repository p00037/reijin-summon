import type { AttackEvent, UnitState } from "../core/types";
import { distanceSq } from "../core/vector";

export type RangedAnimationName = "idle" | "walk" | "attack" | "damage" | "defeated";
export type RangedAnimationKey =
  | "ranged-idle"
  | "ranged-walk"
  | "ranged-attack"
  | "ranged-damage"
  | "ranged-defeated";
export type SpeedAnimationKey =
  | "speed-idle"
  | "speed-walk"
  | "speed-attack"
  | "speed-damage"
  | "speed-defeated";

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
  return animationKeyForUnit(unit, recentAttackEvents, "ranged");
}

export function speedFrameStart(animation: RangedAnimationName): number {
  return frameStarts[animation];
}

export function speedAnimationKey(animation: RangedAnimationName): SpeedAnimationKey {
  return `speed-${animation}`;
}

export function speedAnimationKeyForUnit(unit: UnitState, recentAttackEvents: AttackEvent[]): SpeedAnimationKey {
  return animationKeyForUnit(unit, recentAttackEvents, "speed");
}

function animationKeyForUnit<TPrefix extends "ranged" | "speed">(
  unit: UnitState,
  recentAttackEvents: AttackEvent[],
  prefix: TPrefix
): `${TPrefix}-${RangedAnimationName}` {
  if (unit.mode === "Defeated" || unit.currentHp <= 0) {
    return `${prefix}-defeated`;
  }

  if (recentAttackEvents.some((event) => event.attackerUnitId === unit.unitId)) {
    return `${prefix}-attack`;
  }

  if (distanceSq(unit.position, unit.destination) > 0.01) {
    return `${prefix}-walk`;
  }

  return `${prefix}-idle`;
}
