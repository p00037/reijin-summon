import type { Vec2 } from "../core/types";

const polygonAreaEpsilon = 1e-9;

export function calculateSummonArea(points: Vec2[]): number {
  const hull = convexHull(points);
  if (hull.length < 3) {
    return 0;
  }
  return Math.abs(shoelaceArea(hull));
}

export function orderPolygonPoints(points: Vec2[]): Vec2[] {
  const unique = points.filter(
    (point, index) =>
      points.findIndex(
        (candidate) => candidate.x === point.x && candidate.y === point.y
      ) === index
  );
  if (unique.length < 2) {
    return unique.map((point) => ({ ...point }));
  }

  const center = unique.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  center.x /= unique.length;
  center.y /= unique.length;

  return unique
    .map((point) => ({ ...point }))
    .sort(
      (a, b) =>
        Math.atan2(a.y - center.y, a.x - center.x) -
        Math.atan2(b.y - center.y, b.x - center.x)
    );
}

export function calculateSummonCentroid(points: Vec2[], fallback: Vec2): Vec2 {
  const polygon = orderPolygonPoints(points);
  if (polygon.length < 3) {
    return { ...fallback };
  }

  let crossSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = current.x * next.y - next.x * current.y;
    crossSum += cross;
    weightedX += (current.x + next.x) * cross;
    weightedY += (current.y + next.y) * cross;
  }
  if (Math.abs(crossSum) <= polygonAreaEpsilon) {
    return { ...fallback };
  }

  return {
    x: weightedX / (3 * crossSum),
    y: weightedY / (3 * crossSum)
  };
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
