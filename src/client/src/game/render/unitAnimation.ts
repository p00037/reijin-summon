import type { AttackEvent, LeaderState, SummonedUnitState, TeamId, UnitState, Vec2 } from "../core/types";
import { distance, distanceSq } from "../core/vector";

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
export type MeleeAnimationKey =
  | "melee-idle"
  | "melee-walk"
  | "melee-attack"
  | "melee-damage"
  | "melee-defeated";
export type SummonedAnimationName = "walk" | "attack";
export type SummonedAnimationKey = "summoned-walk" | "summoned-attack";

const frameStarts: Record<RangedAnimationName, number> = {
  idle: 0,
  walk: 4,
  attack: 8,
  damage: 12,
  defeated: 16
};
const summonedFrameStarts: Record<SummonedAnimationName, number> = {
  walk: 0,
  attack: 4
};
const defaultAnimationFrameRate = 7;
const idleAnimationFrameRate = 4;
const summonedAttackAnimationFrameRate = 5;

export function rangedFrameStart(animation: RangedAnimationName): number {
  return frameStarts[animation];
}

export function rangedAnimationKey(animation: RangedAnimationName): RangedAnimationKey {
  return `ranged-${animation}`;
}

export function rangedAnimationFrameRate(animation: RangedAnimationName): number {
  return animationFrameRate(animation);
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

export function speedAnimationFrameRate(animation: RangedAnimationName): number {
  return animationFrameRate(animation);
}

export function speedAnimationKeyForUnit(unit: UnitState, recentAttackEvents: AttackEvent[]): SpeedAnimationKey {
  return animationKeyForUnit(unit, recentAttackEvents, "speed");
}

export function meleeFrameStart(animation: RangedAnimationName): number {
  return frameStarts[animation];
}

export function meleeAnimationKey(animation: RangedAnimationName): MeleeAnimationKey {
  return `melee-${animation}`;
}

export function meleeAnimationFrameRate(animation: RangedAnimationName): number {
  return animationFrameRate(animation);
}

export function meleeAnimationKeyForUnit(unit: UnitState, recentAttackEvents: AttackEvent[]): MeleeAnimationKey {
  return animationKeyForUnit(unit, recentAttackEvents, "melee");
}

export function summonedFrameStart(animation: SummonedAnimationName): number {
  return summonedFrameStarts[animation];
}

export function summonedAnimationKey(animation: SummonedAnimationName): SummonedAnimationKey {
  return `summoned-${animation}`;
}

export function summonedAnimationFrameRate(animation: SummonedAnimationName): number {
  return animation === "attack" ? summonedAttackAnimationFrameRate : defaultAnimationFrameRate;
}

export function summonedAnimationKeyForUnit(
  summoned: SummonedUnitState,
  enemyLeader: LeaderState,
  contactRadius: number
): SummonedAnimationKey {
  return distance(summoned.position, enemyLeader.position) <= contactRadius ? "summoned-attack" : "summoned-walk";
}

export function spriteFlipXForMovement(team: TeamId, position: Vec2, destination: Vec2): boolean {
  const deltaX = destination.x - position.x;
  if (Math.abs(deltaX) > 0.01) {
    return deltaX < 0;
  }
  return team === "Cpu";
}

function animationFrameRate(animation: RangedAnimationName): number {
  return animation === "idle" ? idleAnimationFrameRate : defaultAnimationFrameRate;
}

function animationKeyForUnit<TPrefix extends "ranged" | "speed" | "melee">(
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
