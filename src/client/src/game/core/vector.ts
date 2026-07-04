import type { Vec2 } from "./types";

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt(distanceSq(a, b));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampVec2(position: Vec2, min: Vec2, max: Vec2): Vec2 {
  return {
    x: clamp(position.x, min.x, max.x),
    y: clamp(position.y, min.y, max.y)
  };
}

export function moveTowards(current: Vec2, target: Vec2, maxDelta: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length <= maxDelta || length === 0) {
    return { ...target };
  }
  const scale = maxDelta / length;
  return {
    x: current.x + dx * scale,
    y: current.y + dy * scale
  };
}
