import test from "node:test";
import assert from "node:assert/strict";
import { isCircleInBeam } from "./summonGeometry";

test("レーザーは幅境界・丸い端点で円と交差し、延長線の遠方へ当たらない", () => {
  const beam = { start: { x: 0, y: 0 }, end: { x: 0, y: 4 }, width: 1.512 };
  assert.equal(isCircleInBeam({ x: 1.512, y: 2 }, 0.756, beam), true);
  assert.equal(isCircleInBeam({ x: 1.513, y: 2 }, 0.756, beam), false);
  assert.equal(isCircleInBeam({ x: 0, y: 4.756 }, 0, beam), true);
  assert.equal(isCircleInBeam({ x: 0, y: 6 }, 0, beam), false);
});

test("長さ0のレーザーも円として有限な判定になる", () => {
  const beam = { start: { x: 1, y: 1 }, end: { x: 1, y: 1 }, width: 2 };
  assert.equal(isCircleInBeam({ x: 2, y: 1 }, 0, beam), true);
  assert.equal(isCircleInBeam({ x: 3, y: 1 }, 0, beam), false);
});
