import test from "node:test";
import assert from "node:assert/strict";
import { calculateSummonArea } from "./areaCalculator";

test("三角形の召喚領域を計算する", () => {
  const area = calculateSummonArea([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 }
  ]);

  assert.equal(area, 6);
});

test("内側の点は凸包面積に影響しない", () => {
  const area = calculateSummonArea([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
    { x: 1, y: 1 }
  ]);

  assert.equal(area, 4);
});

test("3点未満なら面積は0", () => {
  assert.equal(calculateSummonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }]), 0);
});
