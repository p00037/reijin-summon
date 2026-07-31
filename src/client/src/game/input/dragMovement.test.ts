import test from "node:test";
import assert from "node:assert/strict";
import type { UnitState } from "../core/types";
import {
  canCommitDragMovement,
  shouldKeepMoveMarker,
  transitionDragRelease
} from "./dragMovement";

test("commits drag movement only for a valid release during the battle", () => {
  const valid = {
    phase: "InProgress" as const,
    overHud: false,
    insideBattlefield: true,
    targetUnitAlive: true
  };

  assert.equal(canCommitDragMovement(valid), true);
  assert.equal(canCommitDragMovement({ ...valid, phase: "Countdown" }), false);
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

test("creates a player move command for a valid drag release", () => {
  const transition = transitionDragRelease(
    {
      draggedUnitId: "PlayerMelee",
      moveMarkers: new Map()
    },
    validRelease,
    { x: 4, y: -2 }
  );

  assert.deepEqual(transition.command, {
    commandType: "MoveUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: 4, y: -2 }
  });
  assert.equal(transition.draggedUnitId, null);
});

test("creates a player initial placement command for a valid Setup drag release", () => {
  const transition = transitionDragRelease(
    {
      draggedUnitId: "PlayerMelee",
      moveMarkers: new Map()
    },
    {
      phase: "Setup",
      overHud: false,
      insideBattlefield: true,
      targetUnitAlive: true
    },
    { x: -4, y: -2 }
  );

  assert.deepEqual(transition.command, {
    commandType: "PlaceInitialUnit",
    team: "Player",
    unitId: "PlayerMelee",
    targetPosition: { x: -4, y: -2 }
  });
  assert.equal(transition.moveMarkers.size, 0);
});

test("does not create a command for a Countdown drag release", () => {
  const transition = transitionDragRelease(
    {
      draggedUnitId: "PlayerMelee",
      moveMarkers: new Map()
    },
    {
      phase: "Countdown",
      overHud: false,
      insideBattlefield: true,
      targetUnitAlive: true
    },
    { x: -4, y: -2 }
  );

  assert.equal(transition.command, null);
});

test("sets and updates the dragged unit marker without mutating the prior markers", () => {
  const priorMarkers = new Map([
    ["PlayerMelee" as const, { x: -3, y: 1 }],
    ["PlayerSpeed" as const, { x: 2, y: 2 }]
  ]);

  const transition = transitionDragRelease(
    {
      draggedUnitId: "PlayerMelee",
      moveMarkers: priorMarkers
    },
    validRelease,
    { x: 4, y: -2 }
  );

  assert.deepEqual([...transition.moveMarkers], [
    ["PlayerMelee", { x: 4, y: -2 }],
    ["PlayerSpeed", { x: 2, y: 2 }]
  ]);
  assert.deepEqual([...priorMarkers], [
    ["PlayerMelee", { x: -3, y: 1 }],
    ["PlayerSpeed", { x: 2, y: 2 }]
  ]);
});

test("invalid drag release clears dragging without issuing a command or changing markers", () => {
  const priorMarkers = new Map([
    ["PlayerMelee" as const, { x: -3, y: 1 }]
  ]);

  const transition = transitionDragRelease(
    {
      draggedUnitId: "PlayerSpeed",
      moveMarkers: priorMarkers
    },
    { ...validRelease, insideBattlefield: false },
    { x: 4, y: -2 }
  );

  assert.equal(transition.draggedUnitId, null);
  assert.equal(transition.command, null);
  assert.deepEqual([...transition.moveMarkers], [
    ["PlayerMelee", { x: -3, y: 1 }]
  ]);
  assert.deepEqual([...priorMarkers], [
    ["PlayerMelee", { x: -3, y: 1 }]
  ]);
});

const validRelease = {
  phase: "InProgress" as const,
  overHud: false,
  insideBattlefield: true,
  targetUnitAlive: true
};

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
