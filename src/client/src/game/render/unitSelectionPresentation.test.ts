import assert from "node:assert/strict";
import test from "node:test";

async function loadSelectionPresentation(): Promise<
  Partial<typeof import("./unitSelectionPresentation")>
> {
  return await import("./unitSelectionPresentation").catch(() => ({}));
}

test("unit selection circle converts the contact radius to screen pixels", async () => {
  const module = await loadSelectionPresentation();
  assert.equal(typeof module.unitSelectionCirclePresentation, "function");
  const presentation = module.unitSelectionCirclePresentation!(
    0.54,
    515.2,
    12.6
  );

  assert.equal(Number(presentation.radius.toFixed(2)), 22.08);
  assert.equal(presentation.strokeWidth, 3);
  assert.equal(presentation.strokeColor, 0xfacc15);
  assert.equal(presentation.strokeAlpha, 1);
});

test("unit selection circle scales with the rendered battlefield width", async () => {
  const module = await loadSelectionPresentation();
  assert.equal(typeof module.unitSelectionCirclePresentation, "function");
  const presentation = module.unitSelectionCirclePresentation!(
    0.54,
    1030.4,
    12.6
  );

  assert.equal(Number(presentation.radius.toFixed(2)), 44.16);
});
