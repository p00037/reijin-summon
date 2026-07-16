import type { Vec2 } from "../core/types";

export function calculateSummonArea(points: Vec2[]): number {
  const hull = convexHull(points);
  if (hull.length < 3) {
    return 0;
  }
  return Math.abs(shoelaceArea(hull));
}

function convexHull(points: Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const unique = sorted.filter((point, index) => index === 0 || point.x !== sorted[index - 1].x || point.y !== sorted[index - 1].y);
  if (unique.length <= 1) {
    return unique;
  }

  const lower: Vec2[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Vec2[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(origin: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function shoelaceArea(points: Vec2[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}
