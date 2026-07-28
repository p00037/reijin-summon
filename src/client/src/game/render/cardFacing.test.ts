import assert from "node:assert/strict";
import test from "node:test";
import { cardRotationForMovement, initialCardRotation } from "./cardFacing";

test("CPU cards start upside down", () => {
  assert.equal(initialCardRotation("Player"), 0);
  assert.equal(initialCardRotation("Cpu"), Math.PI);
});

test("movement faces direction and stops retain the last rotation", () => {
  assert.equal(cardRotationForMovement({ x: 10, y: 10 }, { x: 10, y: 4 }, Math.PI), 0);
  assert.equal(cardRotationForMovement({ x: 10, y: 10 }, { x: 10, y: 16 }, 0), Math.PI);
  assert.equal(cardRotationForMovement({ x: 10, y: 10 }, { x: 10, y: 10 }, Math.PI / 2), Math.PI / 2);
});
