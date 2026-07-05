import test from "node:test";
import assert from "node:assert/strict";
import { rangedAnimationKeyForUnit, rangedFrameStart } from "./unitAnimation";
import type { UnitState } from "../core/types";

const rangedUnit = {
  unitId: "PlayerRanged",
  team: "Player",
  unitType: "Ranged",
  position: { x: 0, y: 0 },
  spawnPosition: { x: 0, y: 0 },
  destination: { x: 0, y: 0 },
  stats: {
    maxHp: 220,
    moveSpeed: 1,
    attackDamage: 35,
    attackRange: 3.5,
    attackIntervalSeconds: 1.4
  },
  currentHp: 220,
  mode: "Active",
  buildTimerSeconds: 0,
  respawnTimerSeconds: 0,
  attackTimerSeconds: 0,
  pendingElementalId: null
} satisfies UnitState;

test("Rangedユニットは状態からモーションキーを選ぶ", () => {
  assert.equal(rangedAnimationKeyForUnit(rangedUnit, []), "ranged-idle");
  assert.equal(
    rangedAnimationKeyForUnit({ ...rangedUnit, destination: { x: 1, y: 0 } }, []),
    "ranged-walk"
  );
  assert.equal(
    rangedAnimationKeyForUnit(rangedUnit, [{ attackerUnitId: "PlayerRanged", origin: { x: 0, y: 0 }, targetPosition: { x: 1, y: 0 } }]),
    "ranged-attack"
  );
  assert.equal(rangedAnimationKeyForUnit({ ...rangedUnit, mode: "Defeated", currentHp: 0 }, []), "ranged-defeated");
});

test("mermaid.pngの行構成に対応する開始フレームを返す", () => {
  assert.equal(rangedFrameStart("idle"), 0);
  assert.equal(rangedFrameStart("walk"), 4);
  assert.equal(rangedFrameStart("attack"), 8);
  assert.equal(rangedFrameStart("damage"), 12);
  assert.equal(rangedFrameStart("defeated"), 16);
});
