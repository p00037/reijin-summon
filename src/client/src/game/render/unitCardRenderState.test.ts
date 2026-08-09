import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPlayerRevivalCardState,
  updateUnitCardRenderState
} from "./unitCardRenderState";

test("無効な復活はカード状態を保持し、有効な復活はリセットして次の移動で向きを更新する", () => {
  const state = {
    positions: new Map([["PlayerMelee", { x: 100, y: 100 }]]),
    rotations: new Map([["PlayerMelee", Math.PI]])
  };

  applyPlayerRevivalCardState(state, null);

  assert.deepEqual([...state.positions], [["PlayerMelee", { x: 100, y: 100 }]]);
  assert.deepEqual([...state.rotations], [["PlayerMelee", Math.PI]]);

  applyPlayerRevivalCardState(state, "PlayerMelee");

  assert.equal(state.positions.has("PlayerMelee"), false);
  assert.equal(state.rotations.get("PlayerMelee"), 0);
  assert.equal(
    updateUnitCardRenderState(state, "PlayerMelee", { x: 100, y: 100 }, "Player"),
    0
  );
  assert.equal(
    updateUnitCardRenderState(state, "PlayerMelee", { x: 110, y: 100 }, "Player"),
    Math.PI / 2
  );
});
