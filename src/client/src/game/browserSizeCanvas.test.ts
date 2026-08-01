import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBrowserRenderScale,
  calculateBrowserSizeCanvas,
  toLogicalCanvasPoint,
  withCanvasTextResolution
} from "./browserSizeCanvas";

test("calculates the render scale from the browser viewport", () => {
  assert.equal(calculateBrowserRenderScale(644, 468), 1);
  assert.equal(calculateBrowserRenderScale(1280, 720), 720 / 468);
  assert.equal(calculateBrowserRenderScale(1920, 1080), 2);
});

test("clamps browser viewports smaller than the logical viewport to one", () => {
  assert.equal(calculateBrowserRenderScale(320, 240), 1);
  assert.equal(calculateBrowserRenderScale(643, 468), 1);
});

test("uses a render scale of one for invalid browser viewport dimensions", () => {
  const invalidDimensions: ReadonlyArray<
    readonly [number | undefined, number | undefined]
  > = [
    [undefined, 468],
    [644, undefined],
    [Number.NaN, 468],
    [644, Number.NaN],
    [Number.POSITIVE_INFINITY, 468],
    [644, Number.POSITIVE_INFINITY],
    [0, 468],
    [644, 0],
    [-1, 468],
    [644, -1]
  ];

  for (const [width, height] of invalidDimensions) {
    assert.equal(calculateBrowserRenderScale(width, height), 1);
  }
});

test("calculates rounded physical canvas dimensions", () => {
  assert.deepEqual(calculateBrowserSizeCanvas(644, 468), {
    renderScale: 1,
    width: 644,
    height: 468
  });
  assert.deepEqual(calculateBrowserSizeCanvas(1280, 720), {
    renderScale: 720 / 468,
    width: 991,
    height: 720
  });
  assert.deepEqual(calculateBrowserSizeCanvas(1920, 1080), {
    renderScale: 2,
    width: 1288,
    height: 936
  });
});

test("converts physical pointer coordinates to logical canvas coordinates", () => {
  assert.deepEqual(toLogicalCanvasPoint({ x: 128.8, y: 112 }, 2), {
    x: 64.4,
    y: 56
  });
  const point = toLogicalCanvasPoint({ x: 96.6, y: 84 }, 1.5);
  assert.ok(Math.abs(point.x - 64.4) < 1e-10);
  assert.ok(Math.abs(point.y - 56) < 1e-10);
});

test("adds the browser-size render scale to text styles", () => {
  assert.deepEqual(
    withCanvasTextResolution(
      { color: "#ffffff", fontSize: "18px" },
      1.5
    ),
    {
      color: "#ffffff",
      fontSize: "18px",
      resolution: 1.5
    }
  );
});
