import assert from "node:assert/strict";
import test from "node:test";
import { battlefieldHpBarLayout } from "./hpBarPresentation";

test("battlefield HP bar presentation exposes a layout calculator", async () => {
  const presentation: Partial<typeof import("./hpBarPresentation")> = await import(
    "./hpBarPresentation"
  ).catch(() => ({}));
  assert.equal(typeof presentation.battlefieldHpBarLayout, "function");
});

test("unit HP bar is six pixels lower while other battlefield bars keep their positions", () => {
  const screen = { x: 100, y: 200 };

  assert.deepEqual(battlefieldHpBarLayout("Unit", screen), {
    x: 80,
    y: 227,
    width: 40
  });
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
