import test from "node:test";
import assert from "node:assert/strict";
import type { PlayerUnitId, UnitState, Vec2 } from "../core/types";
import {
  canCommitDragMovement,
  clearPointerDrag,
  shouldKeepMoveMarker,
  transitionDragRelease,
  transitionPointerDragRelease,
  transitionPointerDragStart
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

test("assigns different living units to independent pointers", () => {
  const first = transitionPointerDragStart(new Map(), 17, "PlayerMelee");
  const second = transitionPointerDragStart(
    first.draggedUnitIdsByPointer,
    99,
    "PlayerSpeed"
  );

  assert.equal(first.started, true);
  assert.equal(second.started, true);
  assert.deepEqual([...second.draggedUnitIdsByPointer], [
    [17, "PlayerMelee"],
    [99, "PlayerSpeed"]
  ]);
});

test("does not assign one unit to multiple pointers", () => {
  const first = transitionPointerDragStart(new Map(), 1, "PlayerMelee");
  const duplicate = transitionPointerDragStart(
    first.draggedUnitIdsByPointer,
    2,
    "PlayerMelee"
  );

  assert.equal(duplicate.started, false);
  assert.deepEqual([...duplicate.draggedUnitIdsByPointer], [[1, "PlayerMelee"]]);
});

test("clears only the specified pointer drag", () => {
  const prior = new Map<number, PlayerUnitId>([
    [1, "PlayerMelee"],
    [2, "PlayerSpeed"]
  ]);

  const next = clearPointerDrag(prior, 1);

  assert.deepEqual([...next], [[2, "PlayerSpeed"]]);
  assert.equal(prior.size, 2);
});

test("releases pointers in any order for their assigned units", () => {
  const state = {
    draggedUnitIdsByPointer: new Map<number, PlayerUnitId>([
      [1, "PlayerMelee"],
      [2, "PlayerSpeed"]
    ]),
    moveMarkers: new Map<PlayerUnitId, Vec2>()
  };
  const speed = transitionPointerDragRelease(
    state,
    2,
    validRelease,
    { x: 3, y: -1 }
  );
  const melee = transitionPointerDragRelease(
    {
      draggedUnitIdsByPointer: speed.draggedUnitIdsByPointer,
      moveMarkers: speed.moveMarkers
    },
    1,
    validRelease,
    { x: 4, y: -2 }
  );

  assert.equal(speed.command?.unitId, "PlayerSpeed");
  assert.deepEqual([...speed.draggedUnitIdsByPointer], [[1, "PlayerMelee"]]);
  assert.equal(melee.command?.unitId, "PlayerMelee");
  assert.equal(melee.draggedUnitIdsByPointer.size, 0);
});

test("invalid release clears only its pointer", () => {
  const transition = transitionPointerDragRelease(
    {
      draggedUnitIdsByPointer: new Map<number, PlayerUnitId>([
        [1, "PlayerMelee"],
        [2, "PlayerSpeed"]
      ]),
      moveMarkers: new Map()
    },
    1,
    { ...validRelease, insideBattlefield: false },
    { x: 4, y: -2 }
  );

  assert.equal(transition.command, null);
  assert.deepEqual([...transition.draggedUnitIdsByPointer], [[2, "PlayerSpeed"]]);
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
