import assert from "node:assert/strict";
import test from "node:test";
import { cardImageDepth } from "./cardPresentation";

test("attack power is shown as a number at the top center of the card", async () => {
  const module: Partial<
    typeof import("./unitCardAttackPowerPresentation")
  > = await import("./unitCardAttackPowerPresentation").catch(() => ({}));

  assert.equal(typeof module.unitCardAttackPowerPresentation, "function");

  const presentation = module.unitCardAttackPowerPresentation!(
    { x: 100, y: 200 },
    0,
    92,
    61
  );

  assert.equal(presentation.text, "61");
  assert.deepEqual(presentation.position, { x: 100, y: 161 });
  assert.equal(presentation.rotation, 0);
  assert.equal(presentation.depth, module.unitCardAttackPowerDepth);
  assert.ok(presentation.depth > cardImageDepth);
});

test("attack power position and text rotation follow the card", async () => {
  const module: Partial<
    typeof import("./unitCardAttackPowerPresentation")
  > = await import("./unitCardAttackPowerPresentation").catch(() => ({}));

  assert.equal(typeof module.unitCardAttackPowerPresentation, "function");

  const reversed = module.unitCardAttackPowerPresentation!(
    { x: 100, y: 200 },
    Math.PI,
    92,
    53
  );
  assert.equal(reversed.text, "53");
  assert.ok(Math.abs(reversed.position.x - 100) < 1e-10);
  assert.ok(Math.abs(reversed.position.y - 239) < 1e-10);
  assert.equal(reversed.rotation, Math.PI);

  const diagonal = module.unitCardAttackPowerPresentation!(
    { x: 100, y: 200 },
    Math.PI / 2,
    92,
    36
  );
  assert.deepEqual(
    {
      x: Number(diagonal.position.x.toFixed(10)),
      y: Number(diagonal.position.y.toFixed(10))
    },
    { x: 139, y: 200 }
  );
  assert.equal(diagonal.rotation, Math.PI / 2);
  assert.equal(diagonal.text, "36");
});
