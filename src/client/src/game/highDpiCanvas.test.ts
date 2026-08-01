import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHighDpiCanvas,
  normalizeRenderScale
} from "./highDpiCanvas";

test("returns the device pixel ratio within the supported range", () => {
  assert.equal(normalizeRenderScale(1), 1);
  assert.equal(normalizeRenderScale(1.5), 1.5);
  assert.equal(normalizeRenderScale(2), 2);
  assert.equal(normalizeRenderScale(3), 2);
});

test("uses a render scale of one for unsupported device pixel ratios", () => {
  assert.equal(normalizeRenderScale(undefined), 1);
  assert.equal(normalizeRenderScale(Number.NaN), 1);
  assert.equal(normalizeRenderScale(Number.POSITIVE_INFINITY), 1);
  assert.equal(normalizeRenderScale(0.75), 1);
});

test("calculates physical canvas dimensions from the render scale", () => {
  assert.deepEqual(calculateHighDpiCanvas(1), {
    renderScale: 1,
    width: 644,
    height: 468
  });
  assert.deepEqual(calculateHighDpiCanvas(1.5), {
    renderScale: 1.5,
    width: 966,
    height: 702
  });
  assert.deepEqual(calculateHighDpiCanvas(3), {
    renderScale: 2,
    width: 1288,
    height: 936
  });
});
