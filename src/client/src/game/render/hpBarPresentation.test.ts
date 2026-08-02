import assert from "node:assert/strict";
import test from "node:test";
import { battlefieldHpBarLayout } from "./hpBarPresentation";

test("battlefield HP bar presentation exposes a layout calculator", async () => {
  const presentation: Partial<typeof import("./hpBarPresentation")> = await import(
    "./hpBarPresentation"
  ).catch(() => ({}));
  assert.equal(typeof presentation.battlefieldHpBarLayout, "function");
});

test("unit card HP bar occupies the inner bottom strip", async () => {
  const module = await import("./hpBarPresentation");
  assert.equal(typeof module.unitCardHpBarPresentation, "function");
  const presentation = module.unitCardHpBarPresentation!(
    { x: 100, y: 200 },
    0,
    0.5
  );

  assert.deepEqual(presentation.background, [
    { x: 80, y: 239 },
    { x: 120, y: 239 },
    { x: 120, y: 244 },
    { x: 80, y: 244 }
  ]);
  assert.deepEqual(presentation.fill, [
    { x: 80, y: 239 },
    { x: 100, y: 239 },
    { x: 100, y: 244 },
    { x: 80, y: 244 }
  ]);
});

test("unit card HP bar rotates with the card", async () => {
  const module = await import("./hpBarPresentation");
  assert.equal(typeof module.unitCardHpBarPresentation, "function");
  const presentation = module.unitCardHpBarPresentation!(
    { x: 100, y: 200 },
    Math.PI / 2,
    1
  );
  const rounded = presentation.background.map((point) => ({
    x: Number(point.x.toFixed(10)),
    y: Number(point.y.toFixed(10))
  }));

  assert.deepEqual(rounded, [
    { x: 61, y: 180 },
    { x: 61, y: 220 },
    { x: 56, y: 220 },
    { x: 56, y: 180 }
  ]);
});

test("unit card HP fill ratio is clamped", async () => {
  const module = await import("./hpBarPresentation");
  assert.equal(typeof module.unitCardHpBarPresentation, "function");
  const empty = module.unitCardHpBarPresentation!({ x: 0, y: 0 }, 0, -1);
  const full = module.unitCardHpBarPresentation!({ x: 0, y: 0 }, 0, 2);

  assert.equal(empty.fill[1].x - empty.fill[0].x, 0);
  assert.equal(full.fill[1].x - full.fill[0].x, 40);
});

test("other battlefield bars keep their positions", () => {
  const screen = { x: 100, y: 200 };

  assert.deepEqual(battlefieldHpBarLayout("Elemental", screen), {
    x: 82,
    y: 218,
    width: 36
  });
  assert.deepEqual(battlefieldHpBarLayout("SummonedUnit", screen), {
    x: 72,
    y: 234,
    width: 56
  });
});

test("leader has no battlefield HP bar", () => {
  assert.equal(battlefieldHpBarLayout("Leader", { x: 100, y: 200 }), null);
});
