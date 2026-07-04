import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBattleConfig } from "./battleConfig";
import { createDefaultBattleState, findLeader, findUnit } from "./battleState";

test("既定状態は左右のリーダーと各3体の通常ユニットを持つ", () => {
  const config = createDefaultBattleConfig();
  const state = createDefaultBattleState(config);

  assert.equal(state.remainingSeconds, 180);
  assert.equal(state.leaders.length, 2);
  assert.equal(state.units.length, 6);
  assert.equal(findLeader(state, "Player").currentHp, 1000);
  assert.equal(findLeader(state, "Cpu").position.x, 7);
  assert.equal(findUnit(state, "PlayerMelee").unitType, "Melee");
  assert.equal(findUnit(state, "CpuRanged").position.y, -1.5);
});
