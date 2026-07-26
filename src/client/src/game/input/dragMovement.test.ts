import test from "node:test";
import assert from "node:assert/strict";
import type { UnitState } from "../core/types";
import { canCommitDragMovement, shouldKeepMoveMarker } from "./dragMovement";

test("commits drag movement only for a valid release during the match", () => {
  const valid = {
    matchInProgress: true,
    overHud: false,
    insideBattlefield: true,
    targetUnitAlive: true
  };

  assert.equal(canCommitDragMovement(valid), true);
  assert.equal(canCommitDragMovement({ ...valid, matchInProgress: false }), false);
  assert.equal(canCommitDragMovement({ ...valid, overHud: true }), false);
  assert.equal(canCommitDragMovement({ ...valid, insideBattlefield: false }), false);
  assert.equal(canCommitDragMovement({ ...valid, targetUnitAlive: false }), false);
});

test("keeps a marker only while an active living unit has not arrived", () => {
  assert.equal(shouldKeepMoveMarker(markerUnit()), true);
  assert.equal(
    shouldKeepMoveMarker(markerUnit({ position: { x: 1, y: 0 } })),
    false
  );
  assert.equal(shouldKeepMoveMarker(markerUnit({ currentHp: 0 })), false);
  assert.equal(shouldKeepMoveMarker(markerUnit({ mode: "Defeated" })), false);
});

function markerUnit(
  overrides: Partial<
    Pick<UnitState, "currentHp" | "mode" | "position" | "destination">
  > = {}
): Pick<UnitState, "currentHp" | "mode" | "position" | "destination"> {
  return {
    currentHp: 100,
    mode: "Active",
    position: { x: 0, y: 0 },
    destination: { x: 1, y: 0 },
    ...overrides
  };
}
